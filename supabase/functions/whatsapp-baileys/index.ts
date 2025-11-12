import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Store active connections
const connections = new Map();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const url = new URL(req.url);
  const deviceId = url.searchParams.get("deviceId");

  if (!deviceId) {
    return new Response("Device ID required", { status: 400 });
  }

  // Initialize Supabase client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Verify JWT token and authenticate user
  const authHeader = headers.get('authorization');
  if (!authHeader) {
    console.warn(`WebSocket connection attempt without authorization header for device ${deviceId}`);
    return new Response('Unauthorized: Missing authentication token', { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    console.warn(`WebSocket authentication failed for device ${deviceId}:`, authError?.message);
    return new Response('Unauthorized: Invalid authentication token', { status: 401 });
  }

  console.log(`User ${user.id} attempting to connect to device ${deviceId}`);

  // Verify device ownership
  const { data: device, error: deviceError } = await supabase
    .from('devices')
    .select('user_id, device_name')
    .eq('id', deviceId)
    .eq('user_id', user.id)
    .single();

  if (deviceError || !device) {
    console.warn(`Device ownership verification failed for user ${user.id}, device ${deviceId}`);
    return new Response('Forbidden: Device not found or access denied', { status: 403 });
  }

  console.log(`Access granted: User ${user.id} connected to device ${device.device_name} (${deviceId})`);

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = async () => {
    console.log(`WebSocket opened for device: ${deviceId}`);
    connections.set(deviceId, socket);

    try {
      // Update device status to connecting
      await supabase
        .from('devices')
        .update({ 
          status: 'connecting',
          server_id: crypto.randomUUID().substring(0, 8)
        })
        .eq('id', deviceId);

      // Generate QR code placeholder (Baileys must run in a Node service)
      setTimeout(async () => {
        const qrData = `whatsapp-login-${deviceId}-${Date.now()}`;
        
        // Generate QR code image data
        const qrCode = await generateQRCode(qrData);
        
        // Update device with QR code
        await supabase
          .from('devices')
          .update({ qr_code: qrCode })
          .eq('id', deviceId);

        // Send QR to client
        socket.send(JSON.stringify({
          type: 'qr',
          qr: qrCode,
          timestamp: Date.now()
        }));
      }, 300);

    } catch (error) {
      console.error('Error in WebSocket handler:', error);
      socket.send(JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Received message:', data);

      switch (data.type) {
        case 'logout':
          await supabase
            .from('devices')
            .update({ 
              status: 'disconnected',
              phone_number: null,
              qr_code: null,
              session_data: null
            })
            .eq('id', deviceId);

          socket.send(JSON.stringify({
            type: 'logged_out',
            timestamp: Date.now()
          }));
          break;

        case 'send_message':
          // Placeholder: requires Baileys Node service to actually send
          socket.send(JSON.stringify({
            type: 'message_sent',
            messageId: crypto.randomUUID(),
            timestamp: Date.now()
          }));
          break;

        case 'clear_session':
          await supabase
            .from('devices')
            .update({ 
              status: 'disconnected',
              session_data: null,
              qr_code: null,
              phone_number: null
            })
            .eq('id', deviceId);

          socket.send(JSON.stringify({
            type: 'session_cleared',
            timestamp: Date.now()
          }));
          break;

        default:
            console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  socket.onclose = () => {
    console.log(`WebSocket closed for device: ${deviceId}`);
    connections.delete(deviceId);
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return response;
});

// Helper to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper function to generate QR code
async function generateQRCode(data: string): Promise<string> {
  try {
    // Generate QR code using an external API service
    const size = 300;
    const encodedData = encodeURIComponent(data);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}&format=png`;
    
    // Fetch the QR code image
    const response = await fetch(qrUrl);
    const blob = await response.arrayBuffer();
    
    // Convert to base64
    const base64 = arrayBufferToBase64(blob);
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('Error generating QR code:', error);
    // Fallback to simple SVG-based QR
    return generateSimpleSVGQR(data);
  }
}

// Fallback: Simple SVG-based visual QR (not scannable, just placeholder)
function generateSimpleSVGQR(data: string): string {
  const svg = `
    <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <rect x="20" y="20" width="40" height="40" fill="black"/>
      <rect x="240" y="20" width="40" height="40" fill="black"/>
      <rect x="20" y="240" width="40" height="40" fill="black"/>
      <rect x="130" y="130" width="40" height="40" fill="black"/>
      <text x="150" y="180" text-anchor="middle" font-size="12" fill="gray">
        Scan with WhatsApp
      </text>
      <text x="150" y="200" text-anchor="middle" font-size="8" fill="gray">
        ${data.substring(0, 30)}...
      </text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
