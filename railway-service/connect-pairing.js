/**
 * SIMPLE PAIRING CODE IMPLEMENTATION
 * Following Baileys documentation exactly with Supabase auth storage
 */

const { default: makeWASocket, fetchLatestBaileysVersion, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');

/**
 * Connect device with pairing code
 * @param {Object} device - Device info from database
 * @param {Object} supabase - Supabase client
 */
async function connectWithPairingCode(device, supabase) {
  const deviceId = device.id;
  const deviceName = device.device_name || 'Unknown';
  const phoneNumber = device.phone_for_pairing;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📱 PAIRING: ${deviceName}`);
  console.log(`📞 Phone: ${phoneNumber}`);
  console.log(`${'='.repeat(70)}\n`);

  try {
    // Create FRESH auth state for pairing
    const creds = initAuthCreds();
    const keys = {};

    console.log(`✅ Fresh auth created (registered: ${creds.registered})`);

    // Save function
    const saveCreds = async () => {
      const sessionData = {
        creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
        keys: JSON.parse(JSON.stringify(keys, BufferJSON.replacer)),
      };

      await supabase
        .from('devices')
        .update({ session_data: sessionData })
        .eq('id', deviceId);
    };

    // Create auth state object
    const state = {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = keys[type] || {};
          const result = {};
          for (const id of ids) result[id] = data[id] || null;
          return result;
        },
        set: async (data) => {
          for (const type of Object.keys(data)) {
            keys[type] = keys[type] || {};
            Object.assign(keys[type], data[type]);
          }
          await saveCreds();
        },
      },
    };

    // Get Baileys version
    const { version } = await fetchLatestBaileysVersion();
    console.log(`📱 WhatsApp version: ${version.join('.')}`);

    // Create socket
    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: ['HalloWa', 'Chrome', '120.0.0'],
      connectTimeoutMs: 60000,
    });

    console.log(`✅ Socket created`);
    console.log(`🔓 Auth registered: ${sock.authState.creds.registered}`);

    // Clean phone number - ONLY digits
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    console.log(`📞 Clean phone: ${cleanPhone}`);

    // CRITICAL: Request pairing code IMMEDIATELY
    console.log(`\n🔐 Requesting pairing code...`);

    let pairingCode;
    try {
      pairingCode = await sock.requestPairingCode(cleanPhone);
    } catch (err) {
      console.error(`❌ Request failed:`, err.message);
      throw err;
    }

    if (!pairingCode) {
      throw new Error('No pairing code returned');
    }

    // Format code
    const codeStr = String(pairingCode);
    const formattedCode = codeStr.match(/.{1,4}/g)?.join('-') || codeStr;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`✅ PAIRING CODE: ${formattedCode}`);
    console.log(`${'='.repeat(70)}\n`);

    // Save to database
    await supabase
      .from('devices')
      .update({
        pairing_code: formattedCode,
        status: 'waiting_pairing',
        error_message: null,
      })
      .eq('id', deviceId);

    console.log(`💾 Saved to database`);

    // Handle connection events
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      console.log(`📡 Connection: ${connection}`);

      if (connection === 'open') {
        console.log(`✅ Connected!`);

        const phoneNum = sock.user?.id.split(':')[0];

        await supabase
          .from('devices')
          .update({
            status: 'connected',
            phone_number: phoneNum,
            pairing_code: null,
            last_connected_at: new Date().toISOString(),
          })
          .eq('id', deviceId);

        console.log(`💾 Session saved`);
      }

      if (connection === 'close') {
        console.log(`❌ Disconnected`);

        await supabase
          .from('devices')
          .update({ status: 'disconnected' })
          .eq('id', deviceId);
      }
    });

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);

    return sock;

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}\n`);

    await supabase
      .from('devices')
      .update({
        status: 'error',
        error_message: `Pairing error: ${error.message}`,
      })
      .eq('id', deviceId);

    throw error;
  }
}

module.exports = { connectWithPairingCode };
