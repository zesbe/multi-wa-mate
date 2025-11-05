/**
 * Pairing Code Connection Manager
 * Handles WhatsApp connection via 8-digit pairing code
 */

const { createWhatsAppSocket, getConnectionState, clearAuthState } = require('./baileys-config');
const supabaseClient = require('./supabase-client');
const redisClient = require('./redis-client');

class ConnectionManagerPairing {
  constructor() {
    this.activeSockets = new Map(); // deviceId -> socket
    this.reconnectTimeouts = new Map(); // deviceId -> timeout
  }

  /**
   * Initialize pairing code connection for a device
   */
  async initConnection(deviceId, phoneNumber) {
    try {
      console.log(`📱 Initializing pairing connection for device: ${deviceId}`);

      // Validate phone number
      if (!phoneNumber || phoneNumber.length < 10) {
        throw new Error('Invalid phone number');
      }

      // Clear existing connection if any
      await this.disconnect(deviceId);

      // Update status to connecting
      await supabaseClient.updateDeviceStatus(deviceId, 'connecting');

      // Create WhatsApp socket
      const { socket, saveCreds } = await createWhatsAppSocket(deviceId);

      // Store socket
      this.activeSockets.set(deviceId, socket);

      // Setup event handlers before requesting pairing code
      this.setupSocketEvents(deviceId, socket, saveCreds);

      // Request pairing code
      // Format phone number: remove +, spaces, dashes
      const cleanedPhone = phoneNumber.replace(/[^0-9]/g, '');

      // Request pairing code from WhatsApp
      const code = await socket.requestPairingCode(cleanedPhone);

      console.log(`🔑 Pairing code generated for device ${deviceId}: ${code}`);

      // Format pairing code with dash (e.g., "1234-5678")
      const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;

      // Store in Redis (10 minutes TTL)
      await redisClient.setPairingCode(deviceId, formattedCode, 600);

      // Also update database for polling clients
      await supabaseClient.updateDeviceStatus(deviceId, 'connecting', {
        pairing_code: formattedCode,
        phone_number: cleanedPhone
      });

      return { success: true, pairingCode: formattedCode };
    } catch (error) {
      console.error(`❌ Failed to init pairing connection for ${deviceId}:`, error);
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
    // Connection update event
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      // Connection opened
      if (connection === 'open') {
        console.log(`✅ WhatsApp connected via pairing for device: ${deviceId}`);

        // Clear pairing code
        await redisClient.deletePairingCode(deviceId);

        // Get connection info
        const phoneNumber = socket.user?.id?.split(':')[0] || 'unknown';

        // Update device status
        await supabaseClient.updateDeviceStatus(deviceId, 'connected', {
          pairing_code: null,
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

        // Clear pairing code
        await redisClient.deletePairingCode(deviceId);

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
            pairing_code: null,
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

      // Get device info to retrieve phone number for pairing
      const device = await supabaseClient.getDevice(deviceId);
      if (!device || !device.phone_number) {
        console.error(`❌ Cannot reconnect: No phone number stored for device ${deviceId}`);
        return;
      }

      await this.initConnection(deviceId, device.phone_number);
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
   * Get current pairing code for a device
   */
  async getPairingCode(deviceId) {
    try {
      // Try Redis first (faster)
      let pairingCode = await redisClient.getPairingCode(deviceId);

      // Fallback to database
      if (!pairingCode) {
        const device = await supabaseClient.getDevice(deviceId);
        pairingCode = device?.pairing_code;
      }

      return pairingCode;
    } catch (error) {
      console.error(`❌ Failed to get pairing code:`, error);
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

      // Clear pairing code
      await redisClient.deletePairingCode(deviceId);

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

module.exports = new ConnectionManagerPairing();
