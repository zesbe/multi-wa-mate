const { supabase } = require('../../config/supabase');
const { validatePhoneNumber, validateMessage, validateMediaUrl } = require('../../auth-utils');
const { getMediaType, downloadMedia, prepareMediaMessage } = require('../../utils/mediaHelpers');
const { getWhatsAppName, getContactInfo, processMessageVariables } = require('./messageVariables');

// Track broadcasts currently being processed to prevent duplicates
const processingBroadcasts = new Set();

/**
 * Calculate adaptive delay based on contact count and settings
 * @param {string} delayType - Delay type: 'auto', 'adaptive', or 'manual'
 * @param {number} baseDelay - Base delay in seconds
 * @param {number} contactCount - Number of contacts
 * @returns {number} Delay in milliseconds
 */
function getAdaptiveDelay(delayType, baseDelay, contactCount) {
  if (delayType === 'auto') {
    if (contactCount <= 20) return 3000;
    if (contactCount <= 50) return 5000;
    if (contactCount <= 100) return 8000;
    return 12000;
  } else if (delayType === 'adaptive') {
    // Start conservative, will adjust based on success rate
    return Math.max(3000, baseDelay * 1000);
  } else {
    // Manual mode
    return Math.max(2000, baseDelay * 1000);
  }
}

/**
 * Calculate actual delay with randomization
 * @param {number} baseDelayMs - Base delay in milliseconds
 * @param {boolean} randomize - Whether to randomize delay
 * @returns {number} Calculated delay in milliseconds
 */
function calculateDelay(baseDelayMs, randomize) {
  if (!randomize) return baseDelayMs;

  // Add random variation ±30%
  const variation = 0.3;
  const minDelay = baseDelayMs * (1 - variation);
  const maxDelay = baseDelayMs * (1 + variation);
  return Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);
}

/**
 * Send a single broadcast message to a contact
 * @param {Object} sock - WhatsApp socket
 * @param {Object} broadcast - Broadcast object
 * @param {Object} contact - Contact object or phone number string
 * @param {string} phoneNumber - Formatted phone number
 * @returns {Promise<boolean>} Success status
 */
async function sendBroadcastMessage(sock, broadcast, contact, phoneNumber) {
  try {
    // Validate phone number format
    if (!validatePhoneNumber(phoneNumber)) {
      console.error(`❌ Invalid phone number format: ${phoneNumber}, skipping...`);
      return false;
    }

    // Get contact info from database
    const contactInfo = await getContactInfo(phoneNumber, broadcast.user_id, contact);

    // Get WhatsApp profile name
    const whatsappName = await getWhatsAppName(sock, phoneNumber);

    // Process message variables for personalization
    const processedMessage = processMessageVariables(
      broadcast.message,
      contactInfo,
      whatsappName,
      phoneNumber
    );

    // Validate message content
    if (processedMessage) {
      validateMessage(processedMessage);
    }

    // Validate media URL if present
    if (broadcast.media_url && !validateMediaUrl(broadcast.media_url)) {
      console.error(`❌ Invalid or unsafe media URL: ${broadcast.media_url}, skipping...`);
      return false;
    }

    // Format phone number (ensure it has @s.whatsapp.net suffix)
    const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;

    // Prepare message content
    let messageContent;

    if (broadcast.media_url) {
      // Send media message with retry logic
      try {
        const mediaType = getMediaType(broadcast.media_url);
        const mediaBuffer = await downloadMedia(broadcast.media_url, 3);
        messageContent = prepareMediaMessage(mediaBuffer, mediaType, processedMessage);
      } catch (mediaError) {
        console.error(`❌ Error loading media:`, mediaError.message);
        console.error('❌ Falling back to text only');
        messageContent = { text: broadcast.message };
      }
    } else {
      // Text only message
      messageContent = { text: processedMessage };
    }

    // Send message
    await sock.sendMessage(jid, messageContent);

    return true;

  } catch (error) {
    console.error(`❌ Failed to send to ${phoneNumber}:`, error.message);
    return false;
  }
}

/**
 * Process a single broadcast
 * @param {Object} broadcast - Broadcast object
 * @param {Object} sock - WhatsApp socket
 */
async function processSingleBroadcast(broadcast, sock) {
  console.log(`📤 Sending broadcast: ${broadcast.name}`);

  let sentCount = 0;
  let failedCount = 0;

  // Get delay settings
  const delayType = broadcast.delay_type || 'auto';
  const baseDelay = broadcast.delay_seconds || 5;
  const randomizeDelay = broadcast.randomize_delay !== false;
  const batchSize = broadcast.batch_size || 20;
  const pauseBetweenBatches = (broadcast.pause_between_batches || 60) * 1000;

  // Calculate adaptive delay based on contact count
  const adaptiveDelayMs = getAdaptiveDelay(delayType, baseDelay, broadcast.target_contacts.length);
  console.log(`📊 Delay settings: type=${delayType}, base=${baseDelay}s, adaptive=${adaptiveDelayMs}ms, randomize=${randomizeDelay}`);

  // Send to each target contact with intelligent batching
  for (let i = 0; i < broadcast.target_contacts.length; i++) {
    const contact = broadcast.target_contacts[i];

    // Extract phone number from contact object or use as string
    const phoneNumber = typeof contact === 'object' ? contact.phone_number : contact;

    if (!phoneNumber) {
      console.error('❌ Invalid contact:', contact);
      failedCount++;
      continue;
    }

    // Send message
    const success = await sendBroadcastMessage(sock, broadcast, contact, phoneNumber);

    if (success) {
      sentCount++;
      console.log(`✅ Sent to ${phoneNumber} (${i + 1}/${broadcast.target_contacts.length})`);
    } else {
      failedCount++;
    }

    // Batch pause logic
    if ((i + 1) % batchSize === 0 && i < broadcast.target_contacts.length - 1) {
      console.log(`⏸️ Batch complete (${i + 1} messages). Pausing for ${pauseBetweenBatches / 1000}s...`);

      // Update progress during pause
      await supabase
        .from('broadcasts')
        .update({
          sent_count: sentCount,
          failed_count: failedCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', broadcast.id);

      await new Promise(resolve => setTimeout(resolve, pauseBetweenBatches));
    } else if (i < broadcast.target_contacts.length - 1) {
      // Regular delay between messages
      const delayMs = calculateDelay(adaptiveDelayMs, randomizeDelay);
      console.log(`⏱️ Waiting ${delayMs}ms before next message...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } else if (!success) {
      // Small delay even on error
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Update broadcast with results
  await supabase
    .from('broadcasts')
    .update({
      status: 'completed',
      sent_count: sentCount,
      failed_count: failedCount,
      updated_at: new Date().toISOString()
    })
    .eq('id', broadcast.id);

  console.log(`✅ Broadcast completed: ${sentCount} sent, ${failedCount} failed`);
}

/**
 * Attempt to reconnect device if socket not available
 * @param {string} deviceId - Device ID
 * @param {Function} connectWhatsApp - Connection function
 */
async function attemptDeviceReconnect(deviceId, connectWhatsApp) {
  try {
    console.error(`❌ No active socket for device: ${deviceId} — scheduling reconnect`);

    const { data: device } = await supabase
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .maybeSingle();

    if (device) {
      await supabase.from('devices').update({ status: 'connecting' }).eq('id', device.id);
      connectWhatsApp(device).catch(() => {});
    }
  } catch (error) {
    console.error('❌ Error scheduling reconnect:', error);
  }
}

/**
 * Process broadcasts with status "processing"
 * Main function that runs periodically to process pending broadcasts
 * @param {Map} activeSockets - Map of active WhatsApp sockets
 * @param {Function} connectWhatsApp - Function to connect WhatsApp
 */
async function processBroadcasts(activeSockets, connectWhatsApp) {
  try {
    // Get broadcasts with status "processing"
    const { data: broadcasts, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('status', 'processing')
      .limit(5);

    if (error) {
      console.error('❌ Error fetching broadcasts:', error);
      return;
    }

    if (!broadcasts || broadcasts.length === 0) {
      return;
    }

    console.log(`📤 Processing ${broadcasts.length} broadcast(s)`);

    for (const broadcast of broadcasts) {
      // Skip if already being processed (prevent duplicates)
      if (processingBroadcasts.has(broadcast.id)) {
        console.log(`⏭️ Skipping broadcast ${broadcast.id} - already processing`);
        continue;
      }

      // Mark as processing
      processingBroadcasts.add(broadcast.id);

      try {
        // Get the socket for this device
        const sock = activeSockets.get(broadcast.device_id);

        if (!sock) {
          await attemptDeviceReconnect(broadcast.device_id, connectWhatsApp);
          continue;
        }

        await processSingleBroadcast(broadcast, sock);

      } catch (broadcastError) {
        console.error(`❌ Error processing broadcast ${broadcast.id}:`, broadcastError);

        // Update broadcast status to failed
        await supabase
          .from('broadcasts')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', broadcast.id);
      } finally {
        // Remove from processing set when done
        processingBroadcasts.delete(broadcast.id);
      }
    }
  } catch (error) {
    console.error('❌ Error in processBroadcasts:', error);
  }
}

module.exports = { processBroadcasts };
