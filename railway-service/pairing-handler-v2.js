const redis = require('./redis-client');

// In-memory tracking for pairing requests
const pairingRequestTracker = new Map();

/**
 * Enhanced Pairing Code handler with better connection management
 * @param {Object} sock - WhatsApp socket instance
 * @param {Object} device - Device data from database
 * @param {Object} supabase - Supabase client
 * @returns {Promise<Object>} - Returns object with handled flag and code
 */
async function handlePairingCodeV2(sock, device, supabase) {
  try {
    // Check if already registered
    if (sock.authState?.creds?.registered) {
      console.log('✅ Already registered, skipping pairing');
      return { handled: false };
    }

    // Get device configuration
    const { data: deviceData, error } = await supabase
      .from('devices')
      .select('connection_method, phone_for_pairing, status')
      .eq('id', device.id)
      .single();

    if (error || !deviceData) {
      console.error('❌ Error fetching device:', error);
      return { handled: false };
    }

    // Validate pairing configuration
    if (deviceData.connection_method !== 'pairing' || !deviceData.phone_for_pairing) {
      console.log('📱 Device not configured for pairing');
      return { handled: false };
    }

    // Format phone number properly
    const phoneNumber = formatPhoneNumber(deviceData.phone_for_pairing);
    if (!phoneNumber) {
      console.error('❌ Invalid phone number format');
      await updateDeviceError(supabase, device.id, 'Invalid phone number format');
      return { handled: false };
    }

    console.log(`📱 Requesting pairing code for: ${phoneNumber}`);

    // Check if we already have a recent request
    const lastRequest = pairingRequestTracker.get(device.id);
    if (lastRequest) {
      const timeSince = (Date.now() - lastRequest.timestamp) / 1000;
      if (timeSince < 30 && lastRequest.code) {
        console.log(`⏱️ Using existing code (${timeSince.toFixed(0)}s old): ${lastRequest.code}`);
        return { handled: true, code: lastRequest.code };
      }
    }

    // Wait for connection to be ready
    await waitForConnection(sock);

    try {
      // Request pairing code with proper error handling
      const code = await requestPairingCodeWithRetry(sock, phoneNumber);
      
      if (!code) {
        throw new Error('No pairing code received');
      }

      console.log(`✅ Pairing code generated: ${code}`);

      // Store in memory tracker
      pairingRequestTracker.set(device.id, {
        timestamp: Date.now(),
        code: code,
        phone: phoneNumber
      });

      // Store in Redis (10 minute TTL)
      await redis.setPairingCode(device.id, code, 600);

      // Update database
      await supabase
        .from('devices')
        .update({
          status: 'connecting',
          pairing_code: code,
          updated_at: new Date().toISOString()
        })
        .eq('id', device.id);

      // Log clear instructions
      logPairingInstructions(phoneNumber, code);

      // Set up pairing completion handler
      setupPairingCompletionHandler(sock, device, supabase);

      return { handled: true, code: code };

    } catch (error) {
      console.error('❌ Pairing code generation failed:', error.message);
      
      // Store error for user visibility
      await updateDeviceError(supabase, device.id, error.message);
      
      return { handled: false, error: error.message };
    }

  } catch (error) {
    console.error('❌ Unexpected error in pairing handler:', error);
    return { handled: false, error: error.message };
  }
}

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove all non-digits
  let digits = String(phone).replace(/\D/g, '');
  
  // Handle Indonesian numbers
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  }
  
  // Add Indonesia country code if missing
  if (digits.length <= 12 && !digits.startsWith('62')) {
    digits = '62' + digits;
  }
  
  // Validate length
  if (digits.length < 10 || digits.length > 15) {
    return null;
  }
  
  return digits;
}

/**
 * Wait for socket connection to be ready
 */
async function waitForConnection(sock, maxWait = 5000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    if (sock && typeof sock.requestPairingCode === 'function') {
      console.log('✅ Socket ready for pairing');
      return true;
    }
    
    console.log('⏳ Waiting for socket...');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Socket not ready after timeout');
}

/**
 * Request pairing code with retry logic
 */
async function requestPairingCodeWithRetry(sock, phoneNumber, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔐 Requesting pairing code (attempt ${attempt}/${maxRetries})...`);
      
      // Add delay between attempts
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
      
      // Request with timeout
      const codePromise = sock.requestPairingCode(phoneNumber);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 30000)
      );
      
      const code = await Promise.race([codePromise, timeoutPromise]);
      
      if (code) {
        return code;
      }
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }
  
  return null;
}

/**
 * Log clear pairing instructions
 */
function logPairingInstructions(phoneNumber, code) {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('📱 PAIRING CODE READY');
  console.log('═══════════════════════════════════════');
  console.log('Instructions:');
  console.log('1. Open WhatsApp on your phone');
  console.log('2. Go to Settings > Linked Devices');
  console.log('3. Tap "Link with phone number"');
  console.log(`4. Enter phone number: ${phoneNumber}`);
  console.log(`5. Enter pairing code: ${code}`);
  console.log('═══════════════════════════════════════');
  console.log('');
}

/**
 * Set up handler to detect pairing completion
 */
function setupPairingCompletionHandler(sock, device, supabase) {
  const checkInterval = setInterval(async () => {
    if (sock.authState?.creds?.registered) {
      console.log('✅ Pairing completed successfully!');
      
      // Clear interval
      clearInterval(checkInterval);
      
      // Clear pairing code from memory
      pairingRequestTracker.delete(device.id);
      
      // Update device status
      await supabase
        .from('devices')
        .update({
          status: 'connected',
          pairing_code: null,
          phone_number: sock.user?.id?.split(':')[0],
          last_connected_at: new Date().toISOString()
        })
        .eq('id', device.id);
    }
  }, 2000);
  
  // Stop checking after 10 minutes
  setTimeout(() => clearInterval(checkInterval), 600000);
}

/**
 * Update device with error status
 */
async function updateDeviceError(supabase, deviceId, errorMessage) {
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

// Export improved version
module.exports = { 
  handlePairingCode: handlePairingCodeV2, // Use V2 as default
  handlePairingCodeV2 
};
