import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for various system issues and create alerts
    
    // 1. Check for expired subscriptions
    const { data: expiredSubs } = await supabase
      .from("user_subscriptions")
      .select("*, profiles(full_name)")
      .eq("status", "active")
      .lt("expires_at", new Date().toISOString());

    if (expiredSubs && expiredSubs.length > 0) {
      for (const sub of expiredSubs) {
        await supabase.from("system_alerts").insert({
          alert_type: "subscription_expired",
          severity: "warning",
          title: "Subscription Expired",
          message: `${(sub.profiles as any)?.full_name || "User"}'s subscription has expired`,
          entity_type: "subscription",
          entity_id: sub.id,
        });

        // Update subscription status
        await supabase
          .from("user_subscriptions")
          .update({ status: "expired" })
          .eq("id", sub.id);
      }
    }

    // 2. Check for subscriptions expiring in 7 days
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    
    const { data: expiringSoon } = await supabase
      .from("user_subscriptions")
      .select("*, profiles(full_name)")
      .eq("status", "active")
      .lt("expires_at", in7Days.toISOString())
      .gt("expires_at", new Date().toISOString());

    if (expiringSoon && expiringSoon.length > 0) {
      for (const sub of expiringSoon) {
        // Check if alert already exists
        const { data: existingAlert } = await supabase
          .from("system_alerts")
          .select("id")
          .eq("entity_id", sub.id)
          .eq("alert_type", "subscription_expiring")
          .single();

        if (!existingAlert) {
          await supabase.from("system_alerts").insert({
            alert_type: "subscription_expiring",
            severity: "info",
            title: "Subscription Expiring Soon",
            message: `${(sub.profiles as any)?.full_name || "User"}'s subscription expires in less than 7 days`,
            entity_type: "subscription",
            entity_id: sub.id,
          });
        }
      }
    }

    // 3. Check for failed broadcasts
    const { data: failedBroadcasts } = await supabase
      .from("broadcasts")
      .select("*, profiles(full_name)")
      .eq("status", "failed")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24h

    if (failedBroadcasts && failedBroadcasts.length > 0) {
      for (const broadcast of failedBroadcasts) {
        const { data: existingAlert } = await supabase
          .from("system_alerts")
          .select("id")
          .eq("entity_id", broadcast.id)
          .eq("alert_type", "broadcast_failed")
          .single();

        if (!existingAlert) {
          await supabase.from("system_alerts").insert({
            alert_type: "broadcast_failed",
            severity: "error",
            title: "Broadcast Failed",
            message: `Broadcast "${broadcast.name}" by ${(broadcast.profiles as any)?.full_name || "User"} has failed`,
            entity_type: "broadcast",
            entity_id: broadcast.id,
          });
        }
      }
    }

    // 4. Check for disconnected devices (not active in 24h)
    const { data: disconnectedDevices } = await supabase
      .from("devices")
      .select("*, profiles(full_name)")
      .eq("status", "disconnected")
      .lt("last_connected_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (disconnectedDevices && disconnectedDevices.length > 0) {
      const criticalCount = disconnectedDevices.length;
      
      await supabase.from("system_alerts").insert({
        alert_type: "devices_disconnected",
        severity: "warning",
        title: "Multiple Devices Disconnected",
        message: `${criticalCount} device(s) have been disconnected for more than 24 hours`,
        entity_type: "device",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        alerts_created: {
          expired: expiredSubs?.length || 0,
          expiring: expiringSoon?.length || 0,
          failed_broadcasts: failedBroadcasts?.length || 0,
          disconnected_devices: disconnectedDevices?.length || 0
        }
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in system monitor:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
