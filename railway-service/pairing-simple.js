/**
 * SIMPLE PAIRING CODE IMPLEMENTATION
 * Rebuilt from scratch with proven approach
 *
 * Key principles:
 * 1. Request pairing code IMMEDIATELY after socket creation (before any connection event)
 * 2. Phone number must be in exact format (no @s.whatsapp.net)
 * 3. No existing credentials (fresh auth state)
 * 4. Simple, synchronous flow
 */

class SimplePairingHandler {
  /**
   * Request pairing code with Baileys
   * This is the ONLY reliable way based on Baileys documentation
   */
  async requestPairingCode(sock, phoneNumber, deviceId, supabase) {
    const logPrefix = `[Pairing ${deviceId.substring(0, 8)}]`;

    try {
      console.log(`${logPrefix} Starting pairing code request...`);
      console.log(`${logPrefix} Phone number: ${phoneNumber}`);

      // Validate inputs
      if (!sock) {
        throw new Error('Socket is null or undefined');
      }

      if (!phoneNumber || typeof phoneNumber !== 'string') {
        throw new Error('Invalid phone number');
      }

      // Clean phone number - Baileys expects ONLY digits, no prefix
      let cleanPhone = phoneNumber.replace(/\D/g, ''); // Remove all non-digits

      // Normalize Indonesian numbers to 62 format
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '62' + cleanPhone.substring(1);
      } else if (cleanPhone.startsWith('8') && cleanPhone.length <= 12) {
        cleanPhone = '62' + cleanPhone;
      }

      // Validate length (Indonesian mobile: 10-13 digits with 62 prefix)
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        throw new Error(`Invalid phone length: ${cleanPhone.length} digits`);
      }

      console.log(`${logPrefix} Cleaned phone: ${cleanPhone}`);

      // Check if socket has requestPairingCode method
      if (typeof sock.requestPairingCode !== 'function') {
        throw new Error('Socket does not have requestPairingCode method');
      }

      console.log(`${logPrefix} Requesting pairing code from Baileys...`);

      // Request pairing code - this is the critical call
      // According to Baileys docs, this MUST be called before connection is established
      const code = await sock.requestPairingCode(cleanPhone);

      if (!code) {
        throw new Error('Baileys returned null/undefined code');
      }

      console.log(`${logPrefix} ✅ Got code from Baileys: ${code}`);

      // Format code for display (XXXX-XXXX)
      const formattedCode = this.formatCode(code);
      console.log(`${logPrefix} Formatted code: ${formattedCode}`);

      // Save to Supabase database (primary storage)
      await supabase
        .from('devices')
        .update({
          pairing_code: formattedCode,
          status: 'waiting_pairing',
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);

      console.log(`${logPrefix} ✅ Code saved to Supabase`);

      return {
        success: true,
        code: formattedCode
      };

    } catch (error) {
      console.error(`${logPrefix} ❌ Error:`, error.message);

      // Save error to database
      try {
        await supabase
          .from('devices')
          .update({
            status: 'error',
            error_message: `Pairing failed: ${error.message}`,
            pairing_code: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', deviceId);
      } catch (dbError) {
        console.error(`${logPrefix} Failed to save error:`, dbError);
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Format pairing code for display
   */
  formatCode(code) {
    const cleaned = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Format as XXXX-XXXX for 8 characters
    if (cleaned.length === 8) {
      return `${cleaned.substring(0, 4)}-${cleaned.substring(4)}`;
    }

    // Format as XX-XX-XX-XX for 8 digits
    if (cleaned.length === 8 && /^\d+$/.test(cleaned)) {
      return `${cleaned.substring(0, 2)}-${cleaned.substring(2, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
    }

    return cleaned;
  }
}

module.exports = new SimplePairingHandler();
