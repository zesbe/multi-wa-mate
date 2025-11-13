/**
 * User-specific Rate Limiting Service
 * Implements rate limiting per user for broadcasts and API calls
 * Prevents abuse and ensures fair usage across all users
 */

const redisClient = require('../../redis-client');
const { supabase } = require('../../config/supabase');
const {
  validateUserId,
  sanitizeRedisKey,
  sanitizeErrorMessage,
  hashForLogging,
} = require('../../utils/inputValidation');

/**
 * Rate limit configurations per feature
 *
 * 🎯 BUSINESS MODEL: Plan-Based Limits (Like Fonnte.com)
 *
 * Rate limits are controlled by USER'S SUBSCRIPTION PLAN, not hard-coded limits.
 * This allows different pricing tiers with different quotas.
 *
 * Default values below are UNLIMITED for testing/development.
 * In production, limits are fetched from user's subscription plan.
 *
 * 💡 PRICING MODEL EXAMPLE (Fonnte-style):
 * - Free Plan:     100 messages/day
 * - Basic Plan:    1,000 messages/day  ($10/month)
 * - Pro Plan:      10,000 messages/day ($50/month)
 * - Business Plan: 100,000 messages/day ($200/month)
 * - Enterprise:    UNLIMITED
 *
 * ⚠️ IMPORTANT:
 * - Limits are stored in 'plans' table (features JSONB column)
 * - Default: UNLIMITED (999999) - easy testing
 * - To enable limits: Set plan limits in database
 */
const RATE_LIMITS = {
  // Default limits (UNLIMITED for easy testing)
  // Override by checking user's subscription plan
  DEFAULT: {
    BROADCAST_PER_DAY: 999999,      // Unlimited by default
    MESSAGE_PER_DAY: 999999,        // Unlimited by default
    API_CALL_PER_HOUR: 999999,      // Unlimited by default
    DEVICE_CONNECTION_PER_HOUR: 100, // Reasonable limit to prevent spam
  },

  // Time windows in seconds
  WINDOWS: {
    MINUTE: 60,
    HOUR: 3600,
    DAY: 86400,
  },
};

/**
 * Rate limit key generators
 */
const RateLimitKey = {
  broadcast: (userId, window) => `ratelimit:user:${sanitizeRedisKey(userId)}:broadcast:${window}`,
  message: (userId, window) => `ratelimit:user:${sanitizeRedisKey(userId)}:message:${window}`,
  apiCall: (userId, window) => `ratelimit:user:${sanitizeRedisKey(userId)}:api:${window}`,
  deviceConnection: (userId) => `ratelimit:user:${sanitizeRedisKey(userId)}:device:connection`,
};

class UserRateLimitService {
  /**
   * Get user's plan limits from subscription
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Plan limits
   */
  async getUserPlanLimits(userId) {
    try {
      // Validate user ID to prevent injection
      const validatedUserId = validateUserId(userId);

      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('plans(name, features)')
        .eq('user_id', validatedUserId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(`⚠️  Database error for user ${hashForLogging(validatedUserId)}:`, sanitizeErrorMessage(error));
        // Fail open - return unlimited on error
        return {
          planName: 'Error - Unlimited',
          broadcastPerDay: RATE_LIMITS.DEFAULT.BROADCAST_PER_DAY,
          messagePerDay: RATE_LIMITS.DEFAULT.MESSAGE_PER_DAY,
          apiCallPerHour: RATE_LIMITS.DEFAULT.API_CALL_PER_HOUR,
        };
      }

      if (!subscription || !subscription.plans) {
        // No active subscription - use default (unlimited)
        return {
          planName: 'Free (Unlimited)',
          broadcastPerDay: RATE_LIMITS.DEFAULT.BROADCAST_PER_DAY,
          messagePerDay: RATE_LIMITS.DEFAULT.MESSAGE_PER_DAY,
          apiCallPerHour: RATE_LIMITS.DEFAULT.API_CALL_PER_HOUR,
        };
      }

      const plan = subscription.plans;
      const features = plan.features || {};

      // Extract limits from plan features with type validation
      // Expected format in plans.features (JSONB):
      // {
      //   "broadcastPerDay": 1000,
      //   "messagePerDay": 10000,
      //   "apiCallPerHour": 5000
      // }
      const broadcastLimit = Number(features.broadcastPerDay) || RATE_LIMITS.DEFAULT.BROADCAST_PER_DAY;
      const messageLimit = Number(features.messagePerDay) || RATE_LIMITS.DEFAULT.MESSAGE_PER_DAY;
      const apiLimit = Number(features.apiCallPerHour) || RATE_LIMITS.DEFAULT.API_CALL_PER_HOUR;

      return {
        planName: plan.name,
        broadcastPerDay: Math.max(0, broadcastLimit), // Ensure non-negative
        messagePerDay: Math.max(0, messageLimit),
        apiCallPerHour: Math.max(0, apiLimit),
      };
    } catch (error) {
      console.error(`⚠️  Error fetching plan limits for user ${hashForLogging(userId)}:`, sanitizeErrorMessage(error));
      // On error, return unlimited (fail open)
      return {
        planName: 'Error - Unlimited',
        broadcastPerDay: RATE_LIMITS.DEFAULT.BROADCAST_PER_DAY,
        messagePerDay: RATE_LIMITS.DEFAULT.MESSAGE_PER_DAY,
        apiCallPerHour: RATE_LIMITS.DEFAULT.API_CALL_PER_HOUR,
      };
    }
  }

  /**
   * Check if user is within broadcast rate limit (plan-based)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} { allowed: boolean, remaining: number, resetAt: Date }
   */
  async checkBroadcastLimit(userId) {
    // Get user's plan limits
    const planLimits = await this.getUserPlanLimits(userId);
    const maxPerDay = planLimits.broadcastPerDay;

    // If unlimited (999999), skip rate limit check
    if (maxPerDay >= 999999) {
      return {
        allowed: true,
        planName: planLimits.planName,
        daily: {
          current: 0,
          max: 'Unlimited',
          remaining: 'Unlimited',
        },
        message: 'Unlimited plan - no rate limit',
      };
    }

    const dayKey = RateLimitKey.broadcast(userId, 'day');

    // Check daily limit
    const dailyAllowed = await redisClient.checkRateLimit(
      dayKey,
      maxPerDay,
      RATE_LIMITS.WINDOWS.DAY
    );

    const dayCount = await redisClient.getRateLimitCount(dayKey);

    return {
      allowed: dailyAllowed,
      planName: planLimits.planName,
      daily: {
        current: dayCount,
        max: maxPerDay,
        remaining: Math.max(0, maxPerDay - dayCount),
      },
      message: dailyAllowed
        ? `Plan: ${planLimits.planName} - Rate limit OK`
        : `Plan limit reached (${maxPerDay}/day) - Upgrade plan for more`,
    };
  }

  /**
   * Check if user is within message rate limit (plan-based)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Rate limit status
   */
  async checkMessageLimit(userId) {
    // Get user's plan limits
    const planLimits = await this.getUserPlanLimits(userId);
    const maxPerDay = planLimits.messagePerDay;

    // If unlimited (999999), skip rate limit check
    if (maxPerDay >= 999999) {
      return {
        allowed: true,
        planName: planLimits.planName,
        perDay: {
          current: 0,
          max: 'Unlimited',
          remaining: 'Unlimited',
        },
        message: 'Unlimited plan - no rate limit',
      };
    }

    const dayKey = RateLimitKey.message(userId, 'day');

    const dayAllowed = await redisClient.checkRateLimit(
      dayKey,
      maxPerDay,
      RATE_LIMITS.WINDOWS.DAY
    );

    const dayCount = await redisClient.getRateLimitCount(dayKey);

    return {
      allowed: dayAllowed,
      planName: planLimits.planName,
      perDay: {
        current: dayCount,
        max: maxPerDay,
        remaining: Math.max(0, maxPerDay - dayCount),
      },
      message: dayAllowed
        ? `Plan: ${planLimits.planName} - Rate limit OK`
        : `Daily message limit reached (${maxPerDay}/day) - Upgrade plan for more`,
    };
  }

  /**
   * Check if user is within API call rate limit (plan-based)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Rate limit status
   */
  async checkApiLimit(userId) {
    // Get user's plan limits
    const planLimits = await this.getUserPlanLimits(userId);
    const maxPerHour = planLimits.apiCallPerHour;

    // If unlimited (999999), skip rate limit check
    if (maxPerHour >= 999999) {
      return {
        allowed: true,
        planName: planLimits.planName,
        perHour: {
          current: 0,
          max: 'Unlimited',
          remaining: 'Unlimited',
        },
        message: 'Unlimited plan - no API rate limit',
      };
    }

    const hourKey = RateLimitKey.apiCall(userId, 'hour');

    const hourAllowed = await redisClient.checkRateLimit(
      hourKey,
      maxPerHour,
      RATE_LIMITS.WINDOWS.HOUR
    );

    const hourCount = await redisClient.getRateLimitCount(hourKey);

    return {
      allowed: hourAllowed,
      planName: planLimits.planName,
      perHour: {
        current: hourCount,
        max: maxPerHour,
        remaining: Math.max(0, maxPerHour - hourCount),
      },
      message: hourAllowed
        ? `Plan: ${planLimits.planName} - API rate limit OK`
        : `Hourly API limit reached (${maxPerHour}/hour) - Upgrade plan for more`,
    };
  }

  /**
   * Check device connection rate limit
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if allowed
   */
  async checkDeviceConnectionLimit(userId) {
    const key = RateLimitKey.deviceConnection(userId);

    // Device connection has fixed limit (not plan-based)
    // This prevents spam reconnection attempts
    return await redisClient.checkRateLimit(
      key,
      RATE_LIMITS.DEFAULT.DEVICE_CONNECTION_PER_HOUR,
      RATE_LIMITS.WINDOWS.HOUR
    );
  }

  /**
   * Get comprehensive rate limit status for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Complete rate limit status
   */
  async getUserRateLimitStatus(userId) {
    const [planLimits, broadcast, message, api] = await Promise.all([
      this.getUserPlanLimits(userId),
      this.checkBroadcastLimit(userId),
      this.checkMessageLimit(userId),
      this.checkApiLimit(userId),
    ]);

    return {
      userId,
      plan: planLimits.planName,
      timestamp: new Date().toISOString(),
      limits: {
        broadcast,
        message,
        api,
      },
      overallStatus: broadcast.allowed && message.allowed && api.allowed ? 'OK' : 'LIMITED',
      upgradeMessage: !broadcast.allowed || !message.allowed || !api.allowed
        ? 'Upgrade your plan for higher limits'
        : null,
    };
  }

  /**
   * Reset rate limits for a user (admin function)
   * @param {string} userId - User ID
   */
  async resetUserRateLimits(userId) {
    const keys = [
      RateLimitKey.broadcast(userId, 'hour'),
      RateLimitKey.broadcast(userId, 'day'),
      RateLimitKey.message(userId, 'minute'),
      RateLimitKey.message(userId, 'hour'),
      RateLimitKey.apiCall(userId, 'minute'),
      RateLimitKey.apiCall(userId, 'hour'),
      RateLimitKey.deviceConnection(userId),
    ];

    for (const key of keys) {
      await redisClient.resetRateLimit(key);
    }

    console.log(`✅ Reset all rate limits for user ${userId}`);
  }

  /**
   * Log rate limit violation for monitoring
   * @param {string} userId - User ID
   * @param {string} limitType - Type of limit violated
   * @param {Object} details - Additional details
   */
  async logRateLimitViolation(userId, limitType, details = {}) {
    try {
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'rate_limit_exceeded',
        entity_type: limitType,
        details: {
          ...details,
          timestamp: new Date().toISOString(),
        },
      });

      console.log(`⚠️  Rate limit violation logged for user ${userId}: ${limitType}`);
    } catch (error) {
      console.error('Failed to log rate limit violation:', error);
    }
  }

  /**
   * Check if user has premium plan (bypasses some limits)
   * @deprecated Use getUserPlanLimits() instead for plan-based limits
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if premium user
   */
  async isPremiumUser(userId) {
    const planLimits = await this.getUserPlanLimits(userId);

    // Consider unlimited plans as premium
    return planLimits.messagePerDay >= 999999 ||
           planLimits.planName.toLowerCase().includes('premium') ||
           planLimits.planName.toLowerCase().includes('enterprise') ||
           planLimits.planName.toLowerCase().includes('pro');
  }

  /**
   * Get adjusted rate limits based on user plan
   * @deprecated Use getUserPlanLimits() instead
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Adjusted rate limits
   */
  async getAdjustedLimits(userId) {
    return await this.getUserPlanLimits(userId);
  }
}

module.exports = new UserRateLimitService();
