/**
 * REAL BAILEYS PAIRING CODE IMPLEMENTATION
 * Integrated properly with @whiskeysockets/baileys
 *
 * Critical requirements:
 * 1. Auth state MUST be completely fresh (no existing credentials)
 * 2. Phone number format: without '+' or country code, just digits
 * 3. Socket must be initialized but NOT yet connected
 * 4. requestPairingCode must be called before any connection events
 */

class RealPairingHandler {
  /**
   * Request pairing code with real Baileys integration
   */
  async requestPairingCode(sock, phoneNumber, deviceId, deviceName, supabase) {
    const logPrefix = `[PAIRING ${deviceName}]`;

    try {
      console.log(`${logPrefix} ==========================================`);
      console.log(`${logPrefix} Starting REAL Baileys pairing code request`);
      console.log(`${logPrefix} ==========================================`);

      // Step 1: Validate socket
      if (!sock) {
        throw new Error('Socket is null or undefined');
      }

      console.log(`${logPrefix} ✅ Socket exists`);
      console.log(`${logPrefix} Socket type:`, sock.constructor.name);
      console.log(`${logPrefix} Has requestPairingCode method:`, typeof sock.requestPairingCode === 'function');

      if (typeof sock.requestPairingCode !== 'function') {
        throw new Error('Socket does not have requestPairingCode method. Baileys version might be outdated.');
      }

      // Step 2: Check auth state
      if (!sock.authState) {
        throw new Error('Socket authState is undefined');
      }

      const isRegistered = sock.authState.creds?.registered;
      console.log(`${logPrefix} Auth state registered:`, isRegistered);

      if (isRegistered) {
        throw new Error('Auth state already registered. Cannot request pairing code with existing credentials. Clear session first.');
      }

      console.log(`${logPrefix} ✅ Auth state is fresh (not registered)`);

      // Step 3: Validate and format phone number
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        throw new Error('Invalid phone number');
      }

      console.log(`${logPrefix} Raw phone number:`, phoneNumber);

      // Clean phone number - remove ALL non-digits
      let cleanPhone = phoneNumber.replace(/\D/g, '');
      console.log(`${logPrefix} After removing non-digits:`, cleanPhone);

      // Normalize Indonesian numbers
      if (cleanPhone.startsWith('0')) {
        // 0812xxx → 62812xxx
        cleanPhone = '62' + cleanPhone.substring(1);
        console.log(`${logPrefix} Normalized from 0 prefix:`, cleanPhone);
      } else if (cleanPhone.startsWith('8') && cleanPhone.length >= 9 && cleanPhone.length <= 12) {
        // 812xxx → 62812xxx
        cleanPhone = '62' + cleanPhone;
        console.log(`${logPrefix} Normalized from 8 prefix:`, cleanPhone);
      } else if (!cleanPhone.startsWith('62')) {
        // Assume Indonesian if no prefix
        cleanPhone = '62' + cleanPhone;
        console.log(`${logPrefix} Added 62 prefix:`, cleanPhone);
      }

      // Validate length
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        throw new Error(`Invalid phone length: ${cleanPhone.length} digits (expected 10-15). Phone: ${cleanPhone}`);
      }

      console.log(`${logPrefix} ✅ Final cleaned phone:`, cleanPhone);

      // Step 4: Check socket websocket state
      if (sock.ws) {
        const wsReadyState = sock.ws.readyState;
        const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
        console.log(`${logPrefix} WebSocket state:`, states[wsReadyState] || wsReadyState);
      } else {
        console.log(`${logPrefix} ⚠️ WebSocket not yet initialized`);
      }

      // Step 5: Request pairing code from Baileys
      console.log(`${logPrefix} ==========================================`);
      console.log(`${logPrefix} 🔐 Calling sock.requestPairingCode('${cleanPhone}')`);
      console.log(`${logPrefix} ==========================================`);

      let pairingCode;
      try {
        // This is the REAL Baileys API call
        pairingCode = await sock.requestPairingCode(cleanPhone);

        console.log(`${logPrefix} ==========================================`);
        console.log(`${logPrefix} 🎉 BAILEYS RESPONSE RECEIVED`);
        console.log(`${logPrefix} ==========================================`);
        console.log(`${logPrefix} Raw code from Baileys:`, pairingCode);
        console.log(`${logPrefix} Code type:`, typeof pairingCode);
        console.log(`${logPrefix} Code length:`, pairingCode?.length);

      } catch (baileys_error) {
        console.error(`${logPrefix} ❌ BAILEYS API ERROR:`, baileys_error);
        console.error(`${logPrefix} Error name:`, baileys_error.name);
        console.error(`${logPrefix} Error message:`, baileys_error.message);
        console.error(`${logPrefix} Error stack:`, baileys_error.stack);

        // Save error to database
        await supabase
          .from('devices')
          .update({
            status: 'error',
            error_message: `Baileys error: ${baileys_error.message}`,
            pairing_code: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', deviceId);

        throw baileys_error;
      }

      // Step 6: Validate response
      if (!pairingCode) {
        throw new Error('Baileys returned null/undefined/empty code');
      }

      if (typeof pairingCode !== 'string' && typeof pairingCode !== 'number') {
        throw new Error(`Baileys returned unexpected type: ${typeof pairingCode}`);
      }

      const codeStr = String(pairingCode);
      if (codeStr.length < 4 || codeStr.length > 10) {
        throw new Error(`Baileys returned code with unexpected length: ${codeStr.length}`);
      }

      console.log(`${logPrefix} ✅ Code validated`);

      // Step 7: Format code for display
      const formattedCode = this.formatCode(codeStr);
      console.log(`${logPrefix} Formatted code:`, formattedCode);

      // Step 8: Save to Supabase
      const { error: updateError } = await supabase
        .from('devices')
        .update({
          pairing_code: formattedCode,
          status: 'waiting_pairing',
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);

      if (updateError) {
        console.error(`${logPrefix} ❌ Supabase update error:`, updateError);
        throw updateError;
      }

      console.log(`${logPrefix} ✅ Code saved to Supabase`);
      console.log(`${logPrefix} ==========================================`);
      console.log(`${logPrefix} ✅ SUCCESS! Code: ${formattedCode}`);
      console.log(`${logPrefix} ==========================================`);

      return {
        success: true,
        code: formattedCode,
        raw: codeStr
      };

    } catch (error) {
      console.error(`${logPrefix} ==========================================`);
      console.error(`${logPrefix} ❌ PAIRING FAILED`);
      console.error(`${logPrefix} ==========================================`);
      console.error(`${logPrefix} Error:`, error.message);
      console.error(`${logPrefix} Stack:`, error.stack);

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
        console.error(`${logPrefix} Failed to save error to DB:`, dbError);
      }

      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Format pairing code for display
   */
  formatCode(code) {
    const cleaned = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');

    // 8 characters: XXXX-XXXX
    if (cleaned.length === 8) {
      return `${cleaned.substring(0, 4)}-${cleaned.substring(4)}`;
    }

    // 6 characters: XXX-XXX
    if (cleaned.length === 6) {
      return `${cleaned.substring(0, 3)}-${cleaned.substring(3)}`;
    }

    // Other lengths: return as-is
    return cleaned;
  }
}

module.exports = new RealPairingHandler();
