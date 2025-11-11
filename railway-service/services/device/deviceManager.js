const { supabase } = require('../../config/supabase');

/**
 * Check if device is stuck in connecting status
 * @param {Object} device - Device object
 * @returns {boolean} True if device is stuck
 */
function isDeviceStuck(device) {
  if (device.status === 'connecting' && device.updated_at) {
    const lastUpdate = new Date(device.updated_at).getTime();
    const now = Date.now();
    const stuckTime = (now - lastUpdate) / 1000; // seconds

    return stuckTime > 120; // Stuck if > 2 minutes
  }
  return false;
}

/**
 * Clear stuck device session
 * @param {Object} device - Device object
 */
async function clearStuckDeviceSession(device) {
  const lastUpdate = new Date(device.updated_at).getTime();
  const now = Date.now();
  const stuckTime = (now - lastUpdate) / 1000;

  console.log(`⚠️ Device ${device.device_name} stuck in connecting for ${stuckTime}s - clearing session`);

  await supabase.from('devices').update({
    status: 'disconnected',
    qr_code: null,
    session_data: null
  }).eq('id', device.id);
}

/**
 * Handle device that should be online but socket doesn't exist
 * @param {Object} device - Device object
 * @param {Function} connectWhatsApp - WhatsApp connection function
 * @param {Map} activeSockets - Map of active sockets
 */
async function handleMissingSocket(device, connectWhatsApp, activeSockets) {
  const hasSessionData = device.session_data?.creds?.registered;

  if (device.status === 'connected' && hasSessionData) {
    // Railway restart detected - try to recover session
    console.log(`🔄 Recovering session for: ${device.device_name} (Railway restart detected)`);
    await connectWhatsApp(device, true, activeSockets);
  } else {
    console.log(`🔄 Connecting device: ${device.device_name} [status=${device.status}]`);
    await connectWhatsApp(device, false, activeSockets);
  }
}

/**
 * Handle socket that exists but not authenticated
 * @param {Object} device - Device object
 * @param {Object} sock - WhatsApp socket
 * @param {Function} connectWhatsApp - WhatsApp connection function
 * @param {Map} activeSockets - Map of active sockets
 */
async function handleUnauthenticatedSocket(device, sock, connectWhatsApp, activeSockets) {
  const hasSessionData = device.session_data?.creds?.registered;

  console.log(`⚠️ Socket exists but not authenticated for ${device.device_name}`);
  sock.end();
  activeSockets.delete(device.id);

  if (hasSessionData) {
    console.log(`🔄 Attempting session recovery for ${device.device_name}`);
    setTimeout(() => connectWhatsApp(device, true, activeSockets).catch(() => {}), 500);
  } else {
    console.log(`🔄 No session data - will generate QR/pairing code`);
    await supabase.from('devices').update({ status: 'connecting' }).eq('id', device.id);
    setTimeout(() => connectWhatsApp(device, false, activeSockets).catch(() => {}), 500);
  }
}

/**
 * Disconnect device that should be offline
 * @param {string} deviceId - Device ID
 * @param {Object} sock - WhatsApp socket
 * @param {Map} activeSockets - Map of active sockets
 */
async function disconnectDevice(deviceId, sock, activeSockets) {
  console.log(`❌ Disconnecting device: ${deviceId}`);
  sock?.end();
  activeSockets.delete(deviceId);

  // Clean auth on explicit disconnect
  try {
    await supabase.from('devices').update({
      qr_code: null,
      session_data: null
    }).eq('id', deviceId);
  } catch (e) {
    console.error('❌ Error cleaning auth on disconnect:', e);
  }
}

/**
 * Check devices and ensure proper connections
 * Main device management function that runs periodically
 * @param {Map} activeSockets - Map of active WhatsApp sockets
 * @param {Function} connectWhatsApp - WhatsApp connection function
 */
async function checkDevices(activeSockets, connectWhatsApp) {
  try {
    const { data: devices, error } = await supabase
      .from('devices')
      .select('*')
      .in('status', ['connecting', 'connected']);

    if (error) {
      console.error('❌ Error fetching devices:', error);
      return;
    }

    // Ensure sockets for devices that should be online
    const needSockets = devices?.filter(d => ['connecting', 'connected'].includes(d.status)) || [];

    for (const device of needSockets) {
      const sock = activeSockets.get(device.id);

      // Check if device stuck in connecting for too long (>2 minutes)
      if (isDeviceStuck(device)) {
        await clearStuckDeviceSession(device);
        continue;
      }

      if (!sock) {
        // No socket exists, create new connection
        await handleMissingSocket(device, connectWhatsApp, activeSockets);
      } else if (device.status === 'connected' && !sock.user) {
        // Socket exists but not authenticated, try session recovery first
        await handleUnauthenticatedSocket(device, sock, connectWhatsApp, activeSockets);
      }
    }

    // Disconnect devices that should be disconnected
    for (const [deviceId, sock] of activeSockets) {
      const device = devices?.find(d => d.id === deviceId);
      if (!device || device.status === 'disconnected') {
        await disconnectDevice(deviceId, sock, activeSockets);
      }
    }

    console.log(`✅ Active connections: ${activeSockets.size}`);
  } catch (error) {
    console.error('❌ Error in checkDevices:', error);
  }
}

module.exports = { checkDevices };
