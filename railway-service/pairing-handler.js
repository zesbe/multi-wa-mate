const redis = require('./redis-client');

// In-memory tracking for pairing requests (to avoid Redis overhead)
const pairingRequestTracker = new Map();

/**
 * Handle Pairing Code generation for WhatsApp connection with exponential backoff
 * Pairing codes are stored in Redis with 10 minute TTL
 * Based on Baileys documentation for pairing code login
 * @param {Object} sock - WhatsApp socket instance
 * @param {Object} device - Device data from database
 * @param {Object} supabase - Supabase client
 * @param {boolean} readyToRequest - True when connection is 'connecting' or QR event emitted
 * @param {Object} pairingCodeRequested - Object with timestamp to track when code was requested
 * @param {number} retryCount - Current retry attempt (default 0)
 * @returns {Promise<Object>} - Returns object with handled flag and timestamp
 */
async function handlePairingCode(sock, device, supabase, readyToRequest, pairingCodeRequested, retryCount = 0) {
  const MAX_RETRIES = 3;
  const BACKOFF_DELAYS = [2000, 5000, 8000]; // 2s, 5s, 8s
  try {
    // Only generate pairing code if not already registered
    if (sock.authState.creds.registered) {
      console.log('✅ Already registered, skipping pairing code generation');
      return false;
    }

    // Check in-memory for existing pairing request
    const existingTimestamp = pairingRequestTracker.get(device.id);
    if (existingTimestamp) {
      const timeSinceRequest = (Date.now() - existingTimestamp) / 1000;
      if (timeSinceRequest < 50) {
        return false; // Still fresh, don't request again
      }
      console.log('⏰ Previous pairing code expired, generating new one...');
    }

    // Allow re-requesting if previous code expired (more than 50 seconds ago)
    if (pairingCodeRequested) {
      const now = Date.now();
      const timeSinceRequest = (now - (pairingCodeRequested.timestamp || 0)) / 1000;
      if (timeSinceRequest < 50) {
        return false; // Still fresh, don't request again
      }
      console.log('⏰ Previous pairing code expired, generating new one...');
    }

    // Get device data to check connection method and phone number
    const { data: deviceData, error: fetchError } = await supabase
      .from('devices')
      .select('status, connection_method, phone_for_pairing')
      .eq('id', device.id)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching device data:', fetchError);
      return false;
    }

    // Only proceed if pairing method is configured and phone number is provided
    if (
      deviceData?.connection_method !== 'pairing' ||
      !deviceData?.phone_for_pairing ||
      !readyToRequest // Wait until connecting or QR event to ensure handshake is ready
    ) {
      return false;
    }

    // Format phone number - must be in E.164 format without plus sign
    // Example: +1 (234) 567-8901 -> 12345678901
    const digits = String(deviceData.phone_for_pairing).replace(/\D/g, '');
    let e164 = digits;
    // Heuristic for Indonesian numbers: 08xxxx -> 628xxxx
    if (e164.startsWith('0')) {
      e164 = '62' + e164.slice(1);
    }
    
    // Validate phone number format (E.164 length 10-15)
    if (!e164 || e164.length < 10 || e164.length > 15) {
      console.error('❌ Invalid phone number format:', deviceData.phone_for_pairing);
      await redis.setPairingCode(device.id, 'Invalid phone (E.164 without +), contoh: 628123456789', 300);
      await supabase.from('devices').update({ 
        status: 'error',
        updated_at: new Date().toISOString()
      }).eq('id', device.id);
      return { handled: false };
    }


    console.log('📱 Requesting pairing code for:', e164);
    
    // Set pairing request timestamp in memory
    const timestamp = Date.now();
    pairingRequestTracker.set(device.id, timestamp);
    
    // Auto-cleanup after 60 seconds
    setTimeout(() => pairingRequestTracker.delete(device.id), 60000);

    // Small delay to ensure handshake ready
    if (readyToRequest) {
      await new Promise((r) => setTimeout(r, 300));
    }

    try {
      // Request pairing code from Baileys
      // User must: Open WhatsApp > Linked Devices > Link with phone number > Enter code
      const code = await sock.requestPairingCode(e164);
      console.log('✅ Pairing code generated successfully:', code);
      
      // Store pairing code in Redis with 10 minute TTL for better stability
      await redis.setPairingCode(device.id, code, 600);
      
      // Update status in database (but don't store code there)
      await supabase
        .from('devices')
        .update({ 
          status: 'connecting',
          updated_at: new Date().toISOString()
        })
        .eq('id', device.id);
      
      console.log('✅ Pairing code stored in Redis (10 min TTL)');
      console.log('📱 Instructions: Open WhatsApp > Linked Devices > Link with phone number > Enter code:', code);
      console.log('⏰ Code will auto-refresh in 8 minutes');
      
      // Schedule auto-refresh after 8 minutes (480s) - giving 2min buffer before expiry
      scheduleCodeRefresh(sock, device, supabase, e164);
      
      return { handled: true, timestamp };
    } catch (pairErr) {
      const status = pairErr?.output?.statusCode || pairErr?.status;
      console.error(`❌ Failed to generate pairing code (attempt ${retryCount + 1}/${MAX_RETRIES}):`, status, pairErr?.message);
      
      // Check if error is retryable (428 or 401)
      const isRetryableError = status === 428 || 
                               status === 401 ||
                               /precondition/i.test(pairErr?.message) ||
                               /unauthorized/i.test(pairErr?.message);
      
      if (isRetryableError && retryCount < MAX_RETRIES) {
        const delay = BACKOFF_DELAYS[retryCount];
        console.log(`⏳ Retryable error detected - retrying in ${delay}ms...`);
        
        // Wait with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Recursive retry with incremented counter
        return handlePairingCode(sock, device, supabase, true, pairingCodeRequested, retryCount + 1);
      }
      
      // Max retries exceeded or non-retryable error
      const errorMsg = retryCount >= MAX_RETRIES 
        ? `Failed after ${MAX_RETRIES} retries: ${pairErr?.message || 'Unknown error'}`
        : `Failed: ${pairErr?.message || 'Unknown error'}`;
      
      await redis.setPairingCode(device.id, errorMsg, 60);
      await supabase.from('devices').update({ 
        status: 'error',
        updated_at: new Date().toISOString()
      }).eq('id', device.id);
      
      return { handled: false };
    }
  } catch (error) {
    console.error('❌ Error handling pairing code:', error);
    return { handled: false };
  }
}

/**
 * Schedule automatic code refresh after 8 minutes
 * Pairing codes have 10 minute TTL, refresh at 8 min for 2 min buffer
 * @param {Object} sock - WhatsApp socket instance
 * @param {Object} device - Device data
 * @param {Object} supabase - Supabase client
 * @param {string} originalPhone - Original phone number
 */
function scheduleCodeRefresh(sock, device, supabase, originalPhone) {
  setTimeout(async () => {
    try {
      // Re-check current state before refreshing
      const { data: latest } = await supabase
        .from('devices')
        .select('status, connection_method, phone_for_pairing')
        .eq('id', device.id)
        .single();

      // Only refresh if still connecting with pairing method and not registered yet
      if (
        latest?.status === 'connecting' &&
        latest?.connection_method === 'pairing' &&
        !sock.authState.creds.registered
      ) {
        const digits2 = String(latest.phone_for_pairing || originalPhone).replace(/\D/g, '');
        let refreshPhone = digits2;
        if (refreshPhone.startsWith('0')) {
          refreshPhone = '62' + refreshPhone.slice(1);
        }
        console.log('⏳ Auto-refreshing pairing code for:', refreshPhone);
        
        const newCode = await sock.requestPairingCode(refreshPhone);
        
        // Store in Redis with 10 minute TTL
        await redis.setPairingCode(device.id, newCode, 600);
        
        await supabase
          .from('devices')
          .update({ 
            status: 'connecting',
            updated_at: new Date().toISOString()
          })
          .eq('id', device.id);
        
        console.log('✅ Pairing code auto-refreshed:', newCode);
      }
    } catch (e) {
      console.error('❌ Failed to auto-refresh pairing code:', e?.message || e);
    }
  }, 480000); // 8 minutes (480 seconds)
}

module.exports = { handlePairingCode };
