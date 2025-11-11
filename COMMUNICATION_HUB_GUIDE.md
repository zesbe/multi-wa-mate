# 📧 Communication Hub - Panduan Penggunaan

## Apa itu Communication Hub?

Communication Hub adalah sistem manajemen komunikasi terpusat yang memungkinkan admin untuk:
- 📊 Memantau semua komunikasi (email, notifikasi, SMS, WhatsApp)
- 📝 Membuat dan mengelola template pesan
- 📈 Melihat analytics (delivery rate, open rate, click rate)
- 🔔 Mengirim notifikasi ke user

---

## 🎯 Fitur Utama

### 1. **Communication Analytics** (`/admin/communication`)

**Metrics yang ditampilkan:**
- Total Messages Sent (30 hari terakhir)
- Emails Sent vs Notifications Sent
- Delivery Rate (% pesan terkirim)
- Open Rate (% pesan dibuka)
- Click Rate (% link diklik)

**Messages by Type:**
- Breakdown pesan berdasarkan kategori
- Grafik persentase untuk setiap tipe

**Recent Messages:**
- 10 pesan terakhir yang dikirim
- Status setiap pesan (delivered, opened, clicked)
- Informasi recipient

---

### 2. **Notification Templates** (`/admin/notification-templates`)

**Membuat Template Baru:**

1. Klik tombol **"New Template"**
2. Isi form:
   - **Template Name**: Nama template (contoh: "Welcome Email")
   - **Type**: Pilih jenis (Email, In-App Notification, SMS, WhatsApp)
   - **Subject**: Subject line untuk email/judul notifikasi
   - **Content**: Isi pesan (support variabel dinamis)
   - **Variables**: Comma-separated list variabel (contoh: user_name, amount)

3. **Menggunakan Variables:**
   ```
   Content:
   Hi {{user_name}},
   
   Your subscription of {{plan_name}} will expire in {{days_left}} days.
   
   Total amount: {{amount}}
   
   Best regards,
   Team
   ```

4. Klik **"Create Template"**

**Variabel yang Tersedia:**
- `{{user_name}}` - Nama user
- `{{email}}` - Email user
- `{{plan_name}}` - Nama paket subscription
- `{{amount}}` - Nominal pembayaran
- `{{expiry_date}}` - Tanggal kadaluarsa
- `{{days_left}}` - Hari tersisa

**Mengelola Templates:**
- 👁️ **View**: Preview full content template
- ✏️ **Edit**: Update template (coming soon)
- 🗑️ **Delete**: Hapus template (dengan konfirmasi)

**Template Stats:**
- Total Templates
- Active Templates
- Draft Templates
- Total Usage (berapa kali template digunakan)

---

## 📤 Cara Mengirim Pesan

### Via Code (Menggunakan Template):

```typescript
import { supabase } from "@/integrations/supabase/client";
import { logCommunication } from "@/utils/auditLogger";

// 1. Ambil template
const { data: template } = await supabase
  .from('notification_templates')
  .select('*')
  .eq('name', 'Welcome Email')
  .single();

// 2. Replace variabel
let content = template.content;
content = content.replace('{{user_name}}', 'John Doe');
content = content.replace('{{plan_name}}', 'Premium');

// 3. Kirim email (via edge function atau service)
await sendEmail({
  to: 'user@example.com',
  subject: template.subject,
  content: content
});

// 4. Log ke database
await logCommunication({
  recipient_email: 'user@example.com',
  type: 'email',
  subject: template.subject,
  content: content,
  template_id: template.id,
  status: 'sent'
});

// 5. Update usage count
await supabase
  .from('notification_templates')
  .update({ 
    usage_count: (template.usage_count || 0) + 1,
    last_used_at: new Date().toISOString()
  })
  .eq('id', template.id);
```

---

## 🔍 Tracking & Analytics

### Automatic Tracking:

Setiap kali pesan dikirim via `logCommunication()`, sistem otomatis mencatat:
- Timestamp pengiriman
- Recipient (email/phone)
- Type pesan
- Template yang digunakan
- Status (pending, sent, delivered, opened, clicked, failed)

### Update Status:

```typescript
// Update status ketika email dibuka
await supabase
  .from('communication_logs')
  .update({ 
    status: 'opened',
    opened_at: new Date().toISOString()
  })
  .eq('id', logId);

// Update status ketika link diklik
await supabase
  .from('communication_logs')
  .update({ 
    status: 'clicked',
    clicked_at: new Date().toISOString()
  })
  .eq('id', logId);
```

---

## 🔐 Audit Logging

Semua aksi admin di Communication Hub otomatis tercatat di Audit Logs:

**Logged Actions:**
- ✅ Create template
- ✅ Update template
- ✅ Delete template
- ✅ Send message

**Cara Menggunakan Audit Logger:**

```typescript
import { logAudit } from "@/utils/auditLogger";

// Log create action
await logAudit({
  action: 'create',
  entity_type: 'notification_template',
  entity_id: newTemplateId,
  new_values: { name: 'Welcome Email', type: 'email' }
});

// Log delete action
await logAudit({
  action: 'delete',
  entity_type: 'notification_template',
  entity_id: templateId,
  old_values: { name: templateName }
});
```

**View Audit Logs:**
- Navigate ke `/admin/audit-logs`
- Filter by action atau entity type
- Real-time updates (auto refresh saat ada log baru)
- Badge "Live" indicator ketika ada aktivitas baru

---

## 📊 Database Schema

### communication_logs
```sql
- id: UUID (primary key)
- user_id: UUID (admin yang mengirim)
- recipient_email: TEXT
- recipient_phone: TEXT
- type: TEXT (email, notification, sms, whatsapp)
- subject: TEXT
- content: TEXT
- template_id: UUID (reference ke template)
- status: TEXT (pending, sent, delivered, opened, clicked, failed)
- sent_at: TIMESTAMP
- delivered_at: TIMESTAMP
- opened_at: TIMESTAMP
- clicked_at: TIMESTAMP
- error_message: TEXT
- metadata: JSONB
```

### notification_templates
```sql
- id: UUID (primary key)
- name: TEXT
- type: TEXT (email, notification, sms, whatsapp)
- subject: TEXT
- content: TEXT
- variables: TEXT[] (array of variable names)
- status: TEXT (active, draft, archived)
- usage_count: INTEGER
- last_used_at: TIMESTAMP
- created_by: UUID
```

---

## 🚀 Best Practices

1. **Use Templates**: Selalu gunakan template untuk konsistensi
2. **Test First**: Test template dengan data dummy sebelum production
3. **Track Everything**: Pastikan semua komunikasi di-log
4. **Monitor Metrics**: Check delivery rate & open rate secara berkala
5. **Update Status**: Implementasikan webhook untuk update status real-time
6. **Audit Trail**: Semua changes akan ter-record di audit logs

---

## 🔧 Troubleshooting

**Template tidak muncul:**
- Check status template (harus "active")
- Reload page atau clear cache

**Variable tidak ter-replace:**
- Pastikan format `{{variable_name}}` benar
- Check variables list di template

**Log tidak masuk:**
- Verify user authentication
- Check RLS policies di Supabase
- Review console errors

**Real-time tidak work:**
- Check Supabase realtime settings
- Verify table di publication supabase_realtime
- Check browser console untuk connection errors

---

## 📱 Next Steps

1. **Email Integration**: Integrate dengan SendGrid/AWS SES
2. **SMS Gateway**: Connect Twilio atau provider lokal
3. **Push Notifications**: Setup Firebase Cloud Messaging
4. **WhatsApp Business API**: Integrate untuk WhatsApp messages
5. **Scheduling**: Add scheduled messages feature
6. **A/B Testing**: Test different message variants

---

## 🆘 Support

Jika ada pertanyaan atau issue:
1. Check console logs untuk errors
2. Review audit logs untuk tracking
3. Verify database records di Supabase
4. Check this guide untuk reference

Happy communicating! 🎉
