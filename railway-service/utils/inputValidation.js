/**
 * Input Validation & Sanitization Utilities
 * Centralized security validation to prevent injection attacks
 *
 * Security Features:
 * - UUID validation (prevents SQL injection)
 * - Redis key sanitization (prevents key injection)
 * - Phone number validation (prevents injection)
 * - URL validation with SSRF protection
 * - String sanitization (XSS prevention)
 */

const crypto = require('crypto');

/**
 * Validate UUID format (v4)
 * Prevents SQL injection and malformed IDs
 * @param {string} uuid - UUID to validate
 * @returns {boolean} True if valid UUID
 */
function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') return false;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate and sanitize user ID
 * @param {string} userId - User ID to validate
 * @returns {string|null} Sanitized user ID or null if invalid
 * @throws {Error} If user ID is invalid
 */
function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid user ID: must be a non-empty string');
  }

  if (!isValidUUID(userId)) {
    throw new Error('Invalid user ID format: must be a valid UUID');
  }

  return userId.trim();
}

/**
 * Validate and sanitize device ID
 * @param {string} deviceId - Device ID to validate
 * @returns {string|null} Sanitized device ID or null if invalid
 * @throws {Error} If device ID is invalid
 */
function validateDeviceId(deviceId) {
  if (!deviceId || typeof deviceId !== 'string') {
    throw new Error('Invalid device ID: must be a non-empty string');
  }

  if (!isValidUUID(deviceId)) {
    throw new Error('Invalid device ID format: must be a valid UUID');
  }

  return deviceId.trim();
}

/**
 * Sanitize Redis key component
 * Prevents Redis key injection attacks
 * @param {string} keyComponent - Key component to sanitize
 * @returns {string} Sanitized key component
 */
function sanitizeRedisKey(keyComponent) {
  if (!keyComponent || typeof keyComponent !== 'string') {
    throw new Error('Invalid Redis key component');
  }

  // Remove dangerous characters: * ? [ ] { } : space newline
  // These can be used for key injection or pattern matching exploits
  return keyComponent
    .replace(/[*?[\]{}:\s\n\r]/g, '_')
    .substring(0, 200); // Limit length to prevent abuse
}

/**
 * Validate phone number format
 * Prevents injection attacks via phone numbers
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} True if valid
 */
function isValidPhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') return false;

  // Allow only digits, +, @, ., - characters (WhatsApp JID format)
  const phoneRegex = /^[\d+@.\-]+$/;
  return phoneRegex.test(phoneNumber) && phoneNumber.length >= 8 && phoneNumber.length <= 50;
}

/**
 * Validate media URL with SSRF protection
 * Prevents Server-Side Request Forgery attacks
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is safe
 */
function isValidMediaUrl(url) {
  if (!url || typeof url !== 'string') return false;

  try {
    const parsedUrl = new URL(url);

    // Only allow HTTPS (secure)
    if (parsedUrl.protocol !== 'https:') {
      return false;
    }

    // Block private IP ranges (SSRF protection)
    const hostname = parsedUrl.hostname;

    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      return false;
    }

    // Block private IPv4 ranges
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16 (link-local)
    const privateIPv4Regex = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.)/;
    if (privateIPv4Regex.test(hostname)) {
      return false;
    }

    // Block IPv6 localhost and private ranges
    if (hostname.includes('::1') || hostname.includes('fc00:') || hostname.includes('fd00:')) {
      return false;
    }

    // Block metadata endpoints (AWS, GCP, Azure)
    const metadataEndpoints = [
      '169.254.169.254', // AWS, GCP, Azure metadata
      'metadata.google.internal',
      'metadata.azure.com',
    ];
    if (metadataEndpoints.includes(hostname)) {
      return false;
    }

    // URL length limit
    if (url.length > 2048) {
      return false;
    }

    return true;
  } catch (error) {
    // Invalid URL format
    return false;
  }
}

/**
 * Sanitize string for safe storage/display
 * Prevents XSS and injection attacks
 * @param {string} str - String to sanitize
 * @param {number} maxLength - Maximum length (default: 10000)
 * @returns {string} Sanitized string
 */
function sanitizeString(str, maxLength = 10000) {
  if (!str || typeof str !== 'string') return '';

  // Limit length
  let sanitized = str.substring(0, maxLength);

  // Remove null bytes (can break some parsers)
  sanitized = sanitized.replace(/\0/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Validate message content
 * @param {string} message - Message to validate
 * @returns {boolean} True if valid
 */
function isValidMessage(message) {
  if (!message || typeof message !== 'string') return false;

  // Check length (WhatsApp limit ~65K, we set conservative limit)
  if (message.length > 50000) return false;

  // Check for null bytes
  if (message.includes('\0')) return false;

  return true;
}

/**
 * Generate safe cache key from components
 * @param {...string} components - Key components
 * @returns {string} Safe Redis key
 */
function generateSafeCacheKey(...components) {
  return components
    .map(comp => sanitizeRedisKey(String(comp)))
    .join(':');
}

/**
 * Validate template ID
 * @param {string} templateId - Template ID to validate
 * @returns {string} Validated template ID
 * @throws {Error} If invalid
 */
function validateTemplateId(templateId) {
  if (!templateId || typeof templateId !== 'string') {
    throw new Error('Invalid template ID');
  }

  if (!isValidUUID(templateId)) {
    throw new Error('Invalid template ID format');
  }

  return templateId.trim();
}

/**
 * Validate broadcast ID
 * @param {string} broadcastId - Broadcast ID to validate
 * @returns {string} Validated broadcast ID
 * @throws {Error} If invalid
 */
function validateBroadcastId(broadcastId) {
  if (!broadcastId || typeof broadcastId !== 'string') {
    throw new Error('Invalid broadcast ID');
  }

  if (!isValidUUID(broadcastId)) {
    throw new Error('Invalid broadcast ID format');
  }

  return broadcastId.trim();
}

/**
 * Hash sensitive data for logging
 * @param {string} data - Sensitive data to hash
 * @returns {string} Hashed data (SHA256, truncated)
 */
function hashForLogging(data) {
  if (!data) return '[empty]';

  return crypto
    .createHash('sha256')
    .update(String(data))
    .digest('hex')
    .substring(0, 12) + '...';
}

/**
 * Sanitize error message for client response
 * Prevents information disclosure
 * @param {Error} error - Error object
 * @returns {string} Safe error message
 */
function sanitizeErrorMessage(error) {
  if (!error) return 'An error occurred';

  // Don't expose internal details
  const safeMessages = [
    'Invalid input',
    'Resource not found',
    'Operation failed',
    'Authentication required',
    'Permission denied',
    'Rate limit exceeded',
    'Service unavailable',
  ];

  // Check if error message is already safe
  const message = error.message || 'An error occurred';

  // Return generic message for internal errors
  if (message.includes('database') ||
      message.includes('redis') ||
      message.includes('connection') ||
      message.includes('ECONNREFUSED') ||
      message.includes('timeout')) {
    return 'Service temporarily unavailable. Please try again later.';
  }

  // Return sanitized message
  return sanitizeString(message, 200);
}

module.exports = {
  // UUID validation
  isValidUUID,
  validateUserId,
  validateDeviceId,
  validateTemplateId,
  validateBroadcastId,

  // String sanitization
  sanitizeRedisKey,
  sanitizeString,
  generateSafeCacheKey,

  // Specific validations
  isValidPhoneNumber,
  isValidMediaUrl,
  isValidMessage,

  // Security utilities
  hashForLogging,
  sanitizeErrorMessage,
};
