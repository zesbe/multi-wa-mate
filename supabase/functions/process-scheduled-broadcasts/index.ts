import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking for scheduled broadcasts...');

    // Get all broadcasts that are:
    // 1. Status = 'draft' (scheduled but not yet sent)
    // 2. scheduled_at <= current time (UTC)
    const now = new Date().toISOString();
    
    const { data: broadcasts, error: fetchError } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('status', 'draft')
      .not('scheduled_at', 'is', null)
      .lte('scheduled_at', now);

    if (fetchError) {
      console.error('Error fetching broadcasts:', fetchError);
      throw fetchError;
    }

    if (!broadcasts || broadcasts.length === 0) {
      console.log('No broadcasts to process');
      return new Response(
        JSON.stringify({ message: 'No broadcasts to process', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${broadcasts.length} broadcasts to process`);

    // Update all found broadcasts to 'processing' status
    const broadcastIds = broadcasts.map(b => b.id);
    
    const { error: updateError } = await supabase
      .from('broadcasts')
      .update({ status: 'processing' })
      .in('id', broadcastIds);

    if (updateError) {
      console.error('Error updating broadcast status:', updateError);
      throw updateError;
    }

    console.log(`Successfully triggered ${broadcasts.length} broadcasts`);

    return new Response(
      JSON.stringify({ 
        message: 'Broadcasts triggered successfully', 
        count: broadcasts.length,
        broadcast_ids: broadcastIds
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in process-scheduled-broadcasts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
