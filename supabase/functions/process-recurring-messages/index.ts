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

    // Process each recurring message by creating broadcast jobs
    // This leverages BullMQ queue for reliability, retry, and monitoring
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

      try {
        // Create broadcast job for this recurring message
        // BullMQ worker will handle actual sending with retry and monitoring
        const { data: broadcast, error: broadcastError } = await supabase
          .from('broadcasts')
          .insert({
            user_id: recurring.user_id,
            device_id: recurring.device_id,
            name: `${recurring.name} - ${new Date().toLocaleString('id-ID')}`,
            message: recurring.message,
            media_url: recurring.media_url,
            target_contacts: recurring.target_contacts,
            status: 'pending',
            delay_seconds: recurring.delay_seconds || 5,
            randomize_delay: recurring.randomize_delay !== false,
            batch_size: recurring.batch_size || 50,
            delay_type: 'auto'
          })
          .select()
          .single();

        if (broadcastError) {
          console.error(`[Recurring] Failed to create broadcast for ${recurring.name}:`, broadcastError);
          
          // Log failure
          await supabase
            .from('recurring_message_logs')
            .insert({
              recurring_message_id: recurring.id,
              user_id: recurring.user_id,
              sent_to_count: 0,
              failed_count: 0,
              error_message: broadcastError.message,
              details: {
                error: 'Failed to create broadcast job',
                message: broadcastError.message
              }
            });

          continue;
        }

        // Update recurring message stats (will be updated again by broadcast worker)
        await supabase
          .from('recurring_messages')
          .update({
            last_sent_at: new Date().toISOString()
          })
          .eq('id', recurring.id);

        // Log execution (queued)
        await supabase
          .from('recurring_message_logs')
          .insert({
            recurring_message_id: recurring.id,
            user_id: recurring.user_id,
            sent_to_count: 0,
            failed_count: 0,
            details: {
              broadcast_id: broadcast.id,
              status: 'queued',
              total_contacts: Array.isArray(recurring.target_contacts) ? recurring.target_contacts.length : 0,
              message: 'Broadcast job created and queued in BullMQ'
            }
          });

        results.push({
          id: recurring.id,
          name: recurring.name,
          broadcast_id: broadcast.id,
          status: 'queued',
          target_count: Array.isArray(recurring.target_contacts) ? recurring.target_contacts.length : 0
        });

        console.log(`[Recurring] Created broadcast job for ${recurring.name} (broadcast_id: ${broadcast.id})`);
      } catch (error: any) {
        console.error(`[Recurring] Error processing ${recurring.name}:`, error);
        
        // Log error
        await supabase
          .from('recurring_message_logs')
          .insert({
            recurring_message_id: recurring.id,
            user_id: recurring.user_id,
            sent_to_count: 0,
            failed_count: 0,
            error_message: error.message,
            details: {
              error: 'Processing error',
              message: error.message
            }
          });
      }
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