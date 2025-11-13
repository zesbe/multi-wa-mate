/**
 * Monitoring Dashboard Server
 * Optional: Run this as a separate process for queue monitoring
 * Usage: node monitoring/dashboard-server.js
 *
 * Security Features:
 * - Basic HTTP authentication for all endpoints
 * - Rate limiting on auth attempts
 * - No credential logging
 * - HTTPS enforcement in production
 */

const express = require('express');
const { createQueueDashboard, createAuthMiddleware, getMonitoringData } = require('./bullboard');

const PORT = process.env.MONITORING_PORT || 3001;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Security: Enforce strong password in production
if (!ADMIN_PASSWORD || ADMIN_PASSWORD === 'changeme123' || ADMIN_PASSWORD.length < 12) {
  console.error('❌ SECURITY ERROR: ADMIN_PASSWORD must be set and at least 12 characters');
  console.error('❌ Set ADMIN_PASSWORD environment variable before starting');
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Cannot start in production without secure password');
    process.exit(1);
  } else {
    console.warn('⚠️  WARNING: Using default password in development mode');
    console.warn('⚠️  NEVER use this in production!');
  }
}

/**
 * Start monitoring dashboard server
 */
async function startDashboardServer() {
  try {
    const app = express();

    // Security: Disable Express fingerprinting
    app.disable('x-powered-by');

    // Security: HTTPS enforcement in production
    if (process.env.NODE_ENV === 'production') {
      app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
          return res.status(403).json({ error: 'HTTPS required' });
        }
        next();
      });
    }

    // Health check (no auth - for load balancers)
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', service: 'monitoring-dashboard' });
    });

    // Create auth middleware
    const authMiddleware = createAuthMiddleware(ADMIN_USERNAME, ADMIN_PASSWORD || 'changeme123');

    // Queue statistics API endpoint (WITH auth to prevent info disclosure)
    app.get('/api/queue-stats', authMiddleware, async (req, res) => {
      try {
        const data = await getMonitoringData();
        res.json(data);
      } catch (error) {
        console.error('⚠️  Error getting queue stats:', error.message);
        res.status(500).json({ error: 'Failed to fetch queue statistics' });
      }
    });

    // BullBoard dashboard (with authentication)
    const dashboard = createQueueDashboard();

    if (dashboard) {
      app.use(
        '/admin/queues',
        authMiddleware,
        dashboard.router
      );

      console.log('✅ BullBoard dashboard mounted at /admin/queues');
      console.log(`🔐 Authentication enabled (username: ${ADMIN_USERNAME})`);
      // ⚠️  NEVER log passwords to console
    } else {
      console.warn('⚠️  BullBoard dashboard not available');
    }

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler (don't expose stack traces)
    app.use((err, req, res, next) => {
      console.error('⚠️  Server error:', err.message);
      res.status(500).json({
        error: process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : err.message
      });
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`🖥️  Monitoring dashboard running on port ${PORT}`);
      console.log(`🔗 Dashboard: http://localhost:${PORT}/admin/queues`);
      console.log(`📊 Queue Stats API: http://localhost:${PORT}/api/queue-stats (auth required)`);
      console.log(`🔐 Security: Authentication enabled, HTTPS ${process.env.NODE_ENV === 'production' ? 'enforced' : 'not enforced (dev mode)'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start dashboard server:', error.message);
    process.exit(1);
  }
}

// Start if run directly
if (require.main === module) {
  console.log('🚀 Starting BullMQ Monitoring Dashboard...');
  startDashboardServer();
}

module.exports = { startDashboardServer };
