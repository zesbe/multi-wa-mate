/**
 * BullBoard Dashboard Configuration
 * Provides a web UI for monitoring BullMQ queues
 * Access at: http://your-server/admin/queues
 */

const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { Queue } = require('bullmq');
const { ioredisConnection } = require('../config/redis');

/**
 * Create BullBoard dashboard
 * @returns {Object} { router, adapter } - Express router and server adapter
 */
function createQueueDashboard() {
  if (!ioredisConnection) {
    console.warn('⚠️  BullBoard disabled - ioredis connection not available');
    return null;
  }

  try {
    // Create Express adapter for BullBoard
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    // Create queue instances for monitoring
    const broadcastQueue = new Queue('broadcasts', {
      connection: ioredisConnection,
    });

    // Create BullBoard with queues
    createBullBoard({
      queues: [
        new BullMQAdapter(broadcastQueue),
      ],
      serverAdapter,
    });

    console.log('✅ BullBoard dashboard created');
    console.log('📊 Dashboard available at: /admin/queues');

    return {
      router: serverAdapter.getRouter(),
      adapter: serverAdapter,
    };
  } catch (error) {
    console.error('❌ Failed to create BullBoard dashboard:', error);
    return null;
  }
}

/**
 * Rate limiting for authentication attempts
 * Prevents brute force attacks
 */
const authAttempts = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const attempts = authAttempts.get(ip) || { count: 0, resetAt: now + 60000 };

  // Reset if time window passed
  if (now > attempts.resetAt) {
    attempts.count = 0;
    attempts.resetAt = now + 60000;
  }

  attempts.count++;
  authAttempts.set(ip, attempts);

  // Max 5 attempts per minute
  return attempts.count > 5;
}

function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [ip, attempts] of authAttempts.entries()) {
    if (now > attempts.resetAt) {
      authAttempts.delete(ip);
    }
  }
}

// Cleanup rate limit map every 5 minutes
setInterval(cleanupRateLimitMap, 5 * 60 * 1000);

/**
 * Authentication middleware for BullBoard with rate limiting
 * Protects against brute force attacks
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 */
function createAuthMiddleware(username = 'admin', password = process.env.ADMIN_PASSWORD || 'changeme') {
  return (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

    // Rate limiting check
    if (isRateLimited(clientIp)) {
      console.warn(`⚠️  Rate limit exceeded for IP: ${clientIp}`);
      res.status(429).send('Too many authentication attempts. Please try again later.');
      return;
    }

    const auth = req.headers.authorization;

    if (!auth) {
      res.setHeader('WWW-Authenticate', 'Basic realm="BullBoard"');
      res.status(401).send('Authentication required');
      return;
    }

    const [scheme, credentials] = auth.split(' ');

    if (scheme !== 'Basic') {
      res.status(401).send('Invalid authentication scheme');
      return;
    }

    try {
      const [user, pass] = Buffer.from(credentials, 'base64').toString().split(':');

      if (user === username && pass === password) {
        // Success - reset rate limit for this IP
        authAttempts.delete(clientIp);
        next();
      } else {
        console.warn(`⚠️  Failed auth attempt for user '${user}' from IP: ${clientIp}`);
        res.setHeader('WWW-Authenticate', 'Basic realm="BullBoard"');
        res.status(401).send('Invalid credentials');
      }
    } catch (error) {
      console.error('⚠️  Auth parsing error:', error.message);
      res.status(401).send('Invalid authentication format');
    }
  };
}

/**
 * Get queue statistics
 * @param {Queue} queue - BullMQ queue instance
 * @returns {Promise<Object>} Queue statistics
 */
async function getQueueStats(queue) {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      name: queue.name,
      counts: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      },
      health: failed / Math.max(1, completed + failed) < 0.1 ? 'healthy' : 'needs attention',
    };
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return null;
  }
}

/**
 * Get comprehensive queue monitoring data
 * @returns {Promise<Object>} Complete monitoring data
 */
async function getMonitoringData() {
  if (!ioredisConnection) {
    return {
      enabled: false,
      message: 'Queue monitoring not available - ioredis not configured',
    };
  }

  try {
    const broadcastQueue = new Queue('broadcasts', {
      connection: ioredisConnection,
    });

    const stats = await getQueueStats(broadcastQueue);

    return {
      enabled: true,
      timestamp: new Date().toISOString(),
      queues: {
        broadcasts: stats,
      },
      dashboardUrl: '/admin/queues',
    };
  } catch (error) {
    console.error('Error getting monitoring data:', error);
    return {
      enabled: false,
      error: error.message,
    };
  }
}

module.exports = {
  createQueueDashboard,
  createAuthMiddleware,
  getQueueStats,
  getMonitoringData,
};
