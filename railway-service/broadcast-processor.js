/**
 * Broadcast Message Processor
 * Handles sending broadcast messages to multiple contacts
 */

const { sendMessage, sendMediaMessage, delay, formatPhoneNumber } = require('./baileys-config');
const supabaseClient = require('./supabase-client');

class BroadcastProcessor {
  constructor() {
    this.processingBroadcasts = new Set(); // Track broadcasts currently being processed
  }

  /**
   * Process pending broadcasts for a device
   */
  async processBroadcasts(deviceId, socket) {
    try {
      // Check if socket is connected
      if (!socket || !socket.user) {
        console.log(`⚠️ Device ${deviceId} not connected, skipping broadcasts`);
        return;
      }

      // Get pending broadcasts
      const broadcasts = await supabaseClient.getPendingBroadcasts(deviceId);

      if (broadcasts.length === 0) {
        return;
      }

      console.log(`📤 Processing ${broadcasts.length} broadcasts for device ${deviceId}`);

      // Process each broadcast
      for (const broadcast of broadcasts) {
        // Skip if already processing
        if (this.processingBroadcasts.has(broadcast.id)) {
          continue;
        }

        // Mark as processing
        this.processingBroadcasts.add(broadcast.id);

        try {
          await this.processSingleBroadcast(deviceId, socket, broadcast);
        } catch (error) {
          console.error(`❌ Error processing broadcast ${broadcast.id}:`, error);
        } finally {
          // Remove from processing set
          this.processingBroadcasts.delete(broadcast.id);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing broadcasts:`, error);
    }
  }

  /**
   * Process a single broadcast
   */
  async processSingleBroadcast(deviceId, socket, broadcast) {
    console.log(`📨 Processing broadcast ${broadcast.id}`);

    // Update broadcast status to processing
    await supabaseClient.updateBroadcastStatus(broadcast.id, 'processing');

    const stats = {
      sent_count: 0,
      failed_count: 0
    };

    try {
      // Parse recipients
      let recipients = [];
      if (typeof broadcast.recipients === 'string') {
        recipients = JSON.parse(broadcast.recipients);
      } else if (Array.isArray(broadcast.recipients)) {
        recipients = broadcast.recipients;
      }

      if (recipients.length === 0) {
        throw new Error('No recipients found');
      }

      console.log(`📋 Sending to ${recipients.length} recipients`);

      // Get message configuration
      const messageText = broadcast.message;
      const mediaUrl = broadcast.media_url;
      const mediaType = broadcast.media_type || 'image';
      const delayBetween = broadcast.delay_between_messages || 3000; // Default 3 seconds
      const batchSize = broadcast.batch_size || 50; // Default 50 per batch
      const delayBetweenBatches = broadcast.delay_between_batches || 60000; // Default 1 minute

      // Process recipients in batches
      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];

        try {
          // Check if we need to pause between batches
          if (i > 0 && i % batchSize === 0) {
            console.log(`⏸️ Batch complete. Pausing for ${delayBetweenBatches / 1000} seconds...`);
            await delay(delayBetweenBatches);
          }

          // Substitute variables in message
          let personalizedMessage = messageText;

          if (recipient.variables) {
            // Replace {{name}}
            if (recipient.variables.name) {
              personalizedMessage = personalizedMessage.replace(/\{\{name\}\}/g, recipient.variables.name);
            }

            // Replace {{var1}}, {{var2}}, etc.
            for (let j = 1; j <= 10; j++) {
              const varKey = `var${j}`;
              if (recipient.variables[varKey]) {
                const regex = new RegExp(`\\{\\{${varKey}\\}\\}`, 'g');
                personalizedMessage = personalizedMessage.replace(regex, recipient.variables[varKey]);
              }
            }
          }

          // Send message
          if (mediaUrl) {
            // Send with media
            await sendMediaMessage(
              socket,
              recipient.phone_number,
              { url: mediaUrl },
              mediaType,
              personalizedMessage
            );
          } else {
            // Send text only
            await sendMessage(socket, recipient.phone_number, personalizedMessage);
          }

          stats.sent_count++;
          console.log(`✅ Sent to ${recipient.phone_number} (${stats.sent_count}/${recipients.length})`);

          // Update broadcast progress
          await supabaseClient.updateBroadcastStatus(broadcast.id, 'processing', stats);

          // Delay before next message
          if (i < recipients.length - 1) {
            await delay(delayBetween);
          }
        } catch (error) {
          stats.failed_count++;
          console.error(`❌ Failed to send to ${recipient.phone_number}:`, error.message);

          // Continue with next recipient
          continue;
        }
      }

      // Update final status
      const finalStatus = stats.failed_count === recipients.length ? 'failed' : 'completed';
      await supabaseClient.updateBroadcastStatus(broadcast.id, finalStatus, stats);

      console.log(`✅ Broadcast ${broadcast.id} completed: ${stats.sent_count} sent, ${stats.failed_count} failed`);
    } catch (error) {
      console.error(`❌ Broadcast ${broadcast.id} failed:`, error);

      // Update status to failed
      await supabaseClient.updateBroadcastStatus(broadcast.id, 'failed', stats);
    }
  }

  /**
   * Start broadcast monitoring for a device
   */
  startMonitoring(deviceId, socket, intervalMs = 10000) {
    // Check for pending broadcasts every 10 seconds
    const interval = setInterval(async () => {
      try {
        await this.processBroadcasts(deviceId, socket);
      } catch (error) {
        console.error(`❌ Error in broadcast monitoring:`, error);
      }
    }, intervalMs);

    return interval;
  }

  /**
   * Stop broadcast monitoring
   */
  stopMonitoring(interval) {
    if (interval) {
      clearInterval(interval);
    }
  }

  /**
   * Send a single message (for testing or immediate sends)
   */
  async sendSingleMessage(socket, phoneNumber, message, mediaData = null) {
    try {
      if (mediaData) {
        return await sendMediaMessage(
          socket,
          phoneNumber,
          mediaData,
          mediaData.type || 'image',
          message
        );
      } else {
        return await sendMessage(socket, phoneNumber, message);
      }
    } catch (error) {
      console.error(`❌ Failed to send message:`, error);
      throw error;
    }
  }
}

module.exports = new BroadcastProcessor();
