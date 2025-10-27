const QRCode = require('qrcode');
const redis = require('./redis-client');

/**
 * Handle QR Code generation for WhatsApp connection
 * QR codes are stored in Redis with 5 minute TTL
 * @param {Object} sock - WhatsApp socket instance
 * @param {Object} device - Device data from database
 * @param {Object} supabase - Supabase client
 * @param {string} qr - QR code string from Baileys
 * @returns {Promise<boolean>} - Returns true if QR was handled successfully
 */
async function handleQRCode(sock, device, supabase, qr) {
  try {
    // Only generate QR if not already registered
    if (sock.authState.creds.registered) {
      console.log('✅ Already registered, skipping QR generation');
      return false;
    }

    if (!qr) {
      return false;
    }

    console.log('📷 QR Code generated for', device.device_name);
    
    // Convert QR string to data URL
    const qrDataUrl = await QRCode.toDataURL(qr);
    
    // Store QR in Redis with 10 minute TTL for better stability
    await redis.setQRCode(device.id, qrDataUrl, 600);
    
    // Update status in database (but don't store QR there)
    const { error } = await supabase
      .from('devices')
      .update({ 
        status: 'connecting', 
        pairing_code: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', device.id);

    if (error) {
      console.error('❌ Error updating status:', error);
      return false;
    }

    console.log('✅ QR stored in Redis (10 min TTL) - scan with WhatsApp app');
    return true;
  } catch (error) {
    console.error('❌ Error generating QR code:', error);
    return false;
  }
}

module.exports = { handleQRCode };
