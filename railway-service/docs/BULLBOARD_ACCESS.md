# 📊 BullBoard Dashboard - Access Guide

## 🎯 Apa itu BullBoard?

**BullBoard** adalah **web dashboard** untuk monitoring BullMQ job queue secara visual.

Kamu bisa lihat:
- ✅ Berapa job yang **waiting** (antri)
- ✅ Berapa job yang **active** (sedang proses)
- ✅ Berapa job yang **completed** (selesai)
- ✅ Berapa job yang **failed** (gagal)
- ✅ Detail setiap job (data, error, timing)
- ✅ Retry failed jobs
- ✅ Delete jobs

---

## 🌐 **CARA ACCESS BULLBOARD**

### **Option 1: Standalone Server** (Recommended untuk Development)

```bash
# Start monitoring dashboard (port 3001)
cd railway-service
node monitoring/dashboard-server.js

# Output:
# 🖥️  Monitoring dashboard running on port 3001
# 🔗 Dashboard: http://localhost:3001/admin/queues
# 📊 Queue Stats API: http://localhost:3001/api/queue-stats
```

**Access:**
```
URL:      http://localhost:3001/admin/queues
Username: admin
Password: changeme123
```

**Ubah Password:**
```bash
# Di .env
ADMIN_PASSWORD=your_super_secure_password

# Atau environment variable
export ADMIN_PASSWORD="my_secure_pass"
node monitoring/dashboard-server.js
```

---

### **Option 2: Production (Railway/VPS)**

#### **A. Railway Deployment**

**Step 1:** Add service di Railway

1. Go to Railway project
2. **"+ New Service"**
3. Select **"Empty Service"**
4. Name: `hallowa-monitoring`

**Step 2:** Add environment variables

```env
MONITORING_PORT=3001
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here

# Redis connection (same as main service)
UPSTASH_REDIS_URL=rediss://default:password@...
```

**Step 3:** Configure service

- **Start Command:** `node monitoring/dashboard-server.js`
- **Root Directory:** `/railway-service`

**Step 4:** Deploy & Access

Railway auto-generate URL:
```
https://hallowa-monitoring-production.up.railway.app/admin/queues
```

---

#### **B. VPS Deployment (dengan PM2)**

**ecosystem.config.js** (sudah include monitoring):

```javascript
module.exports = {
  apps: [
    {
      name: 'hallowa-baileys',
      script: 'index.js',
      // ... config main app
    },
    {
      name: 'hallowa-monitoring',
      script: 'monitoring/dashboard-server.js',
      cwd: '/home/hallowa/HalloWa.id/railway-service',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        MONITORING_PORT: 3001,
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      },
    },
  ],
};
```

**Start:**
```bash
# Start both services
pm2 start ecosystem.config.js

# Check status
pm2 status

# Output:
# hallowa-baileys     ✅ online
# hallowa-monitoring  ✅ online
```

**Access:**
```
http://your-vps-ip:3001/admin/queues
```

**Setup Nginx Reverse Proxy:**

```nginx
# Add to Nginx config
location /admin/queues {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;

    # Optional: Restrict by IP
    allow 123.456.789.0;  # Your IP
    deny all;
}
```

**Access via domain:**
```
https://your-domain.com/admin/queues
```

---

## 🖼️ **TAMPILAN DASHBOARD**

### **Main View:**

```
┌─────────────────────────────────────────────────────┐
│  🎯 Bull Dashboard                                  │
│  Queue: broadcasts                                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📊 OVERVIEW                                        │
│  ┌────────┬────────┬────────┬────────┐            │
│  │Waiting │ Active │Complete│ Failed │            │
│  │   3    │   1    │  1,245 │   12   │            │
│  └────────┴────────┴────────┴────────┘            │
│                                                     │
│  📋 JOBS                                            │
│  ┌─ Status ─┬─ ID ──────────┬─ Progress ─┬─────┐ │
│  │          │                │            │     │ │
│  │ ✅ Done  │ broadcast-123 │ 100%       │[View]│ │
│  │          │ 1000/1000 sent│ 45s        │[Del]│ │
│  ├──────────┼────────────────┼────────────┼─────┤ │
│  │ 🔄 Active│ broadcast-456 │ 65%        │[View]│ │
│  │          │ 650/1000 sent │ 30s        │[Stop]│ │
│  ├──────────┼────────────────┼────────────┼─────┤ │
│  │ ⏳ Wait  │ broadcast-789 │ 0%         │[View]│ │
│  │          │ 0/500 queued  │ -          │[Del]│ │
│  ├──────────┼────────────────┼────────────┼─────┤ │
│  │ ❌ Failed│ broadcast-012 │ Failed     │[View]│ │
│  │          │ Device offline│ 3 attempts │[Retry]│
│  └──────────┴────────────────┴────────────┴─────┘ │
│                                                     │
│  [Refresh] [Clear Completed] [Settings]            │
└─────────────────────────────────────────────────────┘
```

### **Job Detail View:**

Click job untuk see details:

```
┌─────────────────────────────────────────────────────┐
│  Job Details: broadcast-abc-123                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Status: ✅ Completed                              │
│  Progress: 100% (1000/1000)                        │
│                                                     │
│  ⏱️ TIMING                                          │
│  Created:  2025-11-13 10:30:00                     │
│  Started:  2025-11-13 10:30:15 (+15s wait)         │
│  Finished: 2025-11-13 10:31:00 (45s duration)      │
│                                                     │
│  📦 DATA                                            │
│  {                                                  │
│    "broadcastId": "abc-123",                       │
│    "userId": "user-xyz",                           │
│    "deviceId": "device-001",                       │
│    "targetContacts": 1000,                         │
│    "message": "Hello customer..."                  │
│  }                                                  │
│                                                     │
│  ✅ RESULT                                          │
│  {                                                  │
│    "success": true,                                │
│    "sentCount": 995,                               │
│    "failedCount": 5,                               │
│    "totalContacts": 1000                           │
│  }                                                  │
│                                                     │
│  [Back] [Delete]                                   │
└─────────────────────────────────────────────────────┘
```

### **Failed Job Detail:**

```
┌─────────────────────────────────────────────────────┐
│  Job Details: broadcast-def-456                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Status: ❌ Failed                                 │
│  Progress: 0%                                       │
│                                                     │
│  ❌ ERROR                                           │
│  Device device-001 not connected                   │
│                                                     │
│  Attempts: 3/3                                      │
│  - Attempt 1: Failed at 10:30:00                   │
│  - Attempt 2: Failed at 10:30:05 (backoff: 5s)     │
│  - Attempt 3: Failed at 10:30:15 (backoff: 10s)    │
│                                                     │
│  📋 STACK TRACE                                     │
│  Error: Device abc-123 not connected               │
│    at processBroadcastJob (...)                    │
│    at Worker.processJob (...)                      │
│                                                     │
│  [Retry Now] [Delete] [Back]                       │
└─────────────────────────────────────────────────────┘
```

---

## 🎮 **FITUR DASHBOARD**

### **1. Queue Statistics (Real-time)**
- 📊 Waiting: Jobs dalam antrian
- 🔄 Active: Jobs sedang diproses
- ✅ Completed: Jobs selesai
- ❌ Failed: Jobs gagal
- ⏰ Delayed: Jobs di-schedule

### **2. Job List dengan Filters**
- Filter by status (all, waiting, active, completed, failed)
- Search by job ID
- Sort by time, status, priority
- Pagination (10/50/100 per page)

### **3. Job Actions**
- **View:** Lihat detail lengkap
- **Retry:** Retry failed jobs
- **Delete:** Hapus jobs
- **Pause/Resume:** Pause queue

### **4. Bulk Actions**
- Clear all completed jobs
- Retry all failed jobs
- Delete old jobs

### **5. Queue Settings**
- Concurrency adjustment
- Rate limiting
- Job retention settings

---

## 📊 **STATS API (JSON)**

Untuk monitoring programmatic:

```bash
# Get queue stats (JSON)
curl http://localhost:3001/api/queue-stats

# Response:
{
  "enabled": true,
  "timestamp": "2025-11-13T10:30:00Z",
  "queues": {
    "broadcasts": {
      "name": "broadcasts",
      "counts": {
        "waiting": 5,
        "active": 2,
        "completed": 1245,
        "failed": 12,
        "delayed": 0,
        "total": 1264
      },
      "health": "healthy"
    }
  },
  "dashboardUrl": "/admin/queues"
}
```

**Use Cases:**
- External monitoring (Grafana, Datadog)
- Health checks
- Alerts (jika failed > threshold)
- Analytics

---

## 🔐 **SECURITY**

### **Change Default Password:**

```bash
# .env
ADMIN_PASSWORD=SuperSecure_Pass_12345!

# Atau via environment variable
export ADMIN_PASSWORD="my_very_secure_password_here"
```

### **Restrict by IP (Nginx):**

```nginx
location /admin/queues {
    # Only allow from specific IPs
    allow 1.2.3.4;      # Your office IP
    allow 5.6.7.8;      # Your home IP
    deny all;           # Block others

    proxy_pass http://127.0.0.1:3001;
}
```

### **Add SSL/HTTPS (Production):**

Automatic dengan Railway atau via Certbot (VPS):

```bash
# VPS dengan Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

---

## 🛠️ **TROUBLESHOOTING**

### **Problem: Dashboard Not Loading**

**Check:**
```bash
# Is monitoring server running?
pm2 status hallowa-monitoring

# Check logs
pm2 logs hallowa-monitoring

# Test port
curl http://localhost:3001/health
```

**Fix:**
```bash
# Restart monitoring
pm2 restart hallowa-monitoring

# Or start manually
node monitoring/dashboard-server.js
```

---

### **Problem: "Queue Not Found"**

**Cause:** UPSTASH_REDIS_URL not set

**Fix:**
```bash
# Check environment
echo $UPSTASH_REDIS_URL

# Should output: rediss://default:password@...

# If empty, add to .env:
UPSTASH_REDIS_URL=rediss://default:password@host.upstash.io:6379
```

---

### **Problem: Authentication Failed**

**Fix:**
```bash
# Check credentials
Username: admin
Password: [check ADMIN_PASSWORD env var]

# Reset password:
export ADMIN_PASSWORD="new_password"
pm2 restart hallowa-monitoring
```

---

## ✅ **QUICK START**

**Development (Local):**
```bash
cd railway-service
node monitoring/dashboard-server.js

# Open browser:
http://localhost:3001/admin/queues
# Login: admin / changeme123
```

**Production (PM2):**
```bash
pm2 start ecosystem.config.js
pm2 save

# Access:
https://your-domain.com/admin/queues
```

**Environment Variables:**
```env
MONITORING_PORT=3001
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
UPSTASH_REDIS_URL=rediss://...
```

---

## 🎯 **USE CASES**

### **1. Monitor Broadcast Status**
- See how many broadcasts are queued
- Check which ones are processing
- Identify failed broadcasts

### **2. Debug Failed Jobs**
- See error messages
- View stack trace
- Retry manually

### **3. Performance Monitoring**
- Job throughput (jobs/minute)
- Average duration
- Success rate

### **4. Capacity Planning**
- If queue always full → need more workers
- If jobs failing → need fix code/device
- If slow processing → optimize delay

---

## 📱 **MOBILE ACCESS**

Dashboard responsive untuk mobile:

```
✅ View on phone
✅ View on tablet
✅ All features available
✅ Touch-friendly UI
```

---

## 🎉 **SUMMARY**

**BullBoard Dashboard:**
- ✅ Web UI untuk queue monitoring
- ✅ Real-time statistics
- ✅ Job details & debugging
- ✅ Retry failed jobs
- ✅ Easy to use

**Access:**
- Development: `http://localhost:3001/admin/queues`
- Production: `https://your-domain.com/admin/queues`
- Login: admin / [ADMIN_PASSWORD]

**Setup:**
```bash
node monitoring/dashboard-server.js
```

**Perfect untuk:**
- Monitoring broadcast progress
- Debugging failures
- Performance analysis
- Operations management

🎯 **Super helpful tool!**
