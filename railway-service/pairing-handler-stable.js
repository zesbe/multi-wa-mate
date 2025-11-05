/**
 * Stable Pairing Handler
 * Simplified and reliable pairing code implementation
 */

const redis = require('./redis-client');

class StablePairingHandler {
  constructor() {
    this.activeSessions = new Map();
  }

  /**
   * Generate pairing code with retry mechanism
   */
  async generatePairingCode(sock, device, supabase) {
    const deviceId = device.id;
    const deviceName = device.device_name || 'Unknown';

    try {
      // Check if already has active session
      if (this.hasActiveSession(deviceId)) {
        console.log(`⏱️ [${deviceName}] Already has active pairing session`);
        return false;
      }

      // Mark session as active
      this.activeSessions.set(deviceId, Date.now());

      // Get phone number
      const { data, error } = await supabase
        .from('devices')
        .select('phone_for_pairing, connection_method')
        .eq('id', deviceId)
        .single();

      if (error || !data || data.connection_method !== 'pairing' || !data.phone_for_pairing) {
        console.log(`❌ [${deviceName}] No pairing phone configured`);
        this.activeSessions.delete(deviceId);
        return false;
      }

      // Format phone number
      const phone = this.formatPhoneNumber(data.phone_for_pairing);
      if (!phone) {
        console.error(`❌ [${deviceName}] Invalid phone format: ${data.phone_for_pairing}`);
        this.activeSessions.delete(deviceId);
        await this.storePairingError(deviceId, `Invalid phone format: ${data.phone_for_pairing}`, supabase);
        return false;
      }

      console.log(`📱 [${deviceName}] Requesting pairing code for: ${phone}`);

      // Wait for socket to be ready with proper state check
      const isReady = await this.waitForSocket(sock, 15000);
      if (!isReady) {
        console.error(`❌ [${deviceName}] Socket not ready after 15 seconds`);
        console.error(`❌ [${deviceName}] Socket details:`, {
          exists: !!sock,
          hasWs: !!sock?.ws,
          wsState: sock?.ws?.readyState,
          hasAuthState: !!sock?.authState,
          hasPairingMethod: typeof sock?.requestPairingCode === 'function'
        });
        this.activeSessions.delete(deviceId);
        await this.storePairingError(deviceId, 'Socket not ready for pairing. Please try again.', supabase);
        return false;
      }

      // Request pairing code with retry mechanism
      let pairingCode;
      const maxRetries = 3;
      let lastError = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔐 [${deviceName}] Attempt ${attempt}/${maxRetries} to get pairing code...`);

          // Add small delay between retries
          if (attempt > 1) {
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          }

          // Request pairing code with timeout
          const codePromise = sock.requestPairingCode(phone);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
          );

          pairingCode = await Promise.race([codePromise, timeoutPromise]);

          // Success!
          if (pairingCode) {
            console.log(`✅ [${deviceName}] Got pairing code on attempt ${attempt}`);
            break;
          }

        } catch (err) {
          lastError = err;
          console.error(`❌ [${deviceName}] Attempt ${attempt} failed:`, err.message);

          // Handle rate limit - stop retrying
          if (err.message?.includes('rate') || err.message?.includes('429') || err.output?.statusCode === 429) {
            console.log(`🚫 [${deviceName}] Rate limited by WhatsApp`);
            await this.storePairingError(deviceId, 'Rate limited. Please wait 60 seconds and try again.', supabase);
            setTimeout(() => this.activeSessions.delete(deviceId), 60000);
            return false;
          }

          // If last attempt, give up
          if (attempt === maxRetries) {
            console.error(`❌ [${deviceName}] All ${maxRetries} attempts failed`);
            const errorMsg = err.message || 'Failed to generate pairing code';
            await this.storePairingError(deviceId, errorMsg, supabase);
            this.activeSessions.delete(deviceId);
            return false;
          }
        }
      }

      // Validate pairing code
      if (!pairingCode) {
        console.error(`❌ [${deviceName}] No pairing code received after ${maxRetries} attempts`);
        this.activeSessions.delete(deviceId);
        await this.storePairingError(deviceId, lastError?.message || 'No pairing code received', supabase);
        return false;
      }

      // Format the code properly
      const formattedCode = this.formatPairingCode(pairingCode);
      console.log(`✅ [${deviceName}] Pairing code: ${formattedCode}`);

      // Store in Redis (optional cache)
      try {
        await redis.setPairingCode(deviceId, formattedCode, 600); // 10 min TTL
        console.log(`📦 [${deviceName}] Code cached in Redis`);
      } catch (err) {
        // Redis error is not critical since we store in Supabase
        console.warn(`⚠️ [${deviceName}] Redis cache failed (non-critical):`, err.message);
      }

      // Update database - this is the primary storage
      // Use 'connecting' status so frontend can detect pairing code
      await supabase
        .from('devices')
        .update({
          pairing_code: formattedCode,
          status: 'connecting',
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);

      console.log(`✅ [${deviceName}] Pairing code saved to database`);

      // Print instructions
      this.printInstructions(deviceName, phone, formattedCode);

      // Auto cleanup after 10 minutes (pairing code expires)
      setTimeout(() => {
        this.activeSessions.delete(deviceId);
        console.log(`🧹 [${deviceName}] Pairing session cleared (timeout)`);
      }, 600000);

      return true;

    } catch (error) {
      console.error(`❌ [${deviceName}] Unexpected error:`, error);
      this.activeSessions.delete(deviceId);
      await this.storePairingError(deviceId, error.message || 'Unexpected error', supabase);
      return false;
    }
  }

  /**
   * Check if device has active session
   */
  hasActiveSession(deviceId) {
    const session = this.activeSessions.get(deviceId);
    if (!session) return false;
    
    // Session expires after 60 seconds
    const age = Date.now() - session;
    if (age > 60000) {
      this.activeSessions.delete(deviceId);
      return false;
    }
    
    return true;
  }

  /**
   * Format phone number to WhatsApp format
   */
  formatPhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-digits
    let digits = String(phone).replace(/\D/g, '');
    
    // Handle Indonesian numbers
    if (digits.startsWith('0')) {
      digits = '62' + digits.slice(1);
    } else if (digits.startsWith('8') && digits.length <= 12) {
      digits = '62' + digits;
    } else if (!digits.startsWith('62') && digits.length <= 12) {
      digits = '62' + digits;
    }
    
    // Validate length
    if (digits.length < 10 || digits.length > 15) {
      return null;
    }
    
    return digits;
  }

  /**
   * Format pairing code for display
   */
  formatPairingCode(code) {
    if (!code) return null;
    
    // Clean the code
    const cleaned = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Format as XXXX-XXXX for 8 chars
    if (cleaned.length === 8) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    }
    
    // Return as-is for other lengths
    return cleaned;
  }

  /**
   * Wait for socket to be ready with proper state checks
   */
  async waitForSocket(sock, maxWait = 15000) {
    const start = Date.now();

    console.log('⏳ Waiting for socket to be ready...');

    while (Date.now() - start < maxWait) {
      try {
        // Check if socket exists
        if (!sock) {
          console.log('⏳ Socket not initialized yet...');
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        // Check if requestPairingCode method exists
        if (typeof sock.requestPairingCode !== 'function') {
          console.log('⏳ requestPairingCode method not available yet...');
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        // Check websocket connection state
        // WebSocket.OPEN = 1 means connection is ready
        if (sock.ws && sock.ws.readyState === 1) {
          // Additional check: make sure socket is actually connected
          if (sock.authState && sock.authState.creds) {
            console.log('✅ Socket is ready (WebSocket OPEN + Auth state available)');
            return true;
          }
        }

        // Check if socket is in CONNECTING state
        const wsState = sock.ws?.readyState;
        const wsStateNames = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];

        // If WebSocket is OPEN and auth state exists, we're good
        if (wsState === 1 && sock.authState) {
          console.log('✅ Socket is ready (WebSocket OPEN)');
          return true;
        }

        // If WebSocket is still CONNECTING (0), keep waiting
        if (wsState === 0) {
          console.log(`⏳ Socket state: WebSocket=CONNECTING, waiting...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // If WebSocket is CLOSED or CLOSING, socket failed
        if (wsState === 2 || wsState === 3) {
          console.error(`❌ Socket state: WebSocket=${wsStateNames[wsState]}, socket failed`);
          return false;
        }

        // Log current state for debugging
        console.log(`⏳ Socket state: WebSocket=${wsStateNames[wsState] || 'N/A'}, AuthState=${!!sock.authState}, waiting...`);

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (err) {
        console.log('⚠️ Error checking socket state:', err.message);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.error('❌ Socket not ready after timeout');
    return false;
  }

  /**
   * Store error message
   */
  async storePairingError(deviceId, message, supabase) {
    try {
      await supabase
        .from('devices')
        .update({
          status: 'error',
          error_message: message,
          pairing_code: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);
    } catch (err) {
      console.error('Failed to store error:', err);
    }
  }

  /**
   * Print pairing instructions
   */
  printInstructions(deviceName, phone, code) {
    console.log('\n' + '='.repeat(50));
    console.log(`📱 DEVICE: ${deviceName}`);
    console.log(`📞 PHONE: ${phone}`);
    console.log(`🔑 CODE: ${code}`);
    console.log('='.repeat(50));
    console.log('Instructions:');
    console.log('1. Open WhatsApp on phone number above');
    console.log('2. Go to Settings → Linked Devices');
    console.log('3. Tap "Link a Device"');
    console.log('4. Select "Link with phone number"'); 
    console.log('5. Enter the code above');
    console.log('='.repeat(50) + '\n');
  }

  /**
   * Clear all sessions
   */
  clearAll() {
    const count = this.activeSessions.size;
    this.activeSessions.clear();
    if (count > 0) {
      console.log(`🧹 Cleared ${count} pairing sessions`);
    }
  }

  /**
   * Clear specific device session
   */
  clearDevice(deviceId) {
    if (this.activeSessions.delete(deviceId)) {
      console.log(`🧹 Cleared pairing session for device: ${deviceId}`);
    }
  }
}

// Export singleton instance
module.exports = new StablePairingHandler();