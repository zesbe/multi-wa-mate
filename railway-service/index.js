/**
 * WhatsApp Baileys Service - Main Entry Point
 * Provides REST API endpoints for WhatsApp operations
 * Handles QR code, pairing code, and broadcast messaging
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectionManagerQR = require('./connection-manager-qr');
const connectionManagerPairing = require('./connection-manager-pairing');
const broadcastProcessor = require('./broadcast-processor');
const supabaseClient = require('./supabase-client');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Track broadcast monitoring intervals
const broadcastIntervals = new Map();

// ==================== Health Check ====================

app.get('/health', (req, res) => {
  const activeQR = connectionManagerQR.getActiveConnections();
  const activePairing = connectionManagerPairing.getActiveConnections();
  const allActive = [...new Set([...activeQR, ...activePairing])];

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeConnections: allActive.length,
    connections: {
      qr: activeQR.length,
      pairing: activePairing.length
    }
  });
});

// ==================== QR Code Endpoints ====================

/**
 * Initialize QR code connection
 * POST /api/device/qr/init
 * Body: { deviceId: string }
 */
app.post('/api/device/qr/init', async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    console.log(`📱 Initializing QR connection for device: ${deviceId}`);

    const result = await connectionManagerQR.initConnection(deviceId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // Start broadcast monitoring for this device
    const socket = connectionManagerQR.getSocket(deviceId);
    if (socket) {
      const interval = broadcastProcessor.startMonitoring(deviceId, socket);
      broadcastIntervals.set(deviceId, interval);
    }

    res.json({ success: true, message: 'QR connection initialized' });
  } catch (error) {
    console.error('❌ Error initializing QR connection:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get QR code for a device
 * GET /api/device/qr/:deviceId
 */
app.get('/api/device/qr/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const qrCode = await connectionManagerQR.getQRCode(deviceId);

    if (!qrCode) {
      return res.status(404).json({ error: 'QR code not found or expired' });
    }

    res.json({ qrCode });
  } catch (error) {
    console.error('❌ Error getting QR code:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Pairing Code Endpoints ====================

/**
 * Initialize pairing code connection
 * POST /api/device/pairing/init
 * Body: { deviceId: string, phoneNumber: string }
 */
app.post('/api/device/pairing/init', async (req, res) => {
  try {
    const { deviceId, phoneNumber } = req.body;

    if (!deviceId || !phoneNumber) {
      return res.status(400).json({ error: 'deviceId and phoneNumber are required' });
    }

    console.log(`📱 Initializing pairing connection for device: ${deviceId}`);

    const result = await connectionManagerPairing.initConnection(deviceId, phoneNumber);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // Start broadcast monitoring for this device
    const socket = connectionManagerPairing.getSocket(deviceId);
    if (socket) {
      const interval = broadcastProcessor.startMonitoring(deviceId, socket);
      broadcastIntervals.set(deviceId, interval);
    }

    res.json({
      success: true,
      pairingCode: result.pairingCode,
      message: 'Pairing code generated'
    });
  } catch (error) {
    console.error('❌ Error initializing pairing connection:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get pairing code for a device
 * GET /api/device/pairing/:deviceId
 */
app.get('/api/device/pairing/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const pairingCode = await connectionManagerPairing.getPairingCode(deviceId);

    if (!pairingCode) {
      return res.status(404).json({ error: 'Pairing code not found or expired' });
    }

    res.json({ pairingCode });
  } catch (error) {
    console.error('❌ Error getting pairing code:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Device Management Endpoints ====================

/**
 * Disconnect device
 * POST /api/device/disconnect
 * Body: { deviceId: string, connectionType: 'qr' | 'pairing' }
 */
app.post('/api/device/disconnect', async (req, res) => {
  try {
    const { deviceId, connectionType = 'qr' } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    console.log(`🔌 Disconnecting device: ${deviceId}`);

    // Stop broadcast monitoring
    const interval = broadcastIntervals.get(deviceId);
    if (interval) {
      broadcastProcessor.stopMonitoring(interval);
      broadcastIntervals.delete(deviceId);
    }

    // Disconnect based on connection type
    let result;
    if (connectionType === 'pairing') {
      result = await connectionManagerPairing.disconnect(deviceId);
    } else {
      result = await connectionManagerQR.disconnect(deviceId);
    }

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, message: 'Device disconnected' });
  } catch (error) {
    console.error('❌ Error disconnecting device:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Clear device session
 * POST /api/device/clear-session
 * Body: { deviceId: string, connectionType: 'qr' | 'pairing' }
 */
app.post('/api/device/clear-session', async (req, res) => {
  try {
    const { deviceId, connectionType = 'qr' } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    console.log(`🗑️ Clearing session for device: ${deviceId}`);

    // Stop broadcast monitoring
    const interval = broadcastIntervals.get(deviceId);
    if (interval) {
      broadcastProcessor.stopMonitoring(interval);
      broadcastIntervals.delete(deviceId);
    }

    // Clear session based on connection type
    let result;
    if (connectionType === 'pairing') {
      result = await connectionManagerPairing.clearSession(deviceId);
    } else {
      result = await connectionManagerQR.clearSession(deviceId);
    }

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, message: 'Session cleared' });
  } catch (error) {
    console.error('❌ Error clearing session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get device status
 * GET /api/device/status/:deviceId
 */
app.get('/api/device/status/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Check both connection managers
    const isConnectedQR = connectionManagerQR.isConnected(deviceId);
    const isConnectedPairing = connectionManagerPairing.isConnected(deviceId);
    const isConnected = isConnectedQR || isConnectedPairing;

    // Get device info from database
    const device = await supabaseClient.getDevice(deviceId);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({
      deviceId,
      isConnected,
      status: device.status,
      phoneNumber: device.phone_number,
      lastConnected: device.last_connected,
      connectionType: isConnectedQR ? 'qr' : isConnectedPairing ? 'pairing' : 'none'
    });
  } catch (error) {
    console.error('❌ Error getting device status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Messaging Endpoints ====================

/**
 * Send a single message
 * POST /api/message/send
 * Body: { deviceId: string, phoneNumber: string, message: string, mediaUrl?: string }
 */
app.post('/api/message/send', async (req, res) => {
  try {
    const { deviceId, phoneNumber, message, mediaUrl, mediaType = 'image' } = req.body;

    if (!deviceId || !phoneNumber || !message) {
      return res.status(400).json({ error: 'deviceId, phoneNumber, and message are required' });
    }

    // Get socket from either connection manager
    let socket = connectionManagerQR.getSocket(deviceId);
    if (!socket) {
      socket = connectionManagerPairing.getSocket(deviceId);
    }

    if (!socket) {
      return res.status(404).json({ error: 'Device not connected' });
    }

    // Prepare media data if URL provided
    let mediaData = null;
    if (mediaUrl) {
      mediaData = {
        url: mediaUrl,
        type: mediaType
      };
    }

    // Send message
    const result = await broadcastProcessor.sendSingleMessage(
      socket,
      phoneNumber,
      message,
      mediaData
    );

    res.json({ success: true, result });
  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process broadcasts for a device (manual trigger)
 * POST /api/broadcast/process
 * Body: { deviceId: string }
 */
app.post('/api/broadcast/process', async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    // Get socket from either connection manager
    let socket = connectionManagerQR.getSocket(deviceId);
    if (!socket) {
      socket = connectionManagerPairing.getSocket(deviceId);
    }

    if (!socket) {
      return res.status(404).json({ error: 'Device not connected' });
    }

    // Process broadcasts
    await broadcastProcessor.processBroadcasts(deviceId, socket);

    res.json({ success: true, message: 'Broadcast processing initiated' });
  } catch (error) {
    console.error('❌ Error processing broadcasts:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Error Handling ====================

app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ==================== Server Startup ====================

app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   🚀 WhatsApp Baileys Service Started  ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log(`📡 Server running on port: ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('📋 Available Endpoints:');
  console.log('  POST /api/device/qr/init');
  console.log('  GET  /api/device/qr/:deviceId');
  console.log('  POST /api/device/pairing/init');
  console.log('  GET  /api/device/pairing/:deviceId');
  console.log('  POST /api/device/disconnect');
  console.log('  POST /api/device/clear-session');
  console.log('  GET  /api/device/status/:deviceId');
  console.log('  POST /api/message/send');
  console.log('  POST /api/broadcast/process');
  console.log('');
  console.log('✅ Ready to handle connections!');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️ Shutting down gracefully...');

  // Stop all broadcast monitoring
  for (const [deviceId, interval] of broadcastIntervals.entries()) {
    broadcastProcessor.stopMonitoring(interval);
    console.log(`🛑 Stopped broadcast monitoring for device: ${deviceId}`);
  }

  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️ SIGTERM received, shutting down...');

  // Stop all broadcast monitoring
  for (const [deviceId, interval] of broadcastIntervals.entries()) {
    broadcastProcessor.stopMonitoring(interval);
    console.log(`🛑 Stopped broadcast monitoring for device: ${deviceId}`);
  }

  process.exit(0);
});
