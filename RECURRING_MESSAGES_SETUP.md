# 🔄 Recurring Messages - Setup & Architecture Guide

## 📋 Overview

Recurring Messages adalah fitur **profesional** untuk mengirim pesan WhatsApp secara otomatis dan berulang sesuai jadwal. Fitur ini terintegrasi penuh dengan **BullMQ queue system** untuk reliability, monitoring, dan retry mechanism yang sama dengan fitur Broadcast.

---

## 🏗️ Arsitektur (Professional Grade)

### Flow Diagram:
```
┌─────────────────┐
│   PostgreSQL    │ ← User creates recurring message
│   (Supabase)    │
│                 │
│  recurring_     │
│  messages       │
└────────┬────────┘
         │
         │ pg_cron checks every 5 minutes
         ▼
┌─────────────────┐
│  Edge Function  │ ← Finds due messages
│   process-      │
│   recurring-    │
│   messages      │
└────────┬────────┘
         │
         │ Creates broadcast jobs (NOT direct send)
         ▼
┌─────────────────┐      ┌──────────────┐
│   broadcasts    │─────▶│   BullMQ     │ ← Jobs added to Redis queue
│   (pending)     │      │   Queue      │
└─────────────────┘      │  (Redis)     │
                         └──────┬───────┘
                                │
                                │ Workers process with retry
                                ▼
                         ┌──────────────┐
                         │   Railway    │ ← Actual WhatsApp sending
                         │   Baileys    │
                         │   Service    │
                         └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │  Recipients  │ ← Messages delivered
                         │  (WhatsApp)  │
                         └──────────────┘
```

### 🎯 Why BullMQ Queue? (Professional Approach)

❌ **OLD WAY** (Direct Send):
- Edge function langsung kirim message
- No retry jika gagal
- No monitoring
- Server crash = data loss
- Inconsistent dengan broadcast

✅ **NEW WAY** (BullMQ Queue):
- **Automatic Retry**: 3 attempts dengan exponential backoff
- **Monitoring Dashboard**: Track via BullBoard (`/bullboard`)
- **Job Persistence**: Survive server restarts (Redis)
- **Rate Limiting**: Proper throttling & delays
- **Progress Tracking**: Real-time status updates
- **Consistent Architecture**: Same system as broadcasts
- **Professional Grade**: Industry standard untuk queue systems

### 📊 Comparison

| Feature | Direct Send | BullMQ Queue |
|---------|-------------|--------------|
| Retry on Failure | ❌ No | ✅ 3 attempts |
| Monitoring | ❌ No | ✅ BullBoard |
| Persistence | ❌ Lost on crash | ✅ Saved in Redis |
| Rate Limiting | ⚠️ Basic | ✅ Advanced |
| Progress Tracking | ❌ No | ✅ Real-time |
| Scalability | ⚠️ Limited | ✅ High |
| Architecture | ⚠️ Inconsistent | ✅ Consistent |

---

## ✨ Fitur Recurring Messages

Fitur ini memungkinkan Anda untuk mengirim pesan WhatsApp secara otomatis dan berulang sesuai jadwal yang ditentukan.

### Fitur Utama:
- 📅 **Multiple Frequency**: Harian, Mingguan, Bulanan, atau Custom
- ⏰ **Flexible Scheduling**: Pilih hari dan jam pengiriman
- 👥 **Contact Management**: Kirim ke kontak atau nomor manual
- 🔒 **Safety Features**: Delay, randomization, batch processing
- 📊 **Detailed Tracking**: Monitor sent/failed counts dan next send time
- 🎯 **Smart Limits**: Max executions dan end date
- 📱 **Mobile Friendly**: Fully responsive design

## 🚀 Setup Cron Job

Untuk mengaktifkan fitur recurring messages, Anda perlu setup cron job di Supabase untuk menjalankan edge function `process-recurring-messages` secara berkala.

### Langkah 1: Buka SQL Editor
1. Buka Supabase Dashboard: https://supabase.com/dashboard/project/ierdfxgeectqoekugyvb
2. Navigasi ke **SQL Editor** di sidebar
3. Klik **New Query**

### Langkah 2: Jalankan SQL Berikut

```sql
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule recurring message processing every 5 minutes
SELECT cron.schedule(
  'process-recurring-messages-every-5min',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
        url:='https://ierdfxgeectqoekugyvb.supabase.co/functions/v1/process-recurring-messages',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllcmRmeGdlZWN0cW9la3VneXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0ODA2MTAsImV4cCI6MjA3NjA1NjYxMH0.L4FLuxGgsuMe_yY1OLOpGzNRsFObXbQzvSV4iukpa9o"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
```

### Langkah 3: Verifikasi Cron Job
Jalankan query ini untuk melihat cron job yang aktif:

```sql
SELECT * FROM cron.job;
```

Anda akan melihat job bernama `process-recurring-messages-every-5min` di list.

### Langkah 4 (Opsional): Unschedule Cron Job
Jika ingin menghapus cron job:

```sql
SELECT cron.unschedule('process-recurring-messages-every-5min');
```

## 📖 Cara Penggunaan

### 1. Buat Recurring Message
1. Buka menu **Recurring** di sidebar
2. Klik tombol **"Buat Recurring"**
3. Isi form:
   - **Nama Campaign**: Nama untuk identifikasi
   - **Device**: Pilih device yang terkoneksi
   - **Pesan**: Tulis pesan yang akan dikirim
   - **Media URL**: (Opsional) Link gambar/media

### 2. Atur Jadwal
- **Frekuensi**: 
  - Harian: Kirim setiap hari
  - Mingguan: Pilih hari-hari tertentu (Senin-Minggu)
  - Bulanan: Pilih tanggal tertentu (1-31)
  - Custom: Atur interval manual (setiap X hari)
- **Waktu Kirim**: Jam pengiriman
- **Mulai Dari**: Tanggal mulai
- **Berakhir Pada**: (Opsional) Tanggal selesai
- **Max Eksekusi**: (Opsional) Berhenti setelah X kali kirim

### 3. Atur Keamanan & Media
- **Delay**: Jeda antar pesan (5-30 detik recommended)
- **Randomize Delay**: Tambah variasi delay untuk keamanan
- **Media URL**: (Opsional) Link gambar/video yang akan dikirim
  
  **💡 Cara Menggunakan Media URL:**
  1. Upload gambar ke hosting (Google Drive, Imgur, atau hosting lain)
  2. Pastikan link dapat diakses publik (bukan private/restricted)
  3. Copy **direct link** gambar (harus berakhiran .jpg, .png, .gif, .mp4)
  4. Paste link ke field "Media URL"
  
  **Contoh Valid URLs:**
  - ✅ `https://i.imgur.com/abc123.jpg`
  - ✅ `https://example.com/images/promo.png`
  - ✅ `https://drive.google.com/uc?export=download&id=xxx` (Google Drive direct link)
  
  **Format Supported:**
  - Images: JPG, PNG, GIF
  - Videos: MP4
  - Max Size: 50MB
  
  **Tips:**
  - Gambar akan dikirim bersamaan dengan teks
  - Pastikan link tidak expired
  - Test link di browser dulu (harus langsung tampil gambar)

### 4. Pilih Penerima
- **Dari Kontak**: Pilih dari daftar kontak
- **Input Manual**: Masukkan nomor manual (628xxx)

### 5. Simpan dan Aktifkan
- Klik **"Buat"** untuk menyimpan
- Toggle status untuk mengaktifkan/menonaktifkan

## 🎯 Tips Best Practices

### Keamanan WhatsApp
1. **Gunakan Delay Cukup**: Minimal 5 detik antar pesan
2. **Aktifkan Randomize**: Variasi delay terlihat lebih natural
3. **Batch Processing**: Untuk banyak kontak, gunakan batch size 50
4. **Hindari Spam**: Jangan kirim terlalu sering ke kontak yang sama

### Penjadwalan
1. **Start Date**: Set untuk masa depan jika belum siap
2. **End Date**: Set limit untuk campaign yang terbatas
3. **Max Executions**: Berguna untuk campaign promo terbatas
4. **Weekly Schedule**: Ideal untuk newsletter atau reminder

### Monitoring
1. **Check Next Send**: Lihat kapan kirim berikutnya
2. **Monitor Stats**: Pantau sent/failed counts
3. **View Logs**: Cek recurring_message_logs untuk detail
4. **Toggle Status**: Pause jika perlu adjustment

## 🔧 Troubleshooting

### Pesan Tidak Terkirim
1. **Cek Device Status**: Pastikan device status "connected"
2. **Cek Cron Job**: Pastikan cron job aktif
3. **Cek Server**: Pastikan backend server healthy
4. **Cek Logs**: Lihat edge function logs di Supabase

### Edge Function Logs
Untuk melihat logs:
1. Buka: https://supabase.com/dashboard/project/ierdfxgeectqoekugyvb/functions/process-recurring-messages/logs
2. Filter by date/time
3. Check untuk error messages

### Database Queries
```sql
-- Lihat recurring messages yang aktif
SELECT * FROM recurring_messages WHERE is_active = true;

-- Lihat next send time
SELECT name, next_send_at, total_sent, total_failed 
FROM recurring_messages 
WHERE is_active = true
ORDER BY next_send_at;

-- Lihat execution logs
SELECT * FROM recurring_message_logs 
ORDER BY execution_time DESC 
LIMIT 10;
```

## 📊 Database Schema

### recurring_messages
- Menyimpan konfigurasi recurring messages
- Auto-calculate next_send_at via trigger
- Track total sent/failed counts

### recurring_message_logs
- Log setiap eksekusi
- Track success/failure per execution
- Useful untuk audit dan debugging

## 🔗 Link Penting

- **Edge Function Logs**: [View Logs](https://supabase.com/dashboard/project/ierdfxgeectqoekugyvb/functions/process-recurring-messages/logs)
- **SQL Editor**: [Open SQL](https://supabase.com/dashboard/project/ierdfxgeectqoekugyvb/sql/new)
- **Cron Jobs**: Query `cron.job` table untuk management

## 📝 Changelog

### Version 1.0.0
- ✅ Initial release
- ✅ Multiple frequency support (daily, weekly, monthly, custom)
- ✅ Contact & manual number selection
- ✅ Safety features (delay, randomization)
- ✅ Execution tracking & limits
- ✅ Mobile-friendly UI
- ✅ Integration with existing device & contact system

## 💡 Future Enhancements
- [ ] Template support
- [ ] Message variables
- [ ] Analytics dashboard
- [ ] A/B testing
- [ ] Smart scheduling (best time to send)
- [ ] Recipient engagement tracking