/**
 * Stable Pairing Handler - FIXED VERSION
 * Perbaikan untuk masalah pairing code yang hanya bisa digunakan sekali
 */

const redis = require('./redis-client');

class StablePairingHandler {
  constructor() {
    this.activeSessions = new Map();
    this.lastPairingAttempt = new Map(); // Track last attempt per device
    this.pairingCooldown = 30000; // 30 seconds cooldown between attempts
  }

  /**
   * Generate pairing code dengan perbaikan
   */
  async generatePairingCode(sock, device, supabase) {
    const deviceId = device.id;
    const deviceName = device.device_name || 'Unknown';
    
    try {
      // Check cooldown instead of blocking completely
      if (this.isInCooldown(deviceId)) {
        const remainingTime = this.getRemainingCooldown(deviceId);
        console.log(`⏱️ [${deviceName}] Cooldown aktif. Tunggu ${Math.ceil(remainingTime/1000)} detik`);
        
        // Update error message in database
        await this.storePairingError(
          deviceId, 
          `Tunggu ${Math.ceil(remainingTime/1000)} detik untuk mencoba lagi`, 
          supabase
        );
        return false;
      }
      
      // Clear any existing session for fresh start
      this.clearDevice(deviceId);
      
      // Mark new session
      this.activeSessions.set(deviceId, {
        startTime: Date.now(),
        status: 'generating'
      });
      
      // Set last attempt time
      this.lastPairingAttempt.set(deviceId, Date.now());
      
      // Get phone number
      const { data, error } = await supabase
        .from('devices')
        .select('phone_for_pairing, connection_method')
        .eq('id', deviceId)
        .single();
        
      if (error || !data || data.connection_method !== 'pairing' || !data.phone_for_pairing) {
        console.log(`❌ [${deviceName}] No pairing phone configured`);
        this.clearDevice(deviceId);
        return false;
      }
      
      // Format phone number
      const phone = this.formatPhoneNumber(data.phone_for_pairing);
      if (!phone) {
        console.error(`❌ [${deviceName}] Invalid phone format: ${data.phone_for_pairing}`);
        this.clearDevice(deviceId);
        return false;
      }
      
      console.log(`📱 [${deviceName}] Requesting pairing code untuk: ${phone}`);
      
      // Wait for socket to be ready
      await this.waitForSocket(sock, 3000);
      
      // Update session status
      const session = this.activeSessions.get(deviceId);
      if (session) {
        session.status = 'requesting';
      }
      
      // Request pairing code dengan retry logic
      let pairingCode;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries && !pairingCode) {
        try {
          if (retryCount > 0) {
            console.log(`🔄 [${deviceName}] Retry ${retryCount}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s between retries
          }
          
          // Request dengan timeout yang reasonable
          const codePromise = sock.requestPairingCode(phone);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 15000) // 15 seconds timeout
          );
          
          pairingCode = await Promise.race([codePromise, timeoutPromise]);
          
          if (pairingCode) break;
          
        } catch (err) {
          console.error(`❌ [${deviceName}] Attempt ${retryCount + 1} failed:`, err.message);
          
          // Handle specific errors
          if (err.message?.includes('rate') || err.output?.statusCode === 429) {
            // Rate limit - need longer cooldown
            this.lastPairingAttempt.set(deviceId, Date.now());
            this.pairingCooldown = 60000; // Increase to 60s for rate limit
            
            await this.storePairingError(
              deviceId, 
              'Rate limited. Tunggu 60 detik sebelum mencoba lagi.', 
              supabase
            );
            
            this.clearDevice(deviceId);
            return false;
          }
          
          retryCount++;
          
          if (retryCount > maxRetries) {
            await this.storePairingError(
              deviceId, 
              `Gagal setelah ${maxRetries} percobaan: ${err.message}`, 
              supabase
            );
            this.clearDevice(deviceId);
            return false;
          }
        }
      }
      
      // Validate and format code
      if (!pairingCode) {
        console.error(`❌ [${deviceName}] No pairing code received after retries`);
        await this.storePairingError(deviceId, 'Tidak ada kode yang diterima', supabase);
        this.clearDevice(deviceId);
        return false;
      }
      
      // Format the code properly
      const formattedCode = this.formatPairingCode(pairingCode);
      console.log(`✅ [${deviceName}] Pairing code berhasil: ${formattedCode}`);
      
      // Update session status
      if (session) {
        session.status = 'code_received';
        session.code = formattedCode;
      }
      
      // Store in Redis dengan TTL lebih pendek
      try {
        await redis.setPairingCode(deviceId, formattedCode, 300); // 5 min TTL
        console.log(`📦 [${deviceName}] Code stored in Redis`);
      } catch (err) {
        console.error(`❌ [${deviceName}] Redis error:`, err);
      }
      
      // Update database
      await supabase
        .from('devices')
        .update({
          pairing_code: formattedCode,
          status: 'waiting_pairing',
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);
      
      // Print instructions
      this.printInstructions(deviceName, phone, formattedCode);
      
      // Set shorter auto cleanup - 90 seconds
      setTimeout(() => {
        const currentSession = this.activeSessions.get(deviceId);
        if (currentSession && currentSession.code === formattedCode) {
          this.clearDevice(deviceId);
          console.log(`🧹 [${deviceName}] Pairing session auto-cleared after 90s`);
        }
      }, 90000);
      
      return true;
      
    } catch (error) {
      console.error(`❌ [${deviceName}] Unexpected error:`, error);
      this.clearDevice(deviceId);
      return false;
    }
  }

  /**
   * Check if device is in cooldown period
   */
  isInCooldown(deviceId) {
    const lastAttempt = this.lastPairingAttempt.get(deviceId);
    if (!lastAttempt) return false;
    
    const elapsed = Date.now() - lastAttempt;
    return elapsed < this.pairingCooldown;
  }
  
  /**
   * Get remaining cooldown time
   */
  getRemainingCooldown(deviceId) {
    const lastAttempt = this.lastPairingAttempt.get(deviceId);
    if (!lastAttempt) return 0;
    
    const elapsed = Date.now() - lastAttempt;
    const remaining = this.pairingCooldown - elapsed;
    
    return Math.max(0, remaining);
  }

  /**
   * Check if device has active session (UPDATED)
   */
  hasActiveSession(deviceId) {
    const session = this.activeSessions.get(deviceId);
    if (!session) return false;
    
    // Session expires after 90 seconds (reduced from 120)
    const age = Date.now() - session.startTime;
    if (age > 90000) {
      this.clearDevice(deviceId);
      return false;
    }
    
    // Check if session is in valid state
    return session.status === 'generating' || session.status === 'requesting';
  }
  
  /**
   * Handle successful pairing - IMPORTANT!
   */
  onPairingSuccess(deviceId) {
    console.log(`✅ Pairing successful for device ${deviceId}`);
    this.clearDevice(deviceId);
    // Reset cooldown on success
    this.lastPairingAttempt.delete(deviceId);
    this.pairingCooldown = 30000; // Reset to default
  }
  
  /**
   * Handle pairing failure
   */
  onPairingFailure(deviceId) {
    console.log(`❌ Pairing failed for device ${deviceId}`);
    this.clearDevice(deviceId);
    // Keep cooldown on failure
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
   * Wait for socket to be ready
   */
  async waitForSocket(sock, maxWait = 5000) {
    const start = Date.now();
    
    while (Date.now() - start < maxWait) {
      if (sock && typeof sock.requestPairingCode === 'function') {
        // Socket is ready
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error('Socket not ready');
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
    console.log('📋 Instruksi:');
    console.log('1. Buka WhatsApp di nomor telepon di atas');
    console.log('2. Masuk ke Pengaturan → Perangkat Tertaut');
    console.log('3. Klik "Tautkan Perangkat"');
    console.log('4. Pilih "Tautkan dengan nomor telepon"'); 
    console.log('5. Masukkan kode di atas');
    console.log('⏰ Kode berlaku selama 5 menit');
    console.log('='.repeat(50) + '\n');
  }

  /**
   * Clear all sessions
   */
  clearAll() {
    const count = this.activeSessions.size;
    this.activeSessions.clear();
    this.lastPairingAttempt.clear();
    this.pairingCooldown = 30000; // Reset to default
    if (count > 0) {
      console.log(`🧹 Cleared ${count} pairing sessions`);
    }
  }

  /**
   * Clear specific device session (UPDATED)
   */
  clearDevice(deviceId) {
    const deleted = this.activeSessions.delete(deviceId);
    if (deleted) {
      console.log(`🧹 Cleared pairing session for device: ${deviceId}`);
    }
    return deleted;
  }
  
  /**
   * Get session info (for debugging)
   */
  getSessionInfo(deviceId) {
    const session = this.activeSessions.get(deviceId);
    const lastAttempt = this.lastPairingAttempt.get(deviceId);
    
    return {
      hasSession: !!session,
      sessionStatus: session?.status,
      sessionAge: session ? Date.now() - session.startTime : null,
      inCooldown: this.isInCooldown(deviceId),
      cooldownRemaining: this.getRemainingCooldown(deviceId),
      lastAttempt: lastAttempt ? new Date(lastAttempt).toISOString() : null
    };
  }
}

// Export singleton instance
module.exports = new StablePairingHandler();
