/**
 * QR Code Connection Manager
 * Handles WhatsApp connection via QR code scanning
 */

const QRCode = require('qrcode');
const { createWhatsAppSocket, getConnectionState, clearAuthState } = require('./baileys-config');
const supabaseClient = require('./supabase-client');
const redisClient = require('./redis-client');

class ConnectionManagerQR {
  constructor() {
    this.activeSockets = new Map(); // deviceId -> socket
    this.reconnectTimeouts = new Map(); // deviceId -> timeout
  }

  /**
   * Initialize QR code connection for a device
   */
  async initConnection(deviceId) {
    try {
      console.log(`📱 Initializing QR connection for device: ${deviceId}`);

      // Clear existing connection if any
      await this.disconnect(deviceId);

      // Update status to connecting
      await supabaseClient.updateDeviceStatus(deviceId, 'connecting');

      // Create WhatsApp socket
      const { socket, saveCreds } = await createWhatsAppSocket(deviceId);

      // Store socket
      this.activeSockets.set(deviceId, socket);

      // Setup event handlers
      this.setupSocketEvents(deviceId, socket, saveCreds);

      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to init QR connection for ${deviceId}:`, error);
      await supabaseClient.updateDeviceStatus(deviceId, 'disconnected', {
        error_message: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Setup socket event handlers
   */
  setupSocketEvents(deviceId, socket, saveCreds) {
    // QR Code event
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Generate and store QR code
      if (qr) {
        try {
          console.log(`📲 QR Code generated for device: ${deviceId}`);

          // Generate QR code as data URL
          const qrDataURL = await QRCode.toDataURL(qr);

          // Store in Redis (10 minutes TTL)
          await redisClient.setQRCode(deviceId, qrDataURL, 600);

          // Also update database for polling clients
          await supabaseClient.updateDeviceStatus(deviceId, 'connecting', {
            qr_code: qrDataURL
          });

          console.log(`✅ QR Code stored for device: ${deviceId}`);
        } catch (error) {
          console.error(`❌ Failed to generate QR code:`, error);
        }
      }

      // Connection opened
      if (connection === 'open') {
        console.log(`✅ WhatsApp connected for device: ${deviceId}`);

        // Clear QR code
        await redisClient.deleteQRCode(deviceId);

        // Get connection info
        const phoneNumber = socket.user?.id?.split(':')[0] || 'unknown';

        // Update device status
        await supabaseClient.updateDeviceStatus(deviceId, 'connected', {
          qr_code: null,
          phone_number: phoneNumber,
          error_message: null
        });

        // Clear reconnect timeout
        this.clearReconnectTimeout(deviceId);

        console.log(`📞 Phone number: ${phoneNumber}`);
      }

      // Connection closed
      if (connection === 'close') {
        console.log(`⚠️ Connection closed for device: ${deviceId}`);

        const state = getConnectionState(lastDisconnect);
        console.log(`Disconnect reason: ${state.reason}`);

        // Clear QR code
        await redisClient.deleteQRCode(deviceId);

        if (state.shouldReconnect) {
          // Update status to reconnecting
          await supabaseClient.updateDeviceStatus(deviceId, 'reconnecting', {
            error_message: state.reason
          });

          // Schedule reconnection (with exponential backoff)
          this.scheduleReconnect(deviceId, 5000);
        } else {
          // Permanent disconnect - clear session
          await this.clearSession(deviceId);
          await supabaseClient.updateDeviceStatus(deviceId, 'disconnected', {
            qr_code: null,
            error_message: state.reason
          });
        }

        // Remove from active sockets
        this.activeSockets.delete(deviceId);
      }
    });

    // Credentials update event - save to auth state
    socket.ev.on('creds.update', saveCreds);

    // Messages event - for receiving messages
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const message of messages) {
        // Skip own messages
        if (message.key.fromMe) continue;

        console.log(`📨 New message for device ${deviceId}`);

        // Get device info
        const device = await supabaseClient.getDevice(deviceId);
        if (!device) continue;

        // Save to message history
        await supabaseClient.saveMessage(deviceId, device.user_id, message);

        // TODO: Process chatbot rules here
        // TODO: Trigger webhooks here
      }
    });

    // Handle errors
    socket.ev.on('error', (error) => {
      console.error(`❌ Socket error for device ${deviceId}:`, error);
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect(deviceId, delay = 5000) {
    this.clearReconnectTimeout(deviceId);

    const timeout = setTimeout(async () => {
      console.log(`🔄 Attempting to reconnect device: ${deviceId}`);
      await this.initConnection(deviceId);
    }, delay);

    this.reconnectTimeouts.set(deviceId, timeout);
  }

  /**
   * Clear reconnect timeout
   */
  clearReconnectTimeout(deviceId) {
    const timeout = this.reconnectTimeouts.get(deviceId);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(deviceId);
    }
  }

  /**
   * Get current QR code for a device
   */
  async getQRCode(deviceId) {
    try {
      // Try Redis first (faster)
      let qrCode = await redisClient.getQRCode(deviceId);

      // Fallback to database
      if (!qrCode) {
        const device = await supabaseClient.getDevice(deviceId);
        qrCode = device?.qr_code;
      }

      return qrCode;
    } catch (error) {
      console.error(`❌ Failed to get QR code:`, error);
      return null;
    }
  }

  /**
   * Disconnect device
   */
  async disconnect(deviceId) {
    try {
      console.log(`🔌 Disconnecting device: ${deviceId}`);

      // Clear reconnect timeout
      this.clearReconnectTimeout(deviceId);

      // Get socket
      const socket = this.activeSockets.get(deviceId);

      if (socket) {
        // Close socket gracefully
        await socket.logout();
        this.activeSockets.delete(deviceId);
      }

      // Clear QR code
      await redisClient.deleteQRCode(deviceId);

      console.log(`✅ Device disconnected: ${deviceId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to disconnect device:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear session and auth data
   */
  async clearSession(deviceId) {
    try {
      console.log(`🗑️ Clearing session for device: ${deviceId}`);

      // Disconnect first
      await this.disconnect(deviceId);

      // Clear auth state
      clearAuthState(deviceId);

      // Clear database session
      await supabaseClient.clearSession(deviceId);

      // Clear Redis data
      await redisClient.cleanupDevice(deviceId);

      console.log(`✅ Session cleared for device: ${deviceId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to clear session:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get socket for a device
   */
  getSocket(deviceId) {
    return this.activeSockets.get(deviceId);
  }

  /**
   * Check if device is connected
   */
  isConnected(deviceId) {
    const socket = this.activeSockets.get(deviceId);
    return socket && socket.user ? true : false;
  }

  /**
   * Get all active connections
   */
  getActiveConnections() {
    return Array.from(this.activeSockets.keys());
  }
}

module.exports = new ConnectionManagerQR();
