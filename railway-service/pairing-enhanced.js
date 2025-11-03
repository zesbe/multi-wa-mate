const { makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');

/**
 * Enhanced Pairing handler with WhatsApp notification support
 * Based on latest Baileys implementation
 */
class PairingHandler {
  constructor(redis) {
    this.redis = redis;
    this.activePairings = new Map();
    this.pairingTimeouts = new Map();
  }

  /**
   * Generate and handle pairing code with proper notification flow
   */
  async generatePairingCode(sock, device, supabase) {
    try {
      // Check if already registered
      if (sock.authState?.creds?.registered) {
        console.log('✅ Device already registered, skipping pairing');
        return { success: false, reason: 'already_registered' };
      }

      // Get device configuration
      const { data: deviceData, error } = await supabase
        .from('devices')
        .select('connection_method, phone_for_pairing, status')
        .eq('id', device.id)
        .single();

      if (error || !deviceData) {
        console.error('❌ Error fetching device:', error);
        return { success: false, reason: 'fetch_error', error };
      }

      // Validate pairing configuration
      if (deviceData.connection_method !== 'pairing' || !deviceData.phone_for_pairing) {
        console.log('📱 Device not configured for pairing');
        return { success: false, reason: 'not_configured' };
      }

      // Check if we already have an active pairing for this device
      if (this.activePairings.has(device.id)) {
        const existing = this.activePairings.get(device.id);
        const elapsed = (Date.now() - existing.timestamp) / 1000;
        
        if (elapsed < 60) {
          console.log(`⏱️ Active pairing exists (${elapsed.toFixed(0)}s old): ${existing.code}`);
          return { 
            success: true, 
            code: existing.code,
            phone: existing.phone,
            cached: true 
          };
        }
      }

      // Format phone number
      const phoneNumber = this.formatPhoneNumber(deviceData.phone_for_pairing);
      if (!phoneNumber) {
        console.error('❌ Invalid phone number format:', deviceData.phone_for_pairing);
        await this.updateDeviceError(supabase, device.id, 'Invalid phone number format');
        return { success: false, reason: 'invalid_phone' };
      }

      console.log(`📱 Generating pairing code for: ${phoneNumber}`);

      // Clear any existing timeout
      if (this.pairingTimeouts.has(device.id)) {
        clearTimeout(this.pairingTimeouts.get(device.id));
        this.pairingTimeouts.delete(device.id);
      }

      try {
        // Wait a bit for socket to stabilize
        await this.delay(1500);

        // Check socket is ready
        if (!sock || typeof sock.requestPairingCode !== 'function') {
          console.error('❌ Socket not ready for pairing');
          return { success: false, reason: 'socket_not_ready' };
        }

        console.log('🔐 Requesting pairing code from WhatsApp...');
        
        // Request pairing code with proper timeout
        const codePromise = sock.requestPairingCode(phoneNumber);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Pairing request timeout (30s)')), 30000)
        );

        const pairingCode = await Promise.race([codePromise, timeoutPromise]);

        if (!pairingCode) {
          throw new Error('No pairing code received from WhatsApp');
        }

        // Format pairing code (should be 8 chars, format: XXXX-XXXX)
        const formattedCode = this.formatPairingCode(pairingCode);
        
        console.log('');
        console.log('╔═══════════════════════════════════════════════════════╗');
        console.log('║             📱 PAIRING CODE GENERATED                 ║');
        console.log('╠═══════════════════════════════════════════════════════╣');
        console.log(`║ Code: ${formattedCode.padEnd(47)}║`);
        console.log(`║ Phone: ${phoneNumber.padEnd(46)}║`);
        console.log('╠═══════════════════════════════════════════════════════╣');
        console.log('║ Instructions:                                         ║');
        console.log('║ 1. Open WhatsApp on your phone                       ║');
        console.log('║ 2. You should receive a notification                 ║');
        console.log('║ 3. If no notification:                               ║');
        console.log('║    - Go to Settings > Linked Devices                 ║');
        console.log('║    - Tap "Link with phone number"                    ║');
        console.log(`║    - Enter: ${phoneNumber.padEnd(41)}║`);
        console.log(`║    - Enter code: ${formattedCode.padEnd(36)}║`);
        console.log('║ 4. Wait for connection confirmation                  ║');
        console.log('╚═══════════════════════════════════════════════════════╝');
        console.log('');

        // Store pairing info
        const pairingInfo = {
          code: pairingCode,
          formattedCode: formattedCode,
          phone: phoneNumber,
          timestamp: Date.now()
        };

        this.activePairings.set(device.id, pairingInfo);

        // Store in Redis (5 minute TTL)
        await this.redis.setPairingCode(device.id, formattedCode, 300);

        // Update database
        await supabase
          .from('devices')
          .update({
            status: 'connecting',
            pairing_code: formattedCode,
            updated_at: new Date().toISOString()
          })
          .eq('id', device.id);

        // Set up auto-cleanup after 5 minutes
        const cleanupTimeout = setTimeout(() => {
          this.cleanupPairing(device.id);
        }, 300000);

        this.pairingTimeouts.set(device.id, cleanupTimeout);

        // Monitor for successful pairing
        this.monitorPairingSuccess(sock, device, supabase);

        return { 
          success: true, 
          code: pairingCode,
          formattedCode: formattedCode,
          phone: phoneNumber 
        };

      } catch (error) {
        console.error('❌ Pairing code generation failed:', error);
        
        // Check for specific error types
        if (error.message?.includes('timeout')) {
          await this.updateDeviceError(supabase, device.id, 'Pairing request timeout - please try again');
        } else if (error.data?.status === 428) {
          // Precondition required - need to wait
          console.log('⏳ WhatsApp requires waiting before next attempt...');
          await this.updateDeviceError(supabase, device.id, 'Please wait 1 minute before trying again');
        } else {
          await this.updateDeviceError(supabase, device.id, error.message || 'Pairing failed');
        }

        return { 
          success: false, 
          reason: 'generation_failed',
          error: error.message 
        };
      }

    } catch (error) {
      console.error('❌ Unexpected error in pairing handler:', error);
      return { 
        success: false, 
        reason: 'unexpected_error',
        error: error.message 
      };
    }
  }

  /**
   * Monitor for successful pairing completion
   */
  monitorPairingSuccess(sock, device, supabase) {
    let checkCount = 0;
    const maxChecks = 150; // 5 minutes (2 sec intervals)

    const checkInterval = setInterval(async () => {
      checkCount++;

      // Check if authenticated
      if (sock.authState?.creds?.registered && sock.user) {
        console.log('');
        console.log('🎉 PAIRING SUCCESSFUL!');
        console.log(`📱 Device connected: ${sock.user.id}`);
        console.log('');

        // Clear interval
        clearInterval(checkInterval);

        // Cleanup pairing data
        this.cleanupPairing(device.id);

        // Update device status
        try {
          await supabase
            .from('devices')
            .update({
              status: 'connected',
              pairing_code: null,
              phone_number: sock.user.id.split(':')[0],
              last_connected_at: new Date().toISOString()
            })
            .eq('id', device.id);

          console.log('✅ Device status updated to connected');
        } catch (error) {
          console.error('❌ Failed to update device status:', error);
        }

        return;
      }

      // Stop checking after max attempts
      if (checkCount >= maxChecks) {
        console.log('⏰ Pairing monitoring timeout (5 minutes)');
        clearInterval(checkInterval);
        this.cleanupPairing(device.id);
      }
    }, 2000);
  }

  /**
   * Format phone number to E.164 format
   */
  formatPhoneNumber(phone) {
    if (!phone) return null;

    // Remove all non-digits
    let digits = String(phone).replace(/\D/g, '');

    // Handle Indonesian numbers
    if (digits.startsWith('0')) {
      digits = '62' + digits.slice(1);
    } else if (digits.startsWith('8')) {
      // If starts with 8, assume it's Indonesian number without 0
      digits = '62' + digits;
    }

    // Add Indonesia country code if missing
    if (digits.length <= 12 && !digits.startsWith('62')) {
      digits = '62' + digits;
    }

    // Validate length (10-15 digits)
    if (digits.length < 10 || digits.length > 15) {
      console.error(`Invalid phone length: ${digits.length} digits`);
      return null;
    }

    return digits;
  }

  /**
   * Format pairing code for display
   */
  formatPairingCode(code) {
    if (!code) return code;
    
    // Remove any existing formatting
    const clean = code.replace(/[^A-Z0-9]/g, '');
    
    // If 8 characters, format as XXXX-XXXX
    if (clean.length === 8) {
      return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    }
    
    return clean;
  }

  /**
   * Clean up pairing data
   */
  cleanupPairing(deviceId) {
    this.activePairings.delete(deviceId);
    
    if (this.pairingTimeouts.has(deviceId)) {
      clearTimeout(this.pairingTimeouts.get(deviceId));
      this.pairingTimeouts.delete(deviceId);
    }
  }

  /**
   * Update device with error status
   */
  async updateDeviceError(supabase, deviceId, errorMessage) {
    try {
      await supabase
        .from('devices')
        .update({
          status: 'error',
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);
    } catch (error) {
      console.error('Failed to update device error:', error);
    }
  }

  /**
   * Helper delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PairingHandler;