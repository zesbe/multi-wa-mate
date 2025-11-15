# 🏢 MULTI-SERVER DEPLOYMENT GUIDE

## Enterprise-Grade Multi-Server Setup for HalloWa.id

**Version:** 2.0.0
**Last Updated:** 2025-11-14
**Status:** Production Ready ✅

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Server Identification](#server-identification)
5. [Setup Instructions](#setup-instructions)
6. [Environment Configuration](#environment-configuration)
7. [Database Setup](#database-setup)
8. [Testing & Validation](#testing--validation)
9. [Monitoring](#monitoring)
10. [Troubleshooting](#troubleshooting)
11. [Security Considerations](#security-considerations)

---

## 🎯 Overview

### What is Multi-Server Support?

The Multi-Server feature enables you to run multiple backend instances simultaneously, each handling a subset of WhatsApp devices. This provides:

- **High Availability**: If one server goes down, others continue serving
- **Load Distribution**: Devices are automatically distributed across healthy servers
- **Scalability**: Add more servers as your user base grows
- **Geographic Distribution**: Deploy servers in different regions for lower latency

### Key Features

✅ **Automatic Device Assignment**: Devices are automatically assigned to the least-loaded server
✅ **Conflict Prevention**: Each device connects to ONLY ONE server (no duplicate connections)
✅ **Health Monitoring**: Automatic health checks and failover
✅ **Graceful Shutdown**: Servers properly mark themselves as inactive on shutdown
✅ **Audit Logging**: All server assignments are logged for compliance
✅ **Security First**: Input validation, sanitization, and ownership verification

---

## 🏗️ Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   Admin Panel                            │
│         (Manage Servers via UI)                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│              Supabase Database                           │
│  - backend_servers table (server registry)              │
│  - devices table (with assigned_server_id)              │
│  - server_logs table (audit trail)                      │
└────────────────┬────────────────────────────────────────┘
                 │
         ┌───────┴───────┬───────────┬──────────┐
         ▼               ▼           ▼          ▼
    ┌─────────┐    ┌─────────┐  ┌─────────┐  ┌─────────┐
    │Server 1 │    │Server 2 │  │Server 3 │  │Server N │
    │Singapore│    │ Tokyo   │  │  USA    │  │  ...    │
    └─────────┘    └─────────┘  └─────────┘  └─────────┘
         │               │           │            │
         └───────────────┴───────────┴────────────┘
                         │
                         ▼
                 WhatsApp Devices
```

### How It Works

1. **Server Registration**
   - Each server identifies itself using SERVER_ID (env var) or hostname
   - On startup, server registers in `backend_servers` table
   - Server marked as `is_active: true`

2. **Device Assignment**
   - When device connects, it checks `assigned_server_id`
   - If `null`, device is auto-assigned to current server
   - If assigned, only that server handles the device

3. **Load Balancing**
   - New devices assigned to server with lowest load
   - Assignment considers: priority, capacity, response time
   - Database function `get_best_available_server()` handles selection

4. **Health Monitoring**
   - Each server updates `last_health_check` every 60s
   - Admin panel can trigger health checks via `/health` endpoint
   - Failed servers trigger device reassignment

5. **Graceful Shutdown**
   - On SIGTERM/SIGINT, server marks itself `is_active: false`
   - Devices remain assigned (will reconnect when server restarts)
   - No data loss or connection disruption

---

## ✅ Prerequisites

Before setting up multi-server deployment:

### Required Infrastructure

- ✅ **Supabase Project** (PostgreSQL database)
- ✅ **Multiple Server Instances** (Railway, VPS, or Cloud)
- ✅ **Redis Instance** (Upstash recommended for BullMQ)
- ✅ **Node.js 20.x+** on all servers

### Required Database Tables

The following tables must exist (created via migrations):

- `backend_servers` - Server registry
- `devices` - Device table with `assigned_server_id` column
- `server_logs` - Audit logging
- `device_connection_logs` - Connection event tracking

### Network Requirements

- ✅ All servers can reach Supabase (outbound HTTPS)
- ✅ All servers can reach Redis (outbound TCP)
- ✅ Health check endpoint accessible (for admin panel)

---

## 🆔 Server Identification

### Server ID Priority Order

Each server identifies itself using the first available method:

1. **`SERVER_ID` environment variable** (RECOMMENDED)
   - Explicit identifier (e.g., `server-sg-1`, `server-tokyo-1`)
   - Most predictable and controllable

2. **`RAILWAY_STATIC_URL`** (Railway deployments)
   - Automatically available on Railway
   - Format: `project-name-production.up.railway.app`

3. **`RAILWAY_SERVICE_NAME`** (Railway service name)
   - Service name from Railway config

4. **`HOSTNAME`** (Generic deployments)
   - OS-level hostname

5. **Generated ID** (Fallback)
   - Format: `server-{timestamp}-{random}`
   - Used only if all above methods fail

### Server ID Security Constraints

- ✅ Min length: 3 characters
- ✅ Max length: 128 characters
- ✅ Allowed characters: `a-z A-Z 0-9 _ - .`
- ❌ Path traversal patterns blocked (`..`, `//`)
- ❌ Reserved keywords blocked (`null`, `admin`, `root`, `system`)

---

## 🚀 Setup Instructions

### Step 1: Add Server via Admin Panel

1. Login to Admin Panel → `/admin/server-management`
2. Click **"Tambah Server"**
3. Fill in server details:
   ```
   Server Name: Server Singapore 1
   Server URL: https://your-railway-app.railway.app
   Server Type: railway (or vps/cloud/dedicated)
   Region: SG
   Max Capacity: 50 devices
   Priority: 10 (higher = preferred)
   API Key: (optional, for additional security)
   ```
4. Click **"Tambah Server"**
5. Server appears in list with status "Belum terkoneksi"

### Step 2: Deploy Backend Service

**For Railway:**

1. Create new service in Railway
2. Connect to GitHub repository
3. Set build command: `cd railway-service && npm install`
4. Set start command: `cd railway-service && node index.js`
5. Add environment variables (see below)
6. Deploy

**For VPS/Cloud:**

```bash
# Clone repository
git clone <YOUR_REPO_URL>
cd HalloWa.id/railway-service

# Install dependencies
npm install

# Set environment variables
cp .env.example .env
nano .env  # Edit with your values

# Start service (using PM2 recommended)
pm2 start index.js --name "hallowa-server-1"
pm2 save
pm2 startup
```

### Step 3: Configure Environment Variables

Add these environment variables to your server:

```bash
# 🔑 REQUIRED: Server Identification
SERVER_ID=server-sg-1  # Unique identifier for this server

# 🔑 REQUIRED: Database
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# 🔑 REQUIRED: Redis (for BullMQ)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...
UPSTASH_REDIS_URL=rediss://xxx@xxx.upstash.io:6379

# 🔑 REQUIRED: Security
INTERNAL_API_KEY=your-32-char-random-string

# ⚙️ OPTIONAL: Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

### Step 4: Verify Server Registration

1. Check server logs for successful startup:
   ```
   ✅ Server identified: server-sg-1
   ✅ Server assignment service ready
   🌐 HTTP Server listening on port 3000
   ```

2. In Admin Panel, check server status:
   - Should show as "Aktif" (green)
   - Current Load: 0 devices
   - Response Time: < 500ms

3. Click **"Health Check"** to verify connectivity

### Step 5: Test Device Assignment

1. Go to user dashboard → Add Device
2. Start WhatsApp connection
3. Check logs - should see:
   ```
   🔧 Auto-assigning device to server: server-sg-1
   ✅ Device auto-assigned successfully
   ```

4. In database, verify `devices.assigned_server_id = server-sg-1`

5. Verify in Admin Panel → Server Management:
   - Current Load should increase to 1

---

## 🔧 Environment Configuration

### Complete .env Template

```bash
# ==============================================================================
# 🏢 MULTI-SERVER CONFIGURATION - HalloWa.id
# ==============================================================================

# ------------------------------------------------------------------------------
# 🆔 SERVER IDENTIFICATION (Choose ONE method)
# ------------------------------------------------------------------------------

# Method 1: Explicit Server ID (RECOMMENDED for production)
# Use unique identifier for each server (e.g., server-sg-1, server-tokyo-1)
# Format: alphanumeric, underscores, hyphens, dots only
# Length: 3-128 characters
SERVER_ID=server-singapore-1

# Method 2: Railway Automatic (leave SERVER_ID unset if using Railway)
# RAILWAY_STATIC_URL and RAILWAY_SERVICE_NAME are auto-set by Railway

# Method 3: Custom Hostname (leave SERVER_ID unset for generic deployments)
# HOSTNAME is auto-set by OS

# ------------------------------------------------------------------------------
# 🗄️ DATABASE CONFIGURATION
# ------------------------------------------------------------------------------

# Supabase Project URL (required)
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co

# Supabase Service Role Key (required - has admin access)
# ⚠️ SECURITY: Never commit this key to git!
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx...

# ------------------------------------------------------------------------------
# 📦 REDIS CONFIGURATION (for BullMQ message queue)
# ------------------------------------------------------------------------------

# Upstash Redis REST API (required for HTTP operations)
UPSTASH_REDIS_REST_URL=https://xxxxx-xxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Upstash Redis TCP URL (required for BullMQ)
# Format: rediss://default:{password}@{host}:{port}
UPSTASH_REDIS_URL=rediss://default:xxxxxxxxxxxxx@xxxxx-xxxxx.upstash.io:6379

# ------------------------------------------------------------------------------
# 🔒 SECURITY CONFIGURATION
# ------------------------------------------------------------------------------

# Internal API Key (required - for inter-service authentication)
# ⚠️ SECURITY: Generate a strong random string (min 32 chars)
# Generate with: openssl rand -base64 32
INTERNAL_API_KEY=your-secure-random-32-character-string-here

# ------------------------------------------------------------------------------
# ⚙️ SERVER CONFIGURATION
# ------------------------------------------------------------------------------

# HTTP server port (default: 3000)
PORT=3000

# Node environment (production | development | test)
NODE_ENV=production

# Log level (error | warn | info | debug)
# Use 'info' for production, 'debug' for troubleshooting
LOG_LEVEL=info

# ------------------------------------------------------------------------------
# 📊 MONITORING CONFIGURATION (optional)
# ------------------------------------------------------------------------------

# BullBoard monitoring port (default: 3001)
# Leave empty to disable monitoring dashboard
MONITORING_PORT=3001

# BullBoard admin credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# ------------------------------------------------------------------------------
# 🌐 DEPLOYMENT INFO (optional - for logging/monitoring)
# ------------------------------------------------------------------------------

# Deployment region (for multi-region setups)
REGION=singapore

# Server description
SERVER_DESCRIPTION=Primary server in Singapore region
```

### Security Best Practices

1. **Never commit .env files to git**
   ```bash
   # Add to .gitignore
   echo ".env" >> .gitignore
   echo ".env.*" >> .gitignore
   ```

2. **Use environment variables managers**
   - Railway: Built-in environment variables
   - Docker: Use secrets or env files
   - PM2: Use ecosystem.config.js

3. **Rotate secrets regularly**
   - INTERNAL_API_KEY: Rotate every 90 days
   - Database keys: Use read-only keys when possible

4. **Use different keys per environment**
   - Development: dev-xxx
   - Staging: staging-xxx
   - Production: prod-xxx

---

## 💾 Database Setup

### Check Required Tables

```sql
-- Verify backend_servers table exists
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'backend_servers';

-- Verify assigned_server_id column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'devices'
AND column_name = 'assigned_server_id';
```

### Manually Register Server (if needed)

```sql
-- Insert server record
INSERT INTO backend_servers (
  id,
  server_name,
  server_url,
  server_type,
  region,
  max_capacity,
  priority,
  is_active,
  is_healthy
) VALUES (
  'server-sg-1',  -- Must match SERVER_ID env var
  'Server Singapore 1',
  'https://your-app.railway.app',
  'railway',
  'SG',
  50,
  10,
  true,
  true
);
```

---

## ✅ Testing & Validation

### Test 1: Server Identification

```bash
# Start server and check logs
npm start

# Expected output:
# ✅ Server identified: server-sg-1
# ✅ Server assignment service ready
```

### Test 2: Device Assignment

```bash
# Query devices assigned to your server
SELECT id, device_name, assigned_server_id, status
FROM devices
WHERE assigned_server_id = 'server-sg-1';
```

### Test 3: No Conflicts with Multiple Servers

```bash
# Start Server 1 (SERVER_ID=server-1)
# Start Server 2 (SERVER_ID=server-2)

# Add device on Server 1
# Check logs - should see: "Auto-assigning device to server-1"

# Server 2 logs should show: "Device not assigned to this server - skipping"
```

### Test 4: Failover Scenario

```bash
# 1. Assign device to Server 1
# 2. Stop Server 1
# 3. In Admin Panel, mark Server 1 as unhealthy
# 4. Device should auto-reassign to Server 2
```

---

## 📊 Monitoring

### Health Check Endpoint

Each server exposes `/health` endpoint:

```bash
curl https://your-server.railway.app/health

# Response:
{
  "status": "ok",
  "activeConnections": 5,
  "timestamp": "2025-11-14T10:30:00.000Z"
}
```

### Admin Panel Monitoring

Navigate to `/admin/server-management` to view:

- ✅ Total servers and active servers
- ✅ Current load per server
- ✅ Response time per server
- ✅ Health check status
- ✅ Last health check timestamp

### Log Monitoring

Key log messages to monitor:

```bash
# Successful device assignment
✅ Device assigned to server

# Server identification
✅ Server identified: server-sg-1

# Health updates
💓 Server health monitoring started

# Warnings
⚠️ Device not assigned to this server - skipping

# Errors
❌ Failed to assign device to server
```

---

## 🔍 Troubleshooting

### Issue: Device Gets "Conflict" Error

**Symptom**: Device status shows "conflict" error
**Cause**: Multiple servers trying to connect to same device

**Solution**:
1. Check `devices.assigned_server_id` in database
2. Verify only ONE server has matching SERVER_ID
3. Restart all servers to ensure clean state
4. Check server logs for "Device not assigned to this server" messages

### Issue: Server Not Appearing in Admin Panel

**Symptom**: Server running but not visible in admin panel

**Solution**:
1. Verify `backend_servers` table has record matching SERVER_ID
2. Manually insert server record (see Database Setup section)
3. Check server logs for registration errors
4. Verify Supabase connection (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)

### Issue: Devices Not Auto-Assigning

**Symptom**: Devices remain with `assigned_server_id = null`

**Solution**:
1. Check server logs for "Auto-assigning device" messages
2. Verify serverAssignmentService initialized successfully
3. Check database permissions (service role key has INSERT access)
4. Verify `get_best_available_server()` function exists in database

### Issue: Server Shows as Unhealthy

**Symptom**: Admin panel shows server with red status

**Solution**:
1. Click "Health Check" button in admin panel
2. Check server logs for errors during health update
3. Verify server is reachable from admin panel (check firewall)
4. Verify `/health` endpoint responds correctly
5. Check `last_health_check` timestamp in database

---

## 🔒 Security Considerations

### Server ID Security

- ✅ **Validated Format**: Only alphanumeric, underscores, hyphens, dots
- ✅ **Path Traversal Prevention**: Blocks `..` and `//` patterns
- ✅ **Reserved Keywords**: Blocks `admin`, `root`, `system`, etc.
- ✅ **Length Limits**: 3-128 characters enforced

### Device Assignment Security

- ✅ **Ownership Verification**: Device user_id checked before assignment
- ✅ **UUID Validation**: Device and user IDs validated as proper UUIDs
- ✅ **SQL Injection Prevention**: Parameterized queries only
- ✅ **Audit Logging**: All assignments logged to `server_logs`

### Network Security

- ✅ **HTTPS Only**: All external communication encrypted
- ✅ **Internal API Key**: Inter-service authentication required
- ✅ **Rate Limiting**: Prevents abuse of health check endpoints
- ✅ **CORS Configuration**: Restrict to allowed origins

### Database Security

- ✅ **Row Level Security (RLS)**: Enabled on all tables
- ✅ **Service Role Key**: Secure storage, never exposed to frontend
- ✅ **Function Security**: `SECURITY DEFINER` with `SET search_path`
- ✅ **Encrypted Transit**: Supabase connections use TLS

---

## 📚 Additional Resources

### Related Documentation

- [Backend Service README](./README.md)
- [Server Identifier API](./services/server/serverIdentifier.js)
- [Server Assignment Service API](./services/server/serverAssignmentService.js)
- [Device Manager API](./services/device/deviceManager.js)

### Database Functions

- `get_best_available_server()` - Load balancing algorithm
- `update_server_load()` - Trigger to update server metrics
- `reassign_devices_on_server_failure()` - Automatic failover

### Support

- GitHub Issues: https://github.com/zesbe/HalloWa.id/issues
- Documentation: See `/docs` folder

---

**Last Updated:** 2025-11-14
**Version:** 2.0.0
**Status:** ✅ Production Ready
