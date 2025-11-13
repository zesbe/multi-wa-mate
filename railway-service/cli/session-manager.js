#!/usr/bin/env node

/**
 * WhatsApp Session Manager CLI
 * Command-line tool for managing WhatsApp sessions
 *
 * Usage:
 *   node cli/session-manager.js list                    - List all devices
 *   node cli/session-manager.js clear <device-id>       - Clear device session
 *   node cli/session-manager.js clear-all               - Clear all sessions
 *   node cli/session-manager.js status <device-id>      - Get device status
 *   node cli/session-manager.js disconnect <device-id>  - Disconnect device
 *   node cli/session-manager.js stats                   - Show statistics
 */

const { supabase } = require('../config/supabase');
const redisClient = require('../redis-client');
const { validateDeviceId, isValidUUID, sanitizeErrorMessage } = require('../utils/inputValidation');

const COMMANDS = {
  LIST: 'list',
  CLEAR: 'clear',
  CLEAR_ALL: 'clear-all',
  STATUS: 'status',
  DISCONNECT: 'disconnect',
  STATS: 'stats',
  HELP: 'help',
};

/**
 * List all devices
 */
async function listDevices() {
  console.log('📱 Fetching all devices...\n');

  const { data, error } = await supabase
    .from('devices')
    .select('id, device_name, status, phone_number, user_id, last_connected_at, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('📭 No devices found');
    return;
  }

  console.log(`Found ${data.length} device(s):\n`);

  data.forEach((device, index) => {
    console.log(`${index + 1}. ${device.device_name || 'Unnamed Device'}`);
    console.log(`   ID: ${device.id}`);
    console.log(`   Status: ${device.status}`);
    console.log(`   Phone: ${device.phone_number || 'Not connected'}`);
    console.log(`   User ID: ${device.user_id}`);
    console.log(`   Last Connected: ${device.last_connected_at || 'Never'}`);
    console.log(`   Created: ${device.created_at}`);
    console.log('');
  });
}

/**
 * Clear device session
 */
async function clearDeviceSession(deviceId) {
  try {
    // Security: Validate device ID
    if (!isValidUUID(deviceId)) {
      console.error('❌ Invalid device ID format (must be UUID)');
      return;
    }

    const validatedDeviceId = validateDeviceId(deviceId);
    console.log(`🗑️  Clearing session for device: ${validatedDeviceId}\n`);

    // 1. Clear session data from database
    const { error: dbError } = await supabase
      .from('devices')
      .update({
        session_data: null,
        status: 'disconnected',
        phone_number: null,
        qr_code: null,
        pairing_code: null,
        last_connected_at: null,
      })
      .eq('id', validatedDeviceId);

    if (dbError) {
      console.error('❌ Error clearing database session:', sanitizeErrorMessage(dbError));
      return;
    }

    console.log('✅ Database session cleared');

    // 2. Clear Redis cache
    await redisClient.cleanupDevice(validatedDeviceId);
    console.log('✅ Redis cache cleared');

    console.log('\n✅ Session cleared successfully');
    console.log('ℹ️  Device can now reconnect with a fresh session');
  } catch (error) {
    console.error('❌ Error:', sanitizeErrorMessage(error));
  }
}

/**
 * Clear all sessions
 */
async function clearAllSessions() {
  console.log('🗑️  Clearing ALL sessions...\n');

  const { data: devices } = await supabase
    .from('devices')
    .select('id')
    .neq('status', 'disconnected');

  if (!devices || devices.length === 0) {
    console.log('📭 No active sessions to clear');
    return;
  }

  console.log(`Found ${devices.length} active session(s) to clear\n`);

  for (const device of devices) {
    await clearDeviceSession(device.id);
  }

  console.log('\n✅ All sessions cleared successfully');
}

/**
 * Get device status
 */
async function getDeviceStatus(deviceId) {
  try {
    // Security: Validate device ID
    if (!isValidUUID(deviceId)) {
      console.error('❌ Invalid device ID format (must be UUID)');
      return;
    }

    const validatedDeviceId = validateDeviceId(deviceId);
    console.log(`📊 Fetching status for device: ${validatedDeviceId}\n`);

    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('id', validatedDeviceId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error:', sanitizeErrorMessage(error));
      return;
    }

    if (!data) {
      console.error('❌ Device not found');
      return;
    }

  console.log('Device Information:');
  console.log('─'.repeat(50));
  console.log(`Name:           ${data.device_name || 'Unnamed'}`);
  console.log(`ID:             ${data.id}`);
  console.log(`Status:         ${data.status}`);
  console.log(`Phone:          ${data.phone_number || 'Not connected'}`);
  console.log(`User ID:        ${data.user_id}`);
  console.log(`Connection:     ${data.connection_method || 'N/A'}`);
  console.log(`Last Connected: ${data.last_connected_at || 'Never'}`);
  console.log(`Created:        ${data.created_at}`);
  console.log(`Multi-device:   ${data.is_multidevice ? 'Yes' : 'No'}`);
  console.log(`Server ID:      ${data.server_id || 'N/A'}`);

    // Check Redis cache
    const qrCode = await redisClient.getQRCode(validatedDeviceId);
    const pairingCode = await redisClient.getPairingCode(validatedDeviceId);

    console.log('\nCache Status:');
    console.log('─'.repeat(50));
    console.log(`QR Code cached: ${qrCode ? 'Yes' : 'No'}`);
    console.log(`Pairing code:   ${pairingCode || 'None'}`);

    // Session data
    console.log('\nSession Data:');
    console.log('─'.repeat(50));
    console.log(`Has session:    ${data.session_data ? 'Yes' : 'No'}`);

    if (data.session_data) {
      const savedAt = data.session_data.saved_at;
      console.log(`Session saved:  ${savedAt || 'Unknown'}`);
    }
  } catch (error) {
    console.error('❌ Error:', sanitizeErrorMessage(error));
  }
}

/**
 * Disconnect device
 */
async function disconnectDevice(deviceId) {
  try {
    // Security: Validate device ID
    if (!isValidUUID(deviceId)) {
      console.error('❌ Invalid device ID format (must be UUID)');
      return;
    }

    const validatedDeviceId = validateDeviceId(deviceId);
    console.log(`🔌 Disconnecting device: ${validatedDeviceId}\n`);

    const { error } = await supabase
      .from('devices')
      .update({
        status: 'disconnected',
        qr_code: null,
        pairing_code: null,
      })
      .eq('id', validatedDeviceId);

    if (error) {
      console.error('❌ Error:', sanitizeErrorMessage(error));
      return;
    }

    console.log('✅ Device disconnected');
    console.log('ℹ️  The device will be marked as disconnected and will attempt to reconnect');
  } catch (error) {
    console.error('❌ Error:', sanitizeErrorMessage(error));
  }
}

/**
 * Show statistics
 */
async function showStats() {
  console.log('📊 System Statistics\n');

  // Device stats
  const { data: devices } = await supabase
    .from('devices')
    .select('status');

  const statusCounts = {};
  devices?.forEach(device => {
    statusCounts[device.status] = (statusCounts[device.status] || 0) + 1;
  });

  console.log('Devices by Status:');
  console.log('─'.repeat(50));
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status.padEnd(15)}: ${count}`);
  });
  console.log(`  ${'TOTAL'.padEnd(15)}: ${devices?.length || 0}`);

  // Broadcast stats
  const { data: broadcasts } = await supabase
    .from('broadcasts')
    .select('status');

  const broadcastCounts = {};
  broadcasts?.forEach(broadcast => {
    broadcastCounts[broadcast.status] = (broadcastCounts[broadcast.status] || 0) + 1;
  });

  console.log('\nBroadcasts by Status:');
  console.log('─'.repeat(50));
  Object.entries(broadcastCounts).forEach(([status, count]) => {
    console.log(`  ${status.padEnd(15)}: ${count}`);
  });
  console.log(`  ${'TOTAL'.padEnd(15)}: ${broadcasts?.length || 0}`);

  // User stats
  const { count: userCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  console.log('\nUsers:');
  console.log('─'.repeat(50));
  console.log(`  Total users: ${userCount || 0}`);

  // Cache status
  console.log('\nCache Status:');
  console.log('─'.repeat(50));
  console.log(`  Redis enabled: ${redisClient.enabled ? 'Yes' : 'No'}`);
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
WhatsApp Session Manager CLI
════════════════════════════════════════════════════════════════

Usage:
  node cli/session-manager.js <command> [options]

Commands:
  list                      List all devices with their status
  clear <device-id>         Clear session data for a specific device
  clear-all                 Clear all device sessions
  status <device-id>        Show detailed status for a device
  disconnect <device-id>    Disconnect a device
  stats                     Show system statistics
  help                      Show this help message

Examples:
  node cli/session-manager.js list
  node cli/session-manager.js clear abc-123-def
  node cli/session-manager.js status abc-123-def
  node cli/session-manager.js clear-all
  node cli/session-manager.js stats

Environment Variables:
  SUPABASE_URL              Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY Service role key
  UPSTASH_REDIS_REST_URL    Redis REST URL (optional)
  UPSTASH_REDIS_REST_TOKEN  Redis REST token (optional)

Notes:
  - Make sure environment variables are set before running
  - Use clear-all with caution - it disconnects all devices
  - Clearing sessions requires devices to reconnect

════════════════════════════════════════════════════════════════
`);
}

/**
 * Main CLI handler
 */
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  console.log('');

  switch (command) {
    case COMMANDS.LIST:
      await listDevices();
      break;

    case COMMANDS.CLEAR:
      if (!arg) {
        console.error('❌ Error: Device ID required');
        console.log('Usage: node cli/session-manager.js clear <device-id>');
        process.exit(1);
      }
      await clearDeviceSession(arg);
      break;

    case COMMANDS.CLEAR_ALL:
      console.log('⚠️  WARNING: This will clear ALL device sessions!');
      console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
      await clearAllSessions();
      break;

    case COMMANDS.STATUS:
      if (!arg) {
        console.error('❌ Error: Device ID required');
        console.log('Usage: node cli/session-manager.js status <device-id>');
        process.exit(1);
      }
      await getDeviceStatus(arg);
      break;

    case COMMANDS.DISCONNECT:
      if (!arg) {
        console.error('❌ Error: Device ID required');
        console.log('Usage: node cli/session-manager.js disconnect <device-id>');
        process.exit(1);
      }
      await disconnectDevice(arg);
      break;

    case COMMANDS.STATS:
      await showStats();
      break;

    case COMMANDS.HELP:
    case undefined:
      showHelp();
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log('Run "node cli/session-manager.js help" for usage information');
      process.exit(1);
  }

  console.log('');
  process.exit(0);
}

// Run CLI
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = {
  listDevices,
  clearDeviceSession,
  clearAllSessions,
  getDeviceStatus,
  disconnectDevice,
  showStats,
};
