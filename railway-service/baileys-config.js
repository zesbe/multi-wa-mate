/**
 * Baileys WhatsApp Socket Configuration
 * Creates and configures WhatsApp Web client connections
 */

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeInMemoryStore,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Logger configuration - reduce noise
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'hostname',
      translateTime: 'SYS:standard'
    }
  }
});

/**
 * Create auth state directory for a device
 */
function createAuthDir(deviceId) {
  const authDir = path.join(__dirname, 'auth_sessions', deviceId);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
  return authDir;
}

/**
 * Clear auth state for a device
 */
function clearAuthState(deviceId) {
  const authDir = path.join(__dirname, 'auth_sessions', deviceId);
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
    console.log(`🗑️ Cleared auth state for device ${deviceId}`);
  }
}

/**
 * Create Baileys WhatsApp socket with proper configuration
 */
async function createWhatsAppSocket(deviceId, options = {}) {
  try {
    const authDir = createAuthDir(deviceId);
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    // Get latest Baileys version for better compatibility
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: state,
      logger: logger.child({ device: deviceId }),
      printQRInTerminal: false, // We handle QR display ourselves
      browser: Browsers.ubuntu('Chrome'), // Mimic desktop browser
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false, // Don't sync full chat history
      defaultQueryTimeoutMs: 60000, // 60 second timeout
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000, // Keep connection alive
      getMessage: async (key) => {
        // Return stored message if available
        return { conversation: 'Message not found' };
      },
      ...options
    });

    // Return both socket and credential saver
    return { socket, saveCreds, authDir };
  } catch (error) {
    console.error(`❌ Error creating WhatsApp socket:`, error);
    throw error;
  }
}

/**
 * Get connection state from Baileys close event
 */
function getConnectionState(lastDisconnect) {
  const statusCode = lastDisconnect?.error?.output?.statusCode;

  if (!statusCode) {
    return { shouldReconnect: true, reason: 'Unknown' };
  }

  // Map Baileys disconnect reasons
  switch (statusCode) {
    case DisconnectReason.badSession:
      return { shouldReconnect: false, reason: 'Bad Session - Clear session and reconnect' };

    case DisconnectReason.connectionClosed:
      return { shouldReconnect: true, reason: 'Connection closed' };

    case DisconnectReason.connectionLost:
      return { shouldReconnect: true, reason: 'Connection lost' };

    case DisconnectReason.connectionReplaced:
      return { shouldReconnect: false, reason: 'Connection replaced by another device' };

    case DisconnectReason.loggedOut:
      return { shouldReconnect: false, reason: 'Logged out - Clear session and reconnect' };

    case DisconnectReason.restartRequired:
      return { shouldReconnect: true, reason: 'Restart required' };

    case DisconnectReason.timedOut:
      return { shouldReconnect: true, reason: 'Connection timed out' };

    case DisconnectReason.unavailableService:
      return { shouldReconnect: true, reason: 'Service unavailable' };

    default:
      return { shouldReconnect: true, reason: `Unknown (${statusCode})` };
  }
}

/**
 * Format phone number to WhatsApp JID format
 */
function formatPhoneNumber(phoneNumber) {
  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');

  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');

  // Add country code if not present (default to Indonesia +62)
  if (!cleaned.startsWith('62') && cleaned.length < 12) {
    cleaned = '62' + cleaned;
  }

  // Add @s.whatsapp.net suffix for regular numbers
  return cleaned + '@s.whatsapp.net';
}

/**
 * Check if number is registered on WhatsApp
 */
async function isRegisteredOnWhatsApp(socket, phoneNumber) {
  try {
    const jid = formatPhoneNumber(phoneNumber);
    const [result] = await socket.onWhatsApp(jid);
    return result?.exists || false;
  } catch (error) {
    console.error(`❌ Error checking WhatsApp registration:`, error);
    return false;
  }
}

/**
 * Send text message
 */
async function sendMessage(socket, phoneNumber, message) {
  try {
    const jid = formatPhoneNumber(phoneNumber);

    // Check if number is registered
    const isRegistered = await isRegisteredOnWhatsApp(socket, phoneNumber);
    if (!isRegistered) {
      throw new Error(`Number ${phoneNumber} is not registered on WhatsApp`);
    }

    await socket.sendMessage(jid, { text: message });
    return { success: true, jid };
  } catch (error) {
    console.error(`❌ Error sending message:`, error);
    throw error;
  }
}

/**
 * Send media message (image, document, etc.)
 */
async function sendMediaMessage(socket, phoneNumber, mediaData, mediaType = 'image', caption = '') {
  try {
    const jid = formatPhoneNumber(phoneNumber);

    // Check if number is registered
    const isRegistered = await isRegisteredOnWhatsApp(socket, phoneNumber);
    if (!isRegistered) {
      throw new Error(`Number ${phoneNumber} is not registered on WhatsApp`);
    }

    const messageData = {
      [mediaType]: mediaData.buffer || mediaData.url,
      caption: caption
    };

    if (mediaData.mimetype) {
      messageData.mimetype = mediaData.mimetype;
    }

    if (mediaData.filename) {
      messageData.fileName = mediaData.filename;
    }

    await socket.sendMessage(jid, messageData);
    return { success: true, jid };
  } catch (error) {
    console.error(`❌ Error sending media message:`, error);
    throw error;
  }
}

/**
 * Delay helper function
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  createWhatsAppSocket,
  clearAuthState,
  getConnectionState,
  formatPhoneNumber,
  isRegisteredOnWhatsApp,
  sendMessage,
  sendMediaMessage,
  delay,
  DisconnectReason
};
