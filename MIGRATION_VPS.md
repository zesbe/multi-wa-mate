# Panduan Migrasi dari Railway ke VPS

## 🚨 Masalah: Stream Errored (conflict)

Error ini terjadi karena **ada 2 service yang running bersamaan**:
- Railway service (lama) masih aktif
- VPS service (baru) juga aktif
- Keduanya mencoba connect ke WhatsApp dengan session yang sama
- WhatsApp mendeteksi konflik → tutup koneksi dengan error "conflict"

---

## ✅ Solusi Step-by-Step

### **Step 1: Stop Railway Service**

**Pilihan A - Pause Service di Railway Dashboard:**
1. Login ke https://railway.app
2. Pilih project `multi-wa-mate`
3. Pilih service backend
4. Klik **Settings** → **Sleep Service** atau **Delete Service**

**Pilihan B - Hapus Deployment:**
```bash
# Jika pakai Railway CLI
railway down
```

⚠️ **PENTING**: Pastikan Railway service benar-benar STOP sebelum lanjut!

---

### **Step 2: Update BAILEYS_SERVICE_URL di Supabase**

1. Login ke Supabase Dashboard: https://supabase.com/dashboard
2. Pilih project: `ierdfxgeectqoekugyvb`
3. Buka **Edge Functions** → **Settings** atau **Secrets**
4. Update environment variable berikut:

```bash
# GANTI dari Railway URL
BAILEYS_SERVICE_URL=https://your-railway-app.railway.app

# KE VPS URL baru
BAILEYS_SERVICE_URL=http://YOUR_VPS_IP:3000
# atau
BAILEYS_SERVICE_URL=https://your-vps-domain.com
```

5. **Redeploy** semua Edge Functions yang menggunakan variable ini:
   - `send-crm-message`
   - `whatsapp-baileys`
   - `api-device-management`
   - `get-device-qr`

**Cara Redeploy Edge Functions:**
```bash
# Di terminal VPS atau local
cd /home/ubuntu/multi-wa-mate
npx supabase functions deploy send-crm-message
npx supabase functions deploy whatsapp-baileys
npx supabase functions deploy api-device-management
npx supabase functions deploy get-device-qr
npx supabase functions deploy sync-whatsapp-groups
```

Atau via Supabase Dashboard:
- Buka setiap function → **Redeploy**

---

### **Step 3: Clear Session Data & Reconnect**

Jalankan script SQL di Supabase SQL Editor:

```sql
-- 1. Lihat device yang bermasalah
SELECT id, name, phone_number, status, updated_at
FROM devices
WHERE user_id = auth.uid()
ORDER BY updated_at DESC;

-- 2. Reset device yang conflict (GANTI <device_id> dengan ID device kamu)
UPDATE devices
SET
  status = 'disconnected',
  auth_state = NULL,
  qr_code = NULL,
  pairing_code = NULL,
  updated_at = NOW()
WHERE id = '<device_id>';

-- Contoh:
-- UPDATE devices SET status = 'disconnected', auth_state = NULL WHERE id = 'xxx-xxx-xxx';
```

---

### **Step 4: Restart VPS Service**

```bash
# SSH ke VPS
ssh ubuntu@YOUR_VPS_IP

# Restart service dengan PM2
pm2 restart multi-wa-mate

# Cek logs
pm2 logs multi-wa-mate --lines 50

# Atau jika tidak pakai PM2
cd /home/ubuntu/multi-wa-mate/railway-service
node index.js
```

---

### **Step 5: Scan QR Code Lagi**

1. Buka aplikasi HalloWa di browser
2. Pergi ke halaman **Devices**
3. Klik device yang bermasalah
4. Generate QR Code baru
5. Scan dengan WhatsApp
6. **HARUS BERHASIL** tanpa error conflict lagi!

---

## 🔍 Verifikasi Berhasil

Cek log VPS harus menunjukkan:
```
✅ [NAMA_DEVICE] Connected successfully
📱 [NAMA_DEVICE] Phone: +62812345...
```

**TIDAK ADA** error seperti:
```
❌ Stream Errored (conflict)
❌ Connection closed with 440
```

---

## 📋 Checklist Migrasi

- [ ] Railway service di-stop/delete
- [ ] BAILEYS_SERVICE_URL di Supabase sudah update ke VPS
- [ ] Edge Functions sudah redeploy
- [ ] Session data device di-clear
- [ ] VPS service sudah restart
- [ ] QR Code di-scan ulang
- [ ] Device status: **connected** ✅
- [ ] Test kirim pesan dari CRM Chat berhasil
- [ ] Test broadcast berhasil

---

## 🛠️ Environment Variables VPS

Pastikan VPS sudah ada environment variables berikut:

```bash
# File: /home/ubuntu/multi-wa-mate/railway-service/.env

SUPABASE_URL=https://ierdfxgeectqoekugyvb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=3000

# Optional untuk production
NODE_ENV=production
```

Cara set dengan PM2:
```bash
pm2 start index.js --name multi-wa-mate --env production
```

---

## 🚀 Tips Production VPS

### 1. Gunakan PM2 untuk Auto-Restart
```bash
# Install PM2 globally
npm install -g pm2

# Start dengan PM2
cd /home/ubuntu/multi-wa-mate/railway-service
pm2 start index.js --name multi-wa-mate

# Auto-start on reboot
pm2 startup
pm2 save
```

### 2. Setup Nginx Reverse Proxy (Opsional)
```nginx
# /etc/nginx/sites-available/hallowa
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Monitor Logs
```bash
# Real-time logs
pm2 logs multi-wa-mate

# Save logs to file
pm2 logs multi-wa-mate > logs.txt
```

### 4. Firewall Rules
```bash
# Allow port 3000
sudo ufw allow 3000/tcp

# Atau jika pakai Nginx
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## ❓ Troubleshooting

### Masih ada error "conflict" setelah restart?

1. **Cek Railway benar-benar mati:**
   ```bash
   # Test Railway endpoint
   curl https://your-old-railway-url.railway.app/health
   # Harus timeout atau 404
   ```

2. **Clear semua session di database:**
   ```sql
   UPDATE devices SET auth_state = NULL, status = 'disconnected';
   ```

3. **Hapus folder sessions di VPS:**
   ```bash
   rm -rf /home/ubuntu/multi-wa-mate/railway-service/baileys_sessions/*
   ```

4. **Restart VPS service:**
   ```bash
   pm2 restart multi-wa-mate
   ```

### Error "Cannot connect to Supabase"?

- Pastikan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY benar
- Cek network VPS bisa akses Supabase:
  ```bash
  curl https://ierdfxgeectqoekugyvb.supabase.co
  ```

### Edge Functions masih call Railway URL?

- Clear cache Supabase Functions
- Redeploy manual semua functions
- Atau update langsung di Supabase Dashboard → Functions → Code Editor

---

## 📞 Support

Jika masih ada masalah, cek:
1. PM2 logs: `pm2 logs multi-wa-mate --lines 100`
2. Supabase logs: Dashboard → Logs
3. Network connectivity: `ping ierdfxgeectqoekugyvb.supabase.co`
4. Port accessible: `netstat -tlnp | grep 3000`

---

**Last updated**: 2025-11-08
