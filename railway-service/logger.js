/**
 * Secure Logger with Sensitive Data Redaction
 * Prevents logging of sensitive information like phone numbers, IDs, tokens
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

/**
 * Redact sensitive information from log data
 * @param {any} data - Data to sanitize
 * @returns {any} Sanitized data
 */
function redactSensitiveData(data) {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle strings
  if (typeof data === 'string') {
    // Redact phone numbers (various formats)
    data = data.replace(/\+?[\d\s\-\(\)]{8,}/g, '[PHONE_REDACTED]');

    // Redact JIDs (WhatsApp IDs like 6281234567890@s.whatsapp.net)
    data = data.replace(/\d{10,}@[sg]\.whatsapp\.net/g, '[JID_REDACTED]');

    // Redact email addresses
    data = data.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');

    // Redact UUIDs
    data = data.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '[UUID_REDACTED]');

    // Redact JWT tokens
    data = data.replace(/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[TOKEN_REDACTED]');

    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item));
  }

  // Handle objects
  if (typeof data === 'object') {
    const sanitized = {};
    const sensitiveKeys = [
      'password', 'token', 'apiKey', 'api_key', 'secret', 'auth',
      'phone', 'phone_number', 'phoneNumber', 'jid', 'email',
      'user_id', 'userId', 'session_data', 'sessionData',
      'credentials', 'authorization'
    ];

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();

      // Redact sensitive keys entirely
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else {
        // Recursively sanitize nested objects
        sanitized[key] = redactSensitiveData(value);
      }
    }

    return sanitized;
  }

  return data;
}

/**
 * Format log message with timestamp and level
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @returns {string} Formatted message
 */
function formatMessage(level, message) {
  const timestamp = new Date().toISOString();
  const levelUpper = level.toUpperCase().padEnd(5);
  return `[${timestamp}] [${levelUpper}] ${message}`;
}

/**
 * Logger class with redaction
 */
class Logger {
  constructor(level = LOG_LEVEL) {
    this.level = LOG_LEVELS[level] || LOG_LEVELS.info;
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {any} data - Additional data (will be redacted)
   */
  error(message, data = null) {
    if (this.level >= LOG_LEVELS.error) {
      const formatted = formatMessage('error', message);

      if (data) {
        if (data instanceof Error) {
          // Log error message but redact stack trace in production
          console.error(formatted, {
            message: data.message,
            name: data.name,
            // Only include stack in development
            ...(process.env.NODE_ENV === 'development' && { stack: data.stack })
          });
        } else {
          console.error(formatted, redactSensitiveData(data));
        }
      } else {
        console.error(formatted);
      }
    }
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {any} data - Additional data (will be redacted)
   */
  warn(message, data = null) {
    if (this.level >= LOG_LEVELS.warn) {
      const formatted = formatMessage('warn', message);

      if (data) {
        console.warn(formatted, redactSensitiveData(data));
      } else {
        console.warn(formatted);
      }
    }
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {any} data - Additional data (will be redacted)
   */
  info(message, data = null) {
    if (this.level >= LOG_LEVELS.info) {
      const formatted = formatMessage('info', message);

      if (data) {
        console.log(formatted, redactSensitiveData(data));
      } else {
        console.log(formatted);
      }
    }
  }

  /**
   * Log debug message (only in debug mode)
   * @param {string} message - Debug message
   * @param {any} data - Additional data (will be redacted)
   */
  debug(message, data = null) {
    if (this.level >= LOG_LEVELS.debug) {
      const formatted = formatMessage('debug', message);

      if (data) {
        console.log(formatted, redactSensitiveData(data));
      } else {
        console.log(formatted);
      }
    }
  }

  /**
   * Log success message with emoji
   * @param {string} message - Success message
   */
  success(message) {
    if (this.level >= LOG_LEVELS.info) {
      const formatted = formatMessage('info', `✅ ${message}`);
      console.log(formatted);
    }
  }

  /**
   * Log progress message
   * @param {string} message - Progress message
   */
  progress(message) {
    if (this.level >= LOG_LEVELS.info) {
      const formatted = formatMessage('info', `⏳ ${message}`);
      console.log(formatted);
    }
  }
}

// Export singleton instance
const logger = new Logger();

module.exports = {
  logger,
  Logger,
  redactSensitiveData
};
