/**
 * 🔒 ENTERPRISE-GRADE SERVER IDENTIFICATION SERVICE
 *
 * Purpose: Securely identify and validate server instances in multi-server deployment
 *
 * Security Features:
 * - Validates server ID format and length
 * - Prevents injection attacks via sanitization
 * - Supports multiple identification methods with fallback
 * - Immutable server ID after initialization
 *
 * @module ServerIdentifier
 * @author HalloWa.id
 * @version 2.0.0
 */

const { logger } = require('../../logger');
const crypto = require('crypto');

// 🔒 SECURITY: Server ID constraints
const SERVER_ID_MAX_LENGTH = 128;
const SERVER_ID_MIN_LENGTH = 3;
const VALID_SERVER_ID_PATTERN = /^[a-zA-Z0-9_\-\.]+$/;

/**
 * ServerIdentifier class - Singleton pattern for consistent server identification
 */
class ServerIdentifier {
  constructor() {
    if (ServerIdentifier.instance) {
      return ServerIdentifier.instance;
    }

    this._serverId = null;
    this._serverType = null;
    this._isInitialized = false;

    ServerIdentifier.instance = this;
  }

  /**
   * 🔒 Validate server ID format and security
   * @param {string} serverId - Server ID to validate
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails with detailed reason
   */
  validateServerId(serverId) {
    // Check null/undefined
    if (!serverId) {
      throw new Error('Server ID cannot be null or undefined');
    }

    // Check type
    if (typeof serverId !== 'string') {
      throw new Error('Server ID must be a string');
    }

    // Trim whitespace
    serverId = serverId.trim();

    // Check length
    if (serverId.length < SERVER_ID_MIN_LENGTH) {
      throw new Error(`Server ID too short (min: ${SERVER_ID_MIN_LENGTH} chars)`);
    }

    if (serverId.length > SERVER_ID_MAX_LENGTH) {
      throw new Error(`Server ID too long (max: ${SERVER_ID_MAX_LENGTH} chars)`);
    }

    // 🔒 SECURITY: Validate against pattern (prevent injection)
    if (!VALID_SERVER_ID_PATTERN.test(serverId)) {
      throw new Error('Server ID contains invalid characters. Allowed: alphanumeric, underscore, hyphen, dot');
    }

    // 🔒 SECURITY: Prevent path traversal attempts
    if (serverId.includes('..') || serverId.includes('//')) {
      throw new Error('Server ID contains suspicious patterns');
    }

    // 🔒 SECURITY: Prevent reserved keywords
    const reservedKeywords = ['null', 'undefined', 'admin', 'root', 'system'];
    if (reservedKeywords.includes(serverId.toLowerCase())) {
      throw new Error('Server ID uses reserved keyword');
    }

    return true;
  }

  /**
   * 🔒 Sanitize server ID by removing potentially dangerous characters
   * @param {string} serverId - Raw server ID
   * @returns {string} Sanitized server ID
   */
  sanitizeServerId(serverId) {
    if (!serverId) return null;

    // Convert to string and trim
    serverId = String(serverId).trim();

    // Remove any characters not in whitelist
    serverId = serverId.replace(/[^a-zA-Z0-9_\-\.]/g, '');

    // Limit length
    if (serverId.length > SERVER_ID_MAX_LENGTH) {
      serverId = serverId.substring(0, SERVER_ID_MAX_LENGTH);
    }

    return serverId;
  }

  /**
   * Initialize server identification with multiple fallback methods
   * Priority order:
   * 1. SERVER_ID env var (explicit configuration)
   * 2. RAILWAY_STATIC_URL (Railway deployment)
   * 3. Hostname (generic deployment)
   * 4. Generated ID (last resort)
   *
   * @returns {string} Validated and sanitized server ID
   */
  initialize() {
    if (this._isInitialized) {
      logger.warn('⚠️ ServerIdentifier already initialized. Returning existing ID.');
      return this._serverId;
    }

    let rawServerId = null;
    let source = null;

    try {
      // Priority 1: Explicit SERVER_ID environment variable
      if (process.env.SERVER_ID) {
        rawServerId = process.env.SERVER_ID;
        source = 'SERVER_ID env var';
        this._serverType = 'explicit';
      }
      // Priority 2: Railway deployment identifier
      else if (process.env.RAILWAY_STATIC_URL) {
        rawServerId = process.env.RAILWAY_STATIC_URL;
        source = 'RAILWAY_STATIC_URL';
        this._serverType = 'railway';
      }
      // Priority 3: RAILWAY_SERVICE_NAME (Railway service identifier)
      else if (process.env.RAILWAY_SERVICE_NAME) {
        rawServerId = process.env.RAILWAY_SERVICE_NAME;
        source = 'RAILWAY_SERVICE_NAME';
        this._serverType = 'railway';
      }
      // Priority 4: Hostname
      else if (process.env.HOSTNAME) {
        rawServerId = process.env.HOSTNAME;
        source = 'HOSTNAME env var';
        this._serverType = 'generic';
      }
      // Priority 5: OS hostname (Node.js API)
      else {
        const os = require('os');
        rawServerId = os.hostname();
        source = 'OS hostname';
        this._serverType = 'generic';
      }

      // 🔒 SECURITY: Sanitize raw server ID
      const sanitizedServerId = this.sanitizeServerId(rawServerId);

      if (!sanitizedServerId) {
        throw new Error('Failed to sanitize server ID - result is empty');
      }

      // 🔒 SECURITY: Validate sanitized server ID
      this.validateServerId(sanitizedServerId);

      // Store validated server ID (immutable)
      this._serverId = sanitizedServerId;
      this._isInitialized = true;

      logger.info('✅ Server identified successfully', {
        serverId: this._serverId,
        source: source,
        type: this._serverType
      });

      return this._serverId;

    } catch (error) {
      logger.error('❌ Failed to initialize server identifier', {
        error: error.message,
        rawServerId: rawServerId,
        source: source
      });

      // 🔒 FALLBACK: Generate secure random ID as last resort
      const fallbackId = this.generateFallbackServerId();

      logger.warn('⚠️ Using generated fallback server ID', {
        serverId: fallbackId
      });

      this._serverId = fallbackId;
      this._serverType = 'generated';
      this._isInitialized = true;

      return this._serverId;
    }
  }

  /**
   * Generate secure fallback server ID
   * Used when all other identification methods fail
   *
   * @returns {string} Generated server ID
   */
  generateFallbackServerId() {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const fallbackId = `server-${timestamp}-${randomBytes}`;

    logger.warn('🔧 Generated fallback server ID', { fallbackId });

    return fallbackId;
  }

  /**
   * Get current server ID (must be initialized first)
   * @returns {string|null} Server ID or null if not initialized
   */
  getServerId() {
    if (!this._isInitialized) {
      logger.warn('⚠️ ServerIdentifier not initialized. Call initialize() first.');
      return this.initialize();
    }
    return this._serverId;
  }

  /**
   * Get server type
   * @returns {string|null} Server type (explicit, railway, generic, generated)
   */
  getServerType() {
    return this._serverType;
  }

  /**
   * Check if server ID matches the current server
   * @param {string} serverId - Server ID to check
   * @returns {boolean} True if matches
   */
  isCurrentServer(serverId) {
    if (!this._isInitialized) {
      this.initialize();
    }

    if (!serverId) return false;

    const sanitized = this.sanitizeServerId(serverId);
    return sanitized === this._serverId;
  }

  /**
   * Get server information for logging/monitoring
   * @returns {Object} Server info object
   */
  getServerInfo() {
    return {
      serverId: this._serverId,
      serverType: this._serverType,
      isInitialized: this._isInitialized,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: process.uptime()
    };
  }

  /**
   * Reset server identifier (for testing purposes only)
   * ⚠️ WARNING: Do not use in production
   */
  reset() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot reset ServerIdentifier in production');
    }

    this._serverId = null;
    this._serverType = null;
    this._isInitialized = false;

    logger.warn('⚠️ ServerIdentifier reset (test mode only)');
  }
}

// Export singleton instance
const serverIdentifier = new ServerIdentifier();

module.exports = {
  serverIdentifier,
  ServerIdentifier, // Export class for testing
  SERVER_ID_MAX_LENGTH,
  SERVER_ID_MIN_LENGTH,
  VALID_SERVER_ID_PATTERN
};
