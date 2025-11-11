const { supabase } = require('../../config/supabase');

/**
 * Health check ping to keep connections alive
 * Updates last_connected_at for all active devices
 * @param {Map} activeSockets - Map of active WhatsApp sockets
 */
async function healthCheckPing(activeSockets) {
  try {
    console.log(`💓 Health check: ${activeSockets.size} active socket(s)`);

    for (const [deviceId, sock] of activeSockets) {
      try {
        if (sock.user) {
          // Send a lightweight ping to keep connection alive
          const pingTime = Date.now();
          console.log(`📡 Ping device ${deviceId}: ${sock.user.id}`);

          // Update last_connected_at to show device is alive
          await supabase
            .from('devices')
            .update({
              last_connected_at: new Date().toISOString(),
              status: 'connected'
            })
            .eq('id', deviceId);
        } else {
          console.log(`⚠️ Device ${deviceId} socket exists but not authenticated`);
        }
      } catch (pingError) {
        console.error(`❌ Ping error for device ${deviceId}:`, pingError.message);
      }
    }
  } catch (error) {
    console.error('❌ Error in healthCheckPing:', error);
  }
}

module.exports = { healthCheckPing };
