const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { supabase } = require('../../config/supabase');

/**
 * Auth state persisted in Supabase (no filesystem, no Redis)
 * @param {string} deviceId - Device ID
 * @returns {Promise<Object>} Auth state object with state and saveCreds function
 */
async function useSupabaseAuthState(deviceId) {
  let creds, keys;

  try {
    // Load from Supabase
    const { data } = await supabase
      .from('devices')
      .select('session_data')
      .eq('id', deviceId)
      .maybeSingle();

    const stored = data?.session_data || {};
    creds = stored.creds
      ? JSON.parse(JSON.stringify(stored.creds), BufferJSON.reviver)
      : initAuthCreds();
    keys = stored.keys
      ? JSON.parse(JSON.stringify(stored.keys), BufferJSON.reviver)
      : {};

  } catch (e) {
    console.error('❌ Failed loading session:', e);
    creds = initAuthCreds();
    keys = {};
  }

  const persist = async () => {
    const sessionData = {
      creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
      keys: JSON.parse(JSON.stringify(keys, BufferJSON.replacer)),
      saved_at: new Date().toISOString(),
    };

    // Save to Supabase only
    await supabase
      .from('devices')
      .update({ session_data: sessionData })
      .eq('id', deviceId)
      .then(({ error }) => {
        if (error) console.error('❌ Supabase save error:', error);
      });
  };

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = keys[type] || {};
          const result = {};
          for (const id of ids) result[id] = data[id] || null;
          return result;
        },
        set: async (data) => {
          for (const type of Object.keys(data)) {
            keys[type] = keys[type] || {};
            Object.assign(keys[type], data[type]);
          }
          await persist();
        },
      },
    },
    saveCreds: persist,
  };
}

module.exports = { useSupabaseAuthState };
