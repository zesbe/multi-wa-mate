const QRCode = require('qrcode');

/**
 * Handle QR Code generation for WhatsApp connection
 * QR codes are stored in Supabase database
 * @param {Object} device - Device data from database
 * @param {string} qr - QR code string from Baileys
 * @param {Object} supabase - Supabase client
 * @returns {Promise<boolean>} - Returns true if QR was handled successfully
 */
async function handleQRCode(device, qr, supabase) {
  try {
    if (!qr) {
      return false;
    }

    console.log('📷 QR Code generated for', device.device_name);
    
    // 🚀 OPTIMIZATION: Store raw QR string instead of data URL
    // Frontend will render it directly - saves CPU + network bandwidth
    const { error } = await supabase
      .from('devices')
      .update({ 
        status: 'connecting',
        qr_code: qr, // Raw QR string
        pairing_code: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', device.id);

    if (error) {
      console.error('❌ Error updating status:', error);
      return false;
    }

    console.log('✅ Raw QR stored in Supabase - realtime will push to frontend instantly');
    return true;
  } catch (error) {
    console.error('❌ Error handling QR code:', error);
    return false;
  }
}

module.exports = { handleQRCode };
