const { supabase } = require('../../config/supabase');

/**
 * Get WhatsApp profile name using multiple methods
 * @param {Object} sock - WhatsApp socket
 * @param {string} phoneNumber - Phone number
 * @returns {Promise<string>} WhatsApp name or phone number as fallback
 */
async function getWhatsAppName(sock, phoneNumber) {
  let whatsappName = phoneNumber; // Default fallback

  try {
    const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;

    // Method 1: Try to get from Baileys contact store (most reliable)
    if (sock.store?.contacts && sock.store.contacts[jid]) {
      const waContact = sock.store.contacts[jid];
      whatsappName = waContact.notify || waContact.name || waContact.verifiedName || whatsappName;
      console.log(`✓ Got WhatsApp name from store for ${phoneNumber}: ${whatsappName}`);
      return whatsappName;
    }

    // Method 2: Check if number exists on WhatsApp
    const [result] = await sock.onWhatsApp(jid);
    if (result && result.exists) {
      // Try to get contact metadata
      try {
        // Fetch profile status which may contain name info
        const status = await sock.fetchStatus(jid).catch(() => null);
        if (status && status.status) {
          console.log(`✓ Got WhatsApp status for ${phoneNumber}`);
        }

        // The notify name is usually set after first interaction
        whatsappName = result.notify || phoneNumber;
        console.log(`✓ WhatsApp name for ${phoneNumber}: ${whatsappName}`);
      } catch (metaError) {
        console.log(`⚠️ Could not fetch WhatsApp metadata for ${phoneNumber}`);
      }
    }
  } catch (error) {
    console.log(`⚠️ Could not fetch WhatsApp name for ${phoneNumber}, using fallback:`, error.message);
  }

  return whatsappName;
}

/**
 * Get contact info from database
 * @param {string} phoneNumber - Phone number
 * @param {string} userId - User ID
 * @param {Object} fallbackContact - Fallback contact object
 * @returns {Promise<Object>} Contact info
 */
async function getContactInfo(phoneNumber, userId, fallbackContact = {}) {
  const { data: contactData } = await supabase
    .from('contacts')
    .select('name, var1, var2, var3')
    .eq('phone_number', phoneNumber)
    .eq('user_id', userId)
    .maybeSingle();

  return contactData || {
    name: (typeof fallbackContact === 'object' ? fallbackContact.name : null) || phoneNumber
  };
}

/**
 * Process message variables for personalization
 * @param {string} message - Original message with variables
 * @param {Object} contactInfo - Contact information from database
 * @param {string} whatsappName - WhatsApp profile name
 * @param {string} phoneNumber - Phone number
 * @returns {string} Processed message with variables replaced
 */
function processMessageVariables(message, contactInfo, whatsappName, phoneNumber) {
  let processedMessage = message;

  // Process random text selection FIRST (option1|option2|option3)
  const randomPattern = /\(([^)]+)\)/g;
  processedMessage = processedMessage.replace(randomPattern, (match, options) => {
    const choices = options.split('|').map(s => s.trim());
    return choices[Math.floor(Math.random() * choices.length)];
  });

  // Replace [[NAME]] with WhatsApp profile name (from WhatsApp account)
  processedMessage = processedMessage.replace(/\[\[NAME\]\]/g, whatsappName);

  // Replace {{NAME}} with contact name from database (uppercase version)
  processedMessage = processedMessage.replace(/\{\{NAME\}\}/g, contactInfo.name || phoneNumber);

  // Replace {nama} and {{nama}} with contact name (case insensitive)
  processedMessage = processedMessage.replace(/\{\{?nama\}\}?/gi, contactInfo.name || phoneNumber);

  // Replace {nomor} with phone number
  processedMessage = processedMessage.replace(/\{nomor\}/g, phoneNumber);

  // Replace custom variables {var1}, {var2}, {var3}
  if (contactInfo?.var1) {
    processedMessage = processedMessage.replace(/\{var1\}/g, contactInfo.var1);
  }
  if (contactInfo?.var2) {
    processedMessage = processedMessage.replace(/\{var2\}/g, contactInfo.var2);
  }
  if (contactInfo?.var3) {
    processedMessage = processedMessage.replace(/\{var3\}/g, contactInfo.var3);
  }

  // Replace time/date variables
  const now = new Date();
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  processedMessage = processedMessage.replace(/\{\{?waktu\}\}?/g,
    now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  );

  processedMessage = processedMessage.replace(/\{\{?tanggal\}\}?/g,
    now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
  );

  processedMessage = processedMessage.replace(/\{\{?hari\}\}?/g, days[now.getDay()]);

  return processedMessage;
}

module.exports = {
  getWhatsAppName,
  getContactInfo,
  processMessageVariables
};
