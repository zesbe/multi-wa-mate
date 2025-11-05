# 🚀 WhatsApp Baileys Service for Railway

Backend service yang menyediakan integrasi WhatsApp menggunakan Baileys library. Service ini mendukung multi-device WhatsApp connection via QR code atau pairing code, broadcast messaging, dan real-time message handling.

## 📋 Features

- ✅ **Multi-Device Connection**: Connect multiple WhatsApp devices
- 📱 **QR Code Authentication**: Scan QR code for quick connection
- 🔑 **Pairing Code Authentication**: Use 8-digit pairing code
- 📤 **Broadcast Messaging**: Send messages to multiple contacts
- 💬 **Message History**: Track all incoming/outgoing messages
- 🤖 **Chatbot Support**: Auto-reply based on rules
- 🔄 **Auto-Reconnection**: Automatic reconnection on disconnect
- 📊 **Session Management**: Persistent WhatsApp sessions

## 🏗️ Architecture

```
Frontend (Vercel)
    ↓ HTTP/REST API
Railway Service (Node.js)
    ↓ Baileys Socket
WhatsApp Web Protocol
    ↓
Database (Supabase)
    ↓ Real-time Updates
Frontend
```

## Deploy ke Railway

### 1. Push ke GitHub
File ini sudah ada di repo GitHub kamu (auto-sync dari Lovable).

### 2. Deploy ke Railway
1. Buka [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Pilih repository ini
4. **PENTING:** Set Root Directory ke `railway-service`
5. Tambahkan Environment Variables:
   ```
   SUPABASE_URL=https://ierdfxgeectqoekugyvb.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=[ambil dari Supabase Dashboard → Settings → API]
   PORT=3000
   ```
6. Deploy!

### 3. Generate Domain
1. Setelah deploy sukses, buka tab "Settings"
2. Scroll ke "Networking"
3. Klik "Generate Domain"
4. Salin URL yang muncul (misalnya: `multi-wa-mate-production.up.railway.app`)

### 4. Update Frontend Environment Variables
Add Railway service URL to your Vercel/frontend environment:
```env
VITE_RAILWAY_SERVICE_URL=https://your-railway-url.up.railway.app
```

### 4. Test
1. Buka frontend Lovable
2. Tambah device baru
3. Klik "Scan QR"
4. QR code akan muncul dari Railway service
5. Scan dengan WhatsApp
6. Status berubah "Connected" ✅

## 📡 API Endpoints

### Health Check
```bash
GET /health
```
Response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-05T12:00:00.000Z",
  "activeConnections": 2,
  "connections": {
    "qr": 1,
    "pairing": 1
  }
}
```

### QR Code Connection

**Initialize QR Connection**
```bash
POST /api/device/qr/init
Content-Type: application/json

{
  "deviceId": "uuid-device-id"
}
```

**Get QR Code**
```bash
GET /api/device/qr/:deviceId
```
Response:
```json
{
  "qrCode": "data:image/png;base64,..."
}
```

### Pairing Code Connection

**Initialize Pairing Connection**
```bash
POST /api/device/pairing/init
Content-Type: application/json

{
  "deviceId": "uuid-device-id",
  "phoneNumber": "628123456789"
}
```
Response:
```json
{
  "success": true,
  "pairingCode": "1234-5678"
}
```

**Get Pairing Code**
```bash
GET /api/device/pairing/:deviceId
```

### Device Management

**Disconnect Device**
```bash
POST /api/device/disconnect
Content-Type: application/json

{
  "deviceId": "uuid-device-id",
  "connectionType": "qr"  // or "pairing"
}
```

**Clear Session**
```bash
POST /api/device/clear-session
Content-Type: application/json

{
  "deviceId": "uuid-device-id",
  "connectionType": "qr"  // or "pairing"
}
```

**Get Device Status**
```bash
GET /api/device/status/:deviceId
```
Response:
```json
{
  "deviceId": "uuid",
  "isConnected": true,
  "status": "connected",
  "phoneNumber": "628123456789",
  "lastConnected": "2025-11-05T12:00:00.000Z",
  "connectionType": "qr"
}
```

### Messaging

**Send Single Message**
```bash
POST /api/message/send
Content-Type: application/json

{
  "deviceId": "uuid-device-id",
  "phoneNumber": "628123456789",
  "message": "Hello World!",
  "mediaUrl": "https://example.com/image.jpg",  // optional
  "mediaType": "image"  // optional: image, document, video
}
```

**Process Broadcasts (Manual Trigger)**
```bash
POST /api/broadcast/process
Content-Type: application/json

{
  "deviceId": "uuid-device-id"
}
```

## Monitoring

### Check Logs
```bash
railway logs
```

### Health Check
Akses: `https://your-railway-url.railway.app/health`

Response:
```json
{
  "status": "ok",
  "activeConnections": 2,
  "timestamp": "2025-10-21T12:00:00.000Z"
}
```

## Environment Variables Required

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJhbGci...` |
| `PORT` | Port untuk health check | `3000` |

## 📁 File Structure

```
railway-service/
├── index.js                        # Main server entry point
├── connection-manager-qr.js        # QR code connection handler
├── connection-manager-pairing.js   # Pairing code connection handler
├── broadcast-processor.js          # Broadcast message processor
├── baileys-config.js              # Baileys socket configuration
├── supabase-client.js             # Supabase database integration
├── redis-client.js                # Redis caching for QR/pairing codes
├── package.json                   # Dependencies
├── .env.example                   # Environment variables template
├── .gitignore                     # Git ignore rules
└── README.md                      # Documentation
```

## Arsitektur

```
Frontend (Lovable/Vercel)
    ↓ Update status='connecting'
Database (Supabase)
    ↓ Real-time subscription
Railway Service (Baileys)
    ↓ Generate QR & update database
Database (Supabase)
    ↓ Frontend polls database
Frontend - Shows QR & Status
```

## Troubleshooting

### QR tidak muncul?
1. Check Railway logs: `railway logs`
2. Pastikan environment variables sudah di-set
3. Check database: 
   ```sql
   SELECT id, device_name, status, qr_code FROM devices WHERE status='connecting'
   ```

### Connection failed?
1. Restart Railway service
2. Clear session di frontend (button "Clear Session")
3. Check Railway logs untuk error

### Service tidak jalan?
1. Pastikan Root Directory = `railway-service`
2. Pastikan `package.json` ada di folder `railway-service`
3. Check Railway build logs

## Production Tips

- Railway akan auto-restart jika service crash
- Session data tersimpan di database (persistent)
- Multiple devices bisa connect sekaligus
- QR expire otomatis setelah 60 detik
