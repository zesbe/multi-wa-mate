/**
 * Handle Pairing Code generation for WhatsApp connection
 * Based on Baileys documentation for pairing code login
 * @param {Object} sock - WhatsApp socket instance
 * @param {Object} device - Device data from database
 * @param {Object} supabase - Supabase client
 * @param {boolean} qr - QR event indicator (needed to ensure handshake is ready)
 * @param {boolean} pairingCodeRequested - Flag to prevent duplicate requests
 * @returns {Promise<boolean>} - Returns true if pairing code was handled successfully
 */
async function handlePairingCode(sock, device, supabase, qr, pairingCodeRequested) {
  try {
    // Only generate pairing code if not already registered
    if (sock.authState.creds.registered) {
      console.log('✅ Already registered, skipping pairing code generation');
      return false;
    }

    // Check if pairing code was already requested
    if (pairingCodeRequested) {
      return false;
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
      !qr // Wait for QR event to ensure handshake is ready
    ) {
      return false;
    }

    // Format phone number - must be in E.164 format without plus sign
    // Example: +1 (234) 567-8901 -> 12345678901
    const rawPhone = String(deviceData.phone_for_pairing).replace(/\D/g, '');
    
    // Validate phone number format
    if (!rawPhone || rawPhone.length < 10) {
      console.error('❌ Invalid phone number format:', deviceData.phone_for_pairing);
      await supabase.from('devices').update({ 
        status: 'error',
        pairing_code: 'Invalid phone number - must be at least 10 digits' 
      }).eq('id', device.id);
      return false;
    }

    console.log('📱 Requesting pairing code for:', rawPhone);
    
    try {
      // Request pairing code from Baileys
      // User must: Open WhatsApp > Linked Devices > Link with phone number > Enter code
      const code = await sock.requestPairingCode(rawPhone);
      console.log('✅ Pairing code generated successfully:', code);
      
      // Save pairing code to database
      await supabase
        .from('devices')
        .update({ 
          pairing_code: code, 
          status: 'connecting', 
          qr_code: null 
        })
        .eq('id', device.id);
      
      console.log('✅ Pairing code saved to database');
      console.log('📱 Instructions: Open WhatsApp > Linked Devices > Link with phone number > Enter code:', code);
      
      // Schedule auto-refresh after 45 seconds if not connected
      scheduleCodeRefresh(sock, device, supabase, rawPhone);
      
      return true;
    } catch (pairErr) {
      const status = pairErr?.output?.statusCode || pairErr?.status;
      console.error('❌ Failed to generate pairing code:', status, pairErr?.message);
      
      // Handle timing issues (428 Precondition Failed)
      if (status === 428 || /precondition/i.test(pairErr?.message)) {
        console.log('⏳ Timing issue detected - retrying in 2 seconds...');
        
        // Retry after short delay
        setTimeout(async () => {
          try {
            const code = await sock.requestPairingCode(rawPhone);
            console.log('✅ Pairing code generated (retry):', code);
            
            await supabase
              .from('devices')
              .update({ 
                pairing_code: code, 
                status: 'connecting', 
                qr_code: null 
              })
              .eq('id', device.id);
            
            console.log('✅ Pairing code saved (retry)');
            scheduleCodeRefresh(sock, device, supabase, rawPhone);
          } catch (retryErr) {
            console.error('❌ Retry failed:', retryErr?.message);
            await supabase.from('devices').update({ 
              status: 'error',
              pairing_code: 'Failed to generate code after retry' 
            }).eq('id', device.id);
          }
        }, 2000);
        
        return true; // Return true because we're handling it with retry
      } else {
        // Other errors
        await supabase.from('devices').update({ 
          status: 'error',
          pairing_code: 'Failed to generate code: ' + (pairErr?.message || 'Unknown error')
        }).eq('id', device.id);
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Error handling pairing code:', error);
    return false;
  }
}

/**
 * Schedule automatic code refresh after 45 seconds
 * Pairing codes typically expire after 60 seconds
 * @param {Object} sock - WhatsApp socket instance
 * @param {Object} device - Device data
 * @param {Object} supabase - Supabase client
 * @param {string} originalPhone - Original phone number
 */
function scheduleCodeRefresh(sock, device, supabase, originalPhone) {
  let refreshScheduled = false;
  
  if (refreshScheduled) return;
  refreshScheduled = true;
  
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
        const refreshPhone = String(latest.phone_for_pairing || originalPhone).replace(/\D/g, '');
        console.log('⏳ Auto-refreshing pairing code for:', refreshPhone);
        
        const newCode = await sock.requestPairingCode(refreshPhone);
        
        await supabase
          .from('devices')
          .update({ 
            pairing_code: newCode, 
            status: 'connecting', 
            qr_code: null 
          })
          .eq('id', device.id);
        
        console.log('✅ Pairing code auto-refreshed:', newCode);
      }
    } catch (e) {
      console.error('❌ Failed to auto-refresh pairing code:', e?.message || e);
    }
  }, 45000); // 45 seconds
}

module.exports = { handlePairingCode };
