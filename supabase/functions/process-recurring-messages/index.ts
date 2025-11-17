import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[Recurring] Starting recurring message processing...');

    // Get all active recurring messages that are due to be sent
    const { data: recurringMessages, error: fetchError } = await supabase
      .from('recurring_messages')
      .select(`
        *,
        devices!inner (
          id,
          status,
          assigned_server_id,
          backend_servers (
            server_url,
            is_active,
            is_healthy
          )
        )
      `)
      .eq('is_active', true)
      .lte('next_send_at', new Date().toISOString())
      .is('devices.status', 'connected')
      .not('devices.assigned_server_id', 'is', null);

    if (fetchError) {
      console.error('[Recurring] Error fetching recurring messages:', fetchError);
      throw fetchError;
    }

    console.log(`[Recurring] Found ${recurringMessages?.length || 0} messages to process`);

    if (!recurringMessages || recurringMessages.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No recurring messages to process',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    const internalApiKey = Deno.env.get('INTERNAL_API_KEY');

    for (const recurring of recurringMessages) {
      console.log(`[Recurring] Processing: ${recurring.name} (${recurring.id})`);

      // Check max executions
      if (recurring.max_executions && recurring.total_sent >= recurring.max_executions) {
        console.log(`[Recurring] Max executions reached for ${recurring.name}`);
        await supabase
          .from('recurring_messages')
          .update({ is_active: false })
          .eq('id', recurring.id);
        continue;
      }

      // Check end date
      if (recurring.end_date && new Date(recurring.end_date) < new Date()) {
        console.log(`[Recurring] End date reached for ${recurring.name}`);
        await supabase
          .from('recurring_messages')
          .update({ is_active: false })
          .eq('id', recurring.id);
        continue;
      }

      const device = Array.isArray(recurring.devices) ? recurring.devices[0] : recurring.devices;
      const server = Array.isArray(device?.backend_servers) 
        ? device.backend_servers[0] 
        : device?.backend_servers;

      if (!server?.is_active || !server?.is_healthy) {
        console.log(`[Recurring] Server not available for ${recurring.name}`);
        continue;
      }

      const targetContacts = Array.isArray(recurring.target_contacts) 
        ? recurring.target_contacts 
        : [];

      let sentCount = 0;
      let failedCount = 0;

      // Send messages to all contacts
      for (const contact of targetContacts) {
        try {
          const phoneNumber = typeof contact === 'string' ? contact : contact.phone_number;
          
          // Add delay with randomization if enabled
          const baseDelay = recurring.delay_seconds * 1000;
          const delay = recurring.randomize_delay 
            ? baseDelay + Math.random() * baseDelay * 0.5 
            : baseDelay;
          
          if (sentCount > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          const response = await fetch(`${server.server_url}/send-message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${internalApiKey}`
            },
            body: JSON.stringify({
              deviceId: device.id,
              targetJid: phoneNumber,
              messageType: recurring.media_url ? 'image' : 'text',
              message: recurring.message,
              mediaUrl: recurring.media_url
            })
          });

          if (response.ok) {
            sentCount++;
            console.log(`[Recurring] Sent to ${phoneNumber}`);
          } else {
            failedCount++;
            console.error(`[Recurring] Failed to send to ${phoneNumber}:`, await response.text());
          }
        } catch (error) {
          failedCount++;
          console.error(`[Recurring] Error sending to contact:`, error);
        }
      }

      // Update recurring message stats
      await supabase
        .from('recurring_messages')
        .update({
          last_sent_at: new Date().toISOString(),
          total_sent: recurring.total_sent + sentCount,
          total_failed: recurring.total_failed + failedCount
        })
        .eq('id', recurring.id);

      // Log execution
      await supabase
        .from('recurring_message_logs')
        .insert({
          recurring_message_id: recurring.id,
          user_id: recurring.user_id,
          sent_to_count: sentCount,
          failed_count: failedCount,
          details: {
            total_contacts: targetContacts.length,
            server_url: server.server_url
          }
        });

      results.push({
        id: recurring.id,
        name: recurring.name,
        sent: sentCount,
        failed: failedCount
      });

      console.log(`[Recurring] Completed ${recurring.name}: ${sentCount} sent, ${failedCount} failed`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Recurring messages processed',
        processed: results.length,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('[Recurring] Error processing recurring messages:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});