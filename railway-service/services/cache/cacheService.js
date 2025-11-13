/**
 * Cache Service
 * Centralized caching layer for templates, user settings, and contact lists
 * Uses Redis REST API for distributed caching
 */

const redisClient = require('../../redis-client');
const { supabase } = require('../../config/supabase');
const {
  validateUserId,
  validateTemplateId,
  sanitizeRedisKey,
  isValidPhoneNumber,
  sanitizeErrorMessage,
  hashForLogging,
} = require('../../utils/inputValidation');

/**
 * Cache TTL configurations (in seconds)
 */
const CACHE_TTL = {
  TEMPLATE: 3600,        // 1 hour - templates rarely change
  USER_SETTINGS: 1800,   // 30 minutes - settings occasionally change
  CONTACT_LIST: 300,     // 5 minutes - contacts change frequently
  CONTACT_INFO: 600,     // 10 minutes - individual contact info
  USER_SUBSCRIPTION: 600, // 10 minutes - subscription status
};

/**
 * Cache key generators (with sanitization)
 */
const CacheKey = {
  template: (userId, templateId) => `template:${sanitizeRedisKey(userId)}:${sanitizeRedisKey(templateId)}`,
  allTemplates: (userId) => `templates:${sanitizeRedisKey(userId)}:all`,
  userSettings: (userId) => `settings:${sanitizeRedisKey(userId)}`,
  contactList: (userId) => `contacts:${sanitizeRedisKey(userId)}:list`,
  contactInfo: (userId, phoneNumber) => `contact:${sanitizeRedisKey(userId)}:${sanitizeRedisKey(phoneNumber)}`,
  userSubscription: (userId) => `subscription:${sanitizeRedisKey(userId)}`,
};

class CacheService {
  /**
   * Get or fetch template with caching
   * @param {string} userId - User ID
   * @param {string} templateId - Template ID
   * @returns {Promise<Object|null>} Template object
   */
  async getTemplate(userId, templateId) {
    try {
      // Validate inputs
      const validatedUserId = validateUserId(userId);
      const validatedTemplateId = validateTemplateId(templateId);

      const cacheKey = CacheKey.template(validatedUserId, validatedTemplateId);

      // Try cache first
      let template = await redisClient.cacheGet(cacheKey);

      if (template) {
        console.log(`✅ Cache HIT: template ${hashForLogging(validatedTemplateId)}`);
        return template;
      }

      console.log(`❌ Cache MISS: template ${hashForLogging(validatedTemplateId)}, fetching from DB...`);

      // Cache miss - fetch from database
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', validatedTemplateId)
        .eq('user_id', validatedUserId)
        .maybeSingle();

      if (error) {
        console.error(`⚠️  Error fetching template:`, sanitizeErrorMessage(error));
        return null;
      }

      if (!data) {
        return null;
      }

      // Store in cache (only store valid data)
      await redisClient.cacheSet(cacheKey, data, CACHE_TTL.TEMPLATE);

      return data;
    } catch (error) {
      console.error(`⚠️  Error in getTemplate:`, sanitizeErrorMessage(error));
      return null;
    }
  }

  /**
   * Get all templates for a user with caching
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of templates
   */
  async getAllTemplates(userId) {
    const cacheKey = CacheKey.allTemplates(userId);

    // Try cache first
    let templates = await redisClient.cacheGet(cacheKey);

    if (templates) {
      console.log(`✅ Cache HIT: all templates for user ${userId}`);
      return templates;
    }

    console.log(`❌ Cache MISS: all templates for user ${userId}, fetching from DB...`);

    // Cache miss - fetch from database
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    // Store in cache
    await redisClient.cacheSet(cacheKey, data || [], CACHE_TTL.TEMPLATE);

    return data || [];
  }

  /**
   * Invalidate template cache when template is updated/deleted
   * @param {string} userId - User ID
   * @param {string} templateId - Template ID (optional)
   */
  async invalidateTemplateCache(userId, templateId = null) {
    if (templateId) {
      await redisClient.cacheDelete(CacheKey.template(userId, templateId));
    }
    await redisClient.cacheDelete(CacheKey.allTemplates(userId));
    console.log(`🗑️  Invalidated template cache for user ${userId}`);
  }

  /**
   * Get user settings with caching
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User settings
   */
  async getUserSettings(userId) {
    const cacheKey = CacheKey.userSettings(userId);

    // Try cache first
    let settings = await redisClient.cacheGet(cacheKey);

    if (settings) {
      console.log(`✅ Cache HIT: settings for user ${userId}`);
      return settings;
    }

    console.log(`❌ Cache MISS: settings for user ${userId}, fetching from DB...`);

    // Cache miss - fetch from database
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Store in cache
    await redisClient.cacheSet(cacheKey, data, CACHE_TTL.USER_SETTINGS);

    return data;
  }

  /**
   * Invalidate user settings cache
   * @param {string} userId - User ID
   */
  async invalidateUserSettings(userId) {
    await redisClient.cacheDelete(CacheKey.userSettings(userId));
    console.log(`🗑️  Invalidated settings cache for user ${userId}`);
  }

  /**
   * Get contact list with caching
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of contacts
   */
  async getContactList(userId) {
    const cacheKey = CacheKey.contactList(userId);

    // Try cache first
    let contacts = await redisClient.cacheGet(cacheKey);

    if (contacts) {
      console.log(`✅ Cache HIT: contact list for user ${userId}`);
      return contacts;
    }

    console.log(`❌ Cache MISS: contact list for user ${userId}, fetching from DB...`);

    // Cache miss - fetch from database
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    // Store in cache (5 minutes - contacts change frequently)
    await redisClient.cacheSet(cacheKey, data || [], CACHE_TTL.CONTACT_LIST);

    return data || [];
  }

  /**
   * Get individual contact info with caching
   * @param {string} userId - User ID
   * @param {string} phoneNumber - Phone number
   * @returns {Promise<Object|null>} Contact info
   */
  async getContactInfo(userId, phoneNumber) {
    const cacheKey = CacheKey.contactInfo(userId, phoneNumber);

    // Try cache first
    let contact = await redisClient.cacheGet(cacheKey);

    if (contact) {
      console.log(`✅ Cache HIT: contact ${phoneNumber}`);
      return contact;
    }

    console.log(`❌ Cache MISS: contact ${phoneNumber}, fetching from DB...`);

    // Cache miss - fetch from database
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Store in cache
    await redisClient.cacheSet(cacheKey, data, CACHE_TTL.CONTACT_INFO);

    return data;
  }

  /**
   * Invalidate contact cache
   * @param {string} userId - User ID
   * @param {string} phoneNumber - Phone number (optional)
   */
  async invalidateContactCache(userId, phoneNumber = null) {
    if (phoneNumber) {
      await redisClient.cacheDelete(CacheKey.contactInfo(userId, phoneNumber));
    }
    await redisClient.cacheDelete(CacheKey.contactList(userId));
    console.log(`🗑️  Invalidated contact cache for user ${userId}`);
  }

  /**
   * Get user subscription status with caching
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Subscription object
   */
  async getUserSubscription(userId) {
    const cacheKey = CacheKey.userSubscription(userId);

    // Try cache first
    let subscription = await redisClient.cacheGet(cacheKey);

    if (subscription) {
      console.log(`✅ Cache HIT: subscription for user ${userId}`);
      return subscription;
    }

    console.log(`❌ Cache MISS: subscription for user ${userId}, fetching from DB...`);

    // Cache miss - fetch from database
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Store in cache
    await redisClient.cacheSet(cacheKey, data, CACHE_TTL.USER_SUBSCRIPTION);

    return data;
  }

  /**
   * Invalidate subscription cache
   * @param {string} userId - User ID
   */
  async invalidateSubscriptionCache(userId) {
    await redisClient.cacheDelete(CacheKey.userSubscription(userId));
    console.log(`🗑️  Invalidated subscription cache for user ${userId}`);
  }

  /**
   * Clear all cache for a user
   * @param {string} userId - User ID
   */
  async clearUserCache(userId) {
    await Promise.all([
      redisClient.cacheClearPattern(`template:${userId}:*`),
      redisClient.cacheClearPattern(`templates:${userId}:*`),
      redisClient.cacheDelete(CacheKey.userSettings(userId)),
      redisClient.cacheDelete(CacheKey.contactList(userId)),
      redisClient.cacheClearPattern(`contact:${userId}:*`),
      redisClient.cacheDelete(CacheKey.userSubscription(userId)),
    ]);

    console.log(`🗑️  Cleared ALL cache for user ${userId}`);
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getCacheStats() {
    // This is a simple implementation
    // For production, consider using Redis INFO command
    return {
      enabled: redisClient.enabled,
      ttl: CACHE_TTL,
      message: 'Cache is active and serving requests',
    };
  }
}

module.exports = new CacheService();
