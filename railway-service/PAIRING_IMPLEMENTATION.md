# WhatsApp Pairing Code Implementation

## 📱 Overview

Implementasi pairing code untuk HalloWa menggunakan Baileys v7 dengan penyimpanan session di Supabase dan cache temporary di Redis (optional).

## 🏗️ Architecture

```
┌─────────────┐
│   Frontend  │ (React - Devices.tsx)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Supabase   │ (Database + Edge Functions)
│  - devices  │
│  - qr_code  │
│  - pairing_code
│  - session_data
└──────┬──────┘
       │
       ▼
┌──────────────┐
│  Railway     │ (Backend Service)
│  Service     │
│  - index.js  │
│  - pairing-  │
│    handler   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Baileys    │ (WhatsApp Web API)
│   Socket     │
└──────────────┘
```

## 🔑 Pairing Code Flow

### 1. User Initiates Pairing
```
Frontend (Devices.tsx) → User clicks "Connect with Pairing Code"
│
├─ Input: Device Name + Phone Number (62xxx)
│
└─ Database Update:
   - status: 'connecting'
   - connection_method: 'pairing'
   - phone_for_pairing: '62xxx'
```

### 2. Backend Detects Connection Request
```
Railway Service (index.js) → Polling detects 'connecting' device
│
├─ Creates WhatsApp Socket (Baileys)
│
└─ Loads/Creates auth state from Supabase
```

### 3. Socket Connection Established
```
connection.update event → connection = 'open' OR ws.readyState = 1
│
├─ Check: Is pairing mode enabled?
│  └─ Yes: connection_method = 'pairing' AND phone_for_pairing exists
│
├─ Wait for socket to be ready (websocket OPEN state)
│
└─ Trigger pairing code generation
```

### 4. Pairing Code Generation (with Retry)
```
stablePairingHandler.generatePairingCode()
│
├─ Format phone number (normalize to 62xxx format)
│
├─ Wait for socket ready (max 10 seconds)
│  └─ Check: sock.ws.readyState === 1 (OPEN)
│
├─ Request pairing code (with 3 retries)
│  └─ sock.requestPairingCode(phone)
│     ├─ Retry 1: immediate
│     ├─ Retry 2: 4 second delay
│     └─ Retry 3: 6 second delay
│
├─ Format code: XXXX-XXXX
│
├─ Store in Redis (optional cache, 10 min TTL)
│
└─ Store in Supabase (primary storage)
   - pairing_code: 'XXXX-XXXX'
   - status: 'waiting_pairing'
```

### 5. Frontend Displays Pairing Code
```
Frontend polling → Fetch from Edge Function (get-device-qr)
│
├─ Edge Function reads from Supabase database
│
├─ Returns: { pairingCode: 'XXXX-XXXX' }
│
└─ Display code with copy button
   Instructions:
   1. Open WhatsApp on your phone
   2. Go to Settings → Linked Devices
   3. Tap "Link a Device"
   4. Select "Link with phone number"
   5. Enter the code
```

### 6. User Enters Code in WhatsApp
```
WhatsApp App → User enters pairing code
│
├─ WhatsApp validates code
│
└─ Sends authentication handshake to Baileys socket
```

### 7. Connection Success
```
connection.update event → connection = 'open' AND sock.user exists
│
├─ Save credentials to Supabase (session_data)
│
├─ Update database:
│  - status: 'connected'
│  - phone_number: extracted from sock.user.id
│  - pairing_code: null (cleared after success)
│  - last_connected_at: timestamp
│
└─ Frontend shows success notification
```

## 📦 Data Storage

### Supabase (Primary Storage)
```sql
devices table:
- id (uuid)
- user_id (uuid)
- device_name (text)
- status (text): connecting | waiting_pairing | connected | disconnected
- phone_number (text): WhatsApp number after connection
- connection_method (text): 'qr' | 'pairing'
- phone_for_pairing (text): Phone number for pairing
- pairing_code (text): Temporary pairing code (cleared after use)
- qr_code (text): QR code data URL (for QR method)
- session_data (jsonb): Baileys auth state (creds + keys)
- error_message (text): Error details for troubleshooting
- last_connected_at (timestamp)
```

### Redis (Optional Cache)
```
Key Pattern: pairing:{deviceId}
Value: Pairing code string
TTL: 600 seconds (10 minutes)

Purpose:
- Reduce database load for temporary data
- Faster read access
- Auto-expiry
- Non-critical (fallback to Supabase if Redis fails)
```

## 🔧 Key Components

### 1. pairing-handler-stable.js
**Responsibilities:**
- Format phone numbers (handle Indonesian format)
- Wait for socket ready state
- Request pairing code from Baileys
- Retry mechanism (3 attempts with exponential backoff)
- Error handling (rate limits, timeouts)
- Store code in Redis + Supabase
- Session management (prevent duplicate requests)

**Key Methods:**
```javascript
generatePairingCode(sock, device, supabase)
  → Returns: boolean (success/failure)

waitForSocket(sock, maxWait)
  → Checks: ws.readyState === 1 (OPEN)
  → Returns: boolean (ready/timeout)

formatPhoneNumber(phone)
  → Normalizes to: 62xxx format
  → Handles: 08xx, 8xx, +62, 62

formatPairingCode(code)
  → Formats: XXXX-XXXX for display
```

### 2. index.js (Main Service)
**Responsibilities:**
- Poll Supabase for device status changes
- Create WhatsApp sockets (Baileys)
- Handle connection lifecycle
- Trigger pairing code generation at right time
- Session recovery on Railway restarts
- Update database with connection status

**Connection Flow:**
```javascript
connectWhatsApp(device, isRecovery)
  → Create socket with Baileys
  → Load auth state from Supabase
  → Listen to connection.update events
  → Trigger pairing when socket ready
  → Save session when connected
```

### 3. get-device-qr Edge Function
**Responsibilities:**
- Secure access to temporary codes
- Authentication check (verify user owns device)
- Fetch from Supabase database
- Return QR or pairing code to frontend

## ⚙️ Configuration

### Environment Variables
```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Redis (Optional)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxx...

# Railway
RAILWAY_STATIC_URL=xxx.railway.app
PORT=3000
```

### Baileys Socket Config
```javascript
makeWASocket({
  version: await fetchLatestBaileysVersion(),
  auth: state, // from Supabase
  browser: ['HalloWa', 'Chrome', '120.0.0'],
  connectTimeoutMs: 60_000,
  keepAliveIntervalMs: 10_000,
  printQRInTerminal: false,
  syncFullHistory: false,
  markOnlineOnConnect: true,
})
```

## 🐛 Troubleshooting

### Issue: Pairing code tidak muncul
**Possible Causes:**
1. Socket not ready (ws.readyState !== 1)
2. Phone number format invalid
3. Rate limited by WhatsApp
4. Network timeout

**Solutions:**
```javascript
// Check logs:
"⏳ Waiting for socket to be ready..."
"✅ Socket is ready (WebSocket OPEN)"
"🔐 Attempt 1/3 to get pairing code..."
"✅ Got pairing code on attempt 1"

// If timeout:
- Increase maxWait in waitForSocket (default 10s)
- Check Railway service logs for websocket state
- Verify phone number format: must be 62xxx (Indonesian)

// If rate limited:
- Wait 60 seconds before retry
- WhatsApp limits: ~5 requests per minute
```

### Issue: Socket tidak ready
**Check:**
```javascript
sock.ws.readyState
// 0 = CONNECTING
// 1 = OPEN ✅ (ready for pairing)
// 2 = CLOSING
// 3 = CLOSED
```

**Fix:**
- Wait longer for socket to open
- Check network connectivity
- Verify Baileys version compatibility

### Issue: Code expired
**Pairing codes expire after ~10 minutes**

**Solution:**
- Click "Refresh Kode" button
- Generates new code
- Old code invalidated

## 🚀 Improvements Made

### Before (Issues):
❌ Single attempt only (pairingAttempted flag)
❌ Wrong timing (request too early)
❌ No socket state validation
❌ No retry mechanism
❌ Unclear error messages

### After (Fixed):
✅ **Retry mechanism**: 3 attempts with backoff (2s, 4s, 6s)
✅ **Better timing**: Wait for ws.readyState === 1 (OPEN)
✅ **Socket validation**: Check websocket connection state
✅ **Error handling**: Detailed logs, rate limit detection
✅ **User feedback**: Clear error messages in database
✅ **Session management**: Prevent duplicate requests
✅ **Non-blocking Redis**: Continues if Redis fails

## 📝 Testing Checklist

- [ ] Create new device with pairing method
- [ ] Enter valid Indonesian phone number (08xxx or 62xxx)
- [ ] Check Railway logs for pairing code generation
- [ ] Verify code appears in frontend within 10 seconds
- [ ] Copy code and paste in WhatsApp
- [ ] Verify connection success (status → 'connected')
- [ ] Check session saved in Supabase (session_data field)
- [ ] Test reconnection after Railway restart (should auto-recover)
- [ ] Test invalid phone number (should show error)
- [ ] Test rate limiting (multiple rapid requests)

## 🔐 Security Notes

1. **Pairing codes are temporary** (10 min expiry)
2. **Stored in database temporarily** (cleared after connection)
3. **Rate limited by WhatsApp** (prevents abuse)
4. **User authentication required** (Edge Function validates ownership)
5. **Session data encrypted** by Baileys (stored as JSON in Supabase)
6. **No passwords stored** (session tokens only)

## 📚 References

- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)
- [WhatsApp Multi-Device Protocol](https://github.com/WhiskeySockets/Baileys/blob/master/docs/multi-device.md)
- [Pairing Code API](https://github.com/WhiskeySockets/Baileys#pairing-code)

---

**Last Updated:** 2025-11-05
**Version:** 2.0 (Improved with retry mechanism)
