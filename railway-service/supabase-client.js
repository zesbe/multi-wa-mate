/**
 * Supabase Client for Database Integration
 * Handles device status, session management, and message history
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

class SupabaseClient {
  /**
   * Update device status in database
   */
  async updateDeviceStatus(deviceId, status, additionalData = {}) {
    try {
      const { error } = await supabase
        .from('devices')
        .update({
          status,
          last_connected: status === 'connected' ? new Date().toISOString() : undefined,
          ...additionalData,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);

      if (error) {
        console.error(`❌ Failed to update device ${deviceId} status:`, error);
        return false;
      }

      console.log(`✅ Device ${deviceId} status updated to: ${status}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating device status:`, error);
      return false;
    }
  }

  /**
   * Get device by ID with user info
   */
  async getDevice(deviceId) {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('id', deviceId)
        .single();

      if (error) {
        console.error(`❌ Failed to get device ${deviceId}:`, error);
        return null;
      }

      return data;
    } catch (error) {
      console.error(`❌ Error getting device:`, error);
      return null;
    }
  }

  /**
   * Save WhatsApp session data to database
   */
  async saveSession(deviceId, sessionData) {
    try {
      const { error } = await supabase
        .from('devices')
        .update({
          session_data: sessionData,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);

      if (error) {
        console.error(`❌ Failed to save session for device ${deviceId}:`, error);
        return false;
      }

      console.log(`✅ Session saved for device ${deviceId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error saving session:`, error);
      return false;
    }
  }

  /**
   * Load WhatsApp session data from database
   */
  async loadSession(deviceId) {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('session_data')
        .eq('id', deviceId)
        .single();

      if (error || !data?.session_data) {
        console.log(`ℹ️ No session found for device ${deviceId}`);
        return null;
      }

      console.log(`✅ Session loaded for device ${deviceId}`);
      return data.session_data;
    } catch (error) {
      console.error(`❌ Error loading session:`, error);
      return null;
    }
  }

  /**
   * Clear session data from database
   */
  async clearSession(deviceId) {
    try {
      const { error } = await supabase
        .from('devices')
        .update({
          session_data: null,
          status: 'disconnected',
          qr_code: null,
          pairing_code: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);

      if (error) {
        console.error(`❌ Failed to clear session for device ${deviceId}:`, error);
        return false;
      }

      console.log(`✅ Session cleared for device ${deviceId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error clearing session:`, error);
      return false;
    }
  }

  /**
   * Save message to history
   */
  async saveMessage(deviceId, userId, message) {
    try {
      const { error } = await supabase
        .from('message_history')
        .insert({
          device_id: deviceId,
          user_id: userId,
          from_number: message.key?.remoteJid || 'unknown',
          message_content: message.message ? JSON.stringify(message.message) : null,
          message_type: message.messageType || 'text',
          is_from_me: message.key?.fromMe || false,
          timestamp: new Date(message.messageTimestamp * 1000 || Date.now()).toISOString()
        });

      if (error) {
        console.error(`❌ Failed to save message:`, error);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`❌ Error saving message:`, error);
      return false;
    }
  }

  /**
   * Get pending broadcasts for a device
   */
  async getPendingBroadcasts(deviceId) {
    try {
      const { data, error } = await supabase
        .from('broadcasts')
        .select('*')
        .eq('device_id', deviceId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        console.error(`❌ Failed to get broadcasts:`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error(`❌ Error getting broadcasts:`, error);
      return [];
    }
  }

  /**
   * Update broadcast status
   */
  async updateBroadcastStatus(broadcastId, status, stats = {}) {
    try {
      const { error } = await supabase
        .from('broadcasts')
        .update({
          status,
          sent_count: stats.sent_count,
          failed_count: stats.failed_count,
          updated_at: new Date().toISOString()
        })
        .eq('id', broadcastId);

      if (error) {
        console.error(`❌ Failed to update broadcast status:`, error);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`❌ Error updating broadcast:`, error);
      return false;
    }
  }

  /**
   * Get user's subscription info
   */
  async getUserSubscription(userId) {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          plans (
            name,
            device_limit,
            contact_limit,
            broadcast_limit
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error) {
        console.log(`ℹ️ No active subscription for user ${userId}`);
        return null;
      }

      return data;
    } catch (error) {
      console.error(`❌ Error getting subscription:`, error);
      return null;
    }
  }
}

module.exports = new SupabaseClient();
