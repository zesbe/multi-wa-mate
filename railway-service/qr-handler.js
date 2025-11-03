// qr-handler.js - Fixed version
// Store QR codes directly in database instead of Redis

const QRCode = require('qrcode');

/**
 * Handle QR Code generation for WhatsApp connection
 * QR codes are stored directly in database
 */
async function handleQRCode(sock, device, supabase, qr) {
  try {
    // Only generate QR if not already registered
    if (sock.authState?.creds?.registered) {
      console.log('✅ Already registered, skipping QR generation');
      return false;
    }

    if (!qr) {
      console.log('⚠️ No QR code provided');
      return false;
    }

    console.log('📷 QR Code generated for', device.device_name);
    
    try {
      // Convert QR string to data URL
      const qrDataUrl = await QRCode.toDataURL(qr, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      // Store QR in database
      const { error } = await supabase
        .from('devices')
        .update({ 
          qr_code: qrDataUrl,
          pairing_code: null, // Clear any existing pairing code
          status: 'connecting', 
          updated_at: new Date().toISOString()
        })
        .eq('id', device.id);

      if (error) {
        console.error('❌ Error updating QR in database:', error);
        return false;
      }

      console.log('✅ QR stored in database - scan with WhatsApp app');
      
      // Schedule auto-cleanup after 5 minutes (QR expires faster than pairing)
      setTimeout(async () => {
        try {
          const { data: current } = await supabase
            .from('devices')
            .select('status, qr_code')
            .eq('id', device.id)
            .single();
          
          // Only clear if still has QR and not connected
          if (current?.qr_code === qrDataUrl && current?.status !== 'connected') {
            await supabase
              .from('devices')
              .update({ qr_code: null })
              .eq('id', device.id);
            console.log('🧹 QR code auto-cleaned after 5 minutes');
          }
        } catch (e) {
          console.error('Error cleaning QR code:', e);
        }
      }, 300000); // 5 minutes
      
      return true;
      
    } catch (qrError) {
      console.error('❌ Error generating QR data URL:', qrError);
      
      // Store error message
      await supabase
        .from('devices')
        .update({ 
          qr_code: 'ERROR: Failed to generate QR code',
          status: 'error',
          updated_at: new Date().toISOString()
        })
        .eq('id', device.id);
      
      return false;
    }
  } catch (error) {
    console.error('❌ Error in handleQQRCode:', error);
    return false;
  }
}

module.exports = { handleQRCode };
