const QRCode = require('qrcode');

/**
 * Handle QR Code generation for WhatsApp connection
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
    
    // Save QR to database
    const { error } = await supabase
      .from('devices')
      .update({ 
        qr_code: qrDataUrl, 
        status: 'connecting', 
        pairing_code: null 
      })
      .eq('id', device.id);

    if (error) {
      console.error('❌ Error saving QR code:', error);
      return false;
    }

    console.log('✅ QR saved to database - scan with WhatsApp app');
    return true;
  } catch (error) {
    console.error('❌ Error generating QR code:', error);
    return false;
  }
}

module.exports = { handleQRCode };
