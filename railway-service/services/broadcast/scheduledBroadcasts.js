const { supabase } = require('../../config/supabase');

/**
 * Check and trigger scheduled broadcasts
 * Runs periodically to find broadcasts ready to send
 */
async function checkScheduledBroadcasts() {
  try {
    const now = new Date().toISOString();

    // Get broadcasts that are scheduled and ready to send
    const { data: scheduledBroadcasts, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('status', 'draft')
      .lte('scheduled_at', now)
      .not('scheduled_at', 'is', null);

    if (error) {
      console.error('❌ Error fetching scheduled broadcasts:', error);
      return;
    }

    if (scheduledBroadcasts && scheduledBroadcasts.length > 0) {
      console.log(`⏰ Found ${scheduledBroadcasts.length} scheduled broadcast(s) ready to send`);

      for (const broadcast of scheduledBroadcasts) {
        await supabase
          .from('broadcasts')
          .update({ status: 'processing' })
          .eq('id', broadcast.id);

        console.log(`📤 Triggered scheduled broadcast: ${broadcast.name}`);
      }
    }
  } catch (error) {
    console.error('❌ Error in checkScheduledBroadcasts:', error);
  }
}

module.exports = { checkScheduledBroadcasts };
