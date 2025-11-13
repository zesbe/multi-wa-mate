/**
 * Queued Broadcast Processor
 * Replaces polling-based broadcast processing with BullMQ queue system
 * This module adds broadcasts to queue instead of processing them directly
 */

const { supabase } = require('../../config/supabase');
const { addBroadcastJob } = require('../../jobs/broadcastQueue');
const { validateBroadcastId, isValidUUID, sanitizeErrorMessage } = require('../../utils/inputValidation');

// Track broadcasts already added to queue to prevent duplicates
// Security: Use Map instead of Set to track timestamp and prevent memory leak
const queuedBroadcasts = new Map();
const MAX_TRACKED_BROADCASTS = 1000; // Prevent memory leak
const CLEANUP_INTERVAL = 10 * 60 * 1000; // Cleanup every 10 minutes
const TRACKING_TTL = 15 * 60 * 1000; // Track for 15 minutes max

/**
 * Cleanup old entries from queuedBroadcasts to prevent memory leak
 */
function cleanupQueuedBroadcasts() {
  const now = Date.now();
  let removed = 0;

  for (const [broadcastId, timestamp] of queuedBroadcasts.entries()) {
    if (now - timestamp > TRACKING_TTL) {
      queuedBroadcasts.delete(broadcastId);
      removed++;
    }
  }

  // If still too large, remove oldest entries
  if (queuedBroadcasts.size > MAX_TRACKED_BROADCASTS) {
    const entries = Array.from(queuedBroadcasts.entries())
      .sort((a, b) => a[1] - b[1]); // Sort by timestamp

    const toRemove = queuedBroadcasts.size - MAX_TRACKED_BROADCASTS;
    for (let i = 0; i < toRemove; i++) {
      queuedBroadcasts.delete(entries[i][0]);
      removed++;
    }
  }

  if (removed > 0) {
    console.log(`🗑️  Cleaned up ${removed} old broadcast tracking entries`);
  }
}

// Run cleanup periodically
setInterval(cleanupQueuedBroadcasts, CLEANUP_INTERVAL);

/**
 * Check for pending broadcasts and add them to BullMQ queue
 * This function replaces the old polling-based processBroadcasts
 */
async function checkAndQueueBroadcasts() {
  try {
    // Get broadcasts with status "processing" that haven't been queued yet
    const { data: broadcasts, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('status', 'processing')
      .limit(10);

    if (error) {
      console.error('❌ Error fetching broadcasts:', error);
      return;
    }

    if (!broadcasts || broadcasts.length === 0) {
      return;
    }

    console.log(`📥 Found ${broadcasts.length} broadcast(s) to queue`);

    for (const broadcast of broadcasts) {
      try {
        // Security: Validate broadcast ID
        if (!isValidUUID(broadcast.id)) {
          console.error(`❌ Invalid broadcast ID format: skipping`);
          continue;
        }

        // Skip if already queued (check timestamp)
        if (queuedBroadcasts.has(broadcast.id)) {
          const queuedAt = queuedBroadcasts.get(broadcast.id);
          if (Date.now() - queuedAt < TRACKING_TTL) {
            continue; // Still within tracking window
          }
        }

        // Add to BullMQ queue
        await addBroadcastJob(broadcast);

        // Mark as queued with timestamp
        queuedBroadcasts.set(broadcast.id, Date.now());

        console.log(`✅ Broadcast ${broadcast.name} added to queue`);

      } catch (error) {
        console.error(`❌ Error queueing broadcast ${broadcast.id}:`, sanitizeErrorMessage(error));

        // If queue is not available, mark broadcast as failed
        if (error.message && error.message.includes('queue not available')) {
          await supabase
            .from('broadcasts')
            .update({
              status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', broadcast.id);

          console.log(`📝 Broadcast ${broadcast.id} marked as failed (queue unavailable)`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error in checkAndQueueBroadcasts:', error);
  }
}

/**
 * Legacy function kept for backward compatibility
 * Now it just queues broadcasts instead of processing them
 * @deprecated Use checkAndQueueBroadcasts instead
 */
async function processBroadcasts(activeSockets, connectWhatsApp) {
  await checkAndQueueBroadcasts();
}

module.exports = {
  checkAndQueueBroadcasts,
  processBroadcasts, // Legacy export
};
