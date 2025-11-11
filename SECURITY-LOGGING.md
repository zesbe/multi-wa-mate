# Secure Logging Best Practices

## Overview

This document outlines secure logging practices to prevent sensitive data leakage in logs.

## Security Issues with console.log

**Problems:**
- ❌ Exposes sensitive data (phone numbers, IDs, tokens) in logs
- ❌ No log level control
- ❌ Stack traces expose internal implementation details
- ❌ GDPR/privacy compliance issues
- ❌ Helps attackers understand system

**Impact:**
- Logs can be accessed by support staff, devops, attackers who breach systems
- Sensitive data becomes discoverable
- Compliance violations (GDPR Article 32 - data protection)

## Secure Logger Usage

### Import Logger

```javascript
const { logger } = require('./logger');
```

### Log Levels

```javascript
// ERROR - Critical issues (always logged)
logger.error('Failed to connect to database', error);

// WARN - Warning messages
logger.warn('Retry attempt 3 of 5');

// INFO - General information (default level)
logger.info('Device connected successfully');
logger.success('Broadcast completed');  // With ✅ emoji
logger.progress('Processing messages'); // With ⏳ emoji

// DEBUG - Detailed debugging (only in debug mode)
logger.debug('Socket state', socketData);
```

### Automatic Data Redaction

The logger automatically redacts:

✅ **Phone Numbers**
```javascript
logger.info('Message sent to +62812345678');
// Output: Message sent to [PHONE_REDACTED]
```

✅ **WhatsApp JIDs**
```javascript
logger.info('Contact:', '6281234567890@s.whatsapp.net');
// Output: Contact: [JID_REDACTED]
```

✅ **Email Addresses**
```javascript
logger.info('User:', 'user@example.com');
// Output: User: [EMAIL_REDACTED]
```

✅ **UUIDs**
```javascript
logger.info('Device ID:', '550e8400-e29b-41d4-a716-446655440000');
// Output: Device ID: [UUID_REDACTED]
```

✅ **JWT Tokens**
```javascript
logger.info('Token:', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
// Output: Token: [TOKEN_REDACTED]
```

✅ **Sensitive Object Keys**
```javascript
logger.info('User data', {
  name: 'John',
  phone: '+62812345',
  token: 'secret123',
  api_key: 'key123'
});
// Output: User data { name: 'John', phone: '[REDACTED]', token: '[REDACTED]', api_key: '[REDACTED]' }
```

### Environment Configuration

```bash
# .env file
LOG_LEVEL=info  # Options: error, warn, info, debug
NODE_ENV=production  # In production, stack traces are hidden
```

## Migration Guide

### Before (Insecure)

```javascript
console.log('Message from:', jid);
// Exposes: Message from: 6281234567890@s.whatsapp.net

console.log('User data:', {
  user_id: '123',
  phone: '+62812345678',
  api_key: 'secret_key'
});
// Exposes: All sensitive data

console.error('Error:', error);
// Exposes: Full stack trace in production
```

### After (Secure)

```javascript
logger.info('Message received from contact');
// Safer: No phone number exposed

logger.info('User operation completed');
// Safer: No IDs exposed

logger.error('Operation failed', error);
// Safer: Only error message in production, stack trace in dev only
```

## Examples

### ✅ GOOD - No Sensitive Data

```javascript
logger.success('Device connected successfully');
logger.info('Broadcast started for 100 contacts');
logger.warn('Media download retry attempt 2');
logger.error('Connection timeout', new Error('Timeout'));
```

### ⚠️ ACCEPTABLE - Auto-Redacted

```javascript
// These are OK because logger redacts automatically
logger.debug('Processing contact', { phone: '+62812345' });
logger.info('JID', '6281234567890@s.whatsapp.net');
```

### ❌ BAD - Never Do This

```javascript
// DON'T: Expose sensitive data
console.log('Phone:', phoneNumber);
console.log('API Key:', apiKey);
console.log('User ID:', userId);
console.log('Session:', sessionData);

// DON'T: Use console.log at all in production code
console.log('Debug info:', data);
```

## Code Review Checklist

Before committing code, check:

- [ ] No `console.log` for sensitive data
- [ ] Use `logger.info()` instead of `console.log()`
- [ ] Use `logger.error()` instead of `console.error()`
- [ ] Log messages are descriptive but don't expose PII
- [ ] Debug logs use `logger.debug()` (won't show in production)
- [ ] Error objects are passed to logger, not stringified

## Compliance

### GDPR Article 32 - Security of Processing

> "...implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk, including the pseudonymisation and encryption of personal data"

**Our Implementation:**
- ✅ Automatic PII redaction
- ✅ Configurable log levels
- ✅ Stack trace hiding in production
- ✅ Sensitive key masking

### SOC 2 Type II - Logging Controls

> "System logs should not contain sensitive information"

**Our Implementation:**
- ✅ No plaintext credentials
- ✅ No PII in logs
- ✅ Audit trail without sensitive data

## Testing Redaction

```javascript
// Test redaction functionality
const { redactSensitiveData } = require('./logger');

console.log(redactSensitiveData({
  name: 'John',
  phone: '+62812345678',
  email: 'john@example.com',
  api_key: 'secret123'
}));

// Output:
// {
//   name: 'John',
//   phone: '[REDACTED]',
//   email: '[REDACTED]',
//   api_key: '[REDACTED]'
// }
```

## Monitoring

### Check for Violations

```bash
# Find console.log usage (should be rare)
grep -r "console.log" railway-service/*.js | grep -v "node_modules"

# Find potential phone number leaks
grep -r "+62" railway-service/*.js | grep console
```

### Log Analysis

```bash
# Set debug level for troubleshooting
export LOG_LEVEL=debug
node index.js

# Production (minimal logs)
export LOG_LEVEL=error
node index.js
```

## Further Reading

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [GDPR Article 32](https://gdpr-info.eu/art-32-gdpr/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
