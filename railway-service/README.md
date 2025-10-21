# WhatsApp Baileys Service for Railway

Service ini menghubungkan frontend ke WhatsApp via Baileys library.

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

### 4. Test
1. Buka frontend Lovable
2. Tambah device baru
3. Klik "Scan QR"
4. QR code akan muncul dari Railway service
5. Scan dengan WhatsApp
6. Status berubah "Connected" ✅

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
