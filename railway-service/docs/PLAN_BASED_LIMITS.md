# 📊 Plan-Based Rate Limiting Setup Guide (Fonnte-Style)

## 🎯 Overview

Rate limiting sekarang **berdasarkan pricing plan**, seperti Fonnte.com!

**DEFAULT:** **UNLIMITED** untuk semua user (mudah testing)
**PRODUCTION:** Set limits di database plans table

---

## 🔓 **SAAT INI: UNLIMITED BY DEFAULT**

```javascript
// Default limits (UNLIMITED)
DEFAULT: {
  BROADCAST_PER_DAY: 999999,      // Unlimited ✅
  MESSAGE_PER_DAY: 999999,        // Unlimited ✅
  API_CALL_PER_HOUR: 999999,      // Unlimited ✅
}
```

**Artinya:**
- ✅ User bisa kirim broadcast **UNLIMITED**
- ✅ User bisa kirim pesan **UNLIMITED**
- ✅ User bisa hit API **UNLIMITED**
- ✅ **TIDAK ADA LIMIT** sampai kamu set di database!

**Perfect untuk:**
- Testing
- Development
- Onboarding user baru
- Free tier unlimited (jika mau)

---

## 💰 **CARA SETUP PRICING PLANS** (Seperti Fonnte)

### **Model Bisnis Fonnte.com:**

| Plan | Harga/Bulan | Pesan/Hari | Broadcast/Hari |
|------|-------------|------------|----------------|
| **Free** | Rp 0 | 100 | 10 |
| **Starter** | Rp 50.000 | 1,000 | 50 |
| **Basic** | Rp 150.000 | 5,000 | 100 |
| **Pro** | Rp 500.000 | 20,000 | 500 |
| **Business** | Rp 1.500.000 | 100,000 | 2,000 |
| **Enterprise** | Rp 5.000.000 | UNLIMITED | UNLIMITED |

---

## 📝 **SETUP DI DATABASE (Supabase)**

### **Step 1: Update Plans Table**

Di Supabase SQL Editor:

```sql
-- Example: Set limits untuk "Basic Plan"
UPDATE plans
SET features = jsonb_build_object(
  'broadcastPerDay', 100,        -- Max 100 broadcast per hari
  'messagePerDay', 5000,         -- Max 5000 pesan per hari
  'apiCallPerHour', 5000,        -- Max 5000 API calls per jam
  'maxDevices', 5,               -- Max 5 devices
  'supportPriority', 'standard'
)
WHERE name = 'Basic Plan';

-- Example: Set limits untuk "Pro Plan"
UPDATE plans
SET features = jsonb_build_object(
  'broadcastPerDay', 500,
  'messagePerDay', 20000,
  'apiCallPerHour', 10000,
  'maxDevices', 20,
  'supportPriority', 'high'
)
WHERE name = 'Pro Plan';

-- Example: Set UNLIMITED untuk "Enterprise Plan"
UPDATE plans
SET features = jsonb_build_object(
  'broadcastPerDay', 999999,     -- Unlimited
  'messagePerDay', 999999,       -- Unlimited
  'apiCallPerHour', 999999,      -- Unlimited
  'maxDevices', 999,
  'supportPriority', 'vip'
)
WHERE name = 'Enterprise Plan';

-- Example: Free Plan (limited)
UPDATE plans
SET features = jsonb_build_object(
  'broadcastPerDay', 10,
  'messagePerDay', 100,
  'apiCallPerHour', 500,
  'maxDevices', 1,
  'supportPriority', 'community'
)
WHERE name = 'Free Plan';
```

### **Step 2: Create Plans (Jika Belum Ada)**

```sql
-- Insert pricing plans
INSERT INTO plans (name, price, duration, features, is_active)
VALUES
  ('Free', 0, 30, jsonb_build_object(
    'broadcastPerDay', 10,
    'messagePerDay', 100,
    'apiCallPerHour', 500,
    'maxDevices', 1
  ), true),

  ('Starter', 50000, 30, jsonb_build_object(
    'broadcastPerDay', 50,
    'messagePerDay', 1000,
    'apiCallPerHour', 2000,
    'maxDevices', 3
  ), true),

  ('Basic', 150000, 30, jsonb_build_object(
    'broadcastPerDay', 100,
    'messagePerDay', 5000,
    'apiCallPerHour', 5000,
    'maxDevices', 5
  ), true),

  ('Pro', 500000, 30, jsonb_build_object(
    'broadcastPerDay', 500,
    'messagePerDay', 20000,
    'apiCallPerHour', 10000,
    'maxDevices', 20
  ), true),

  ('Business', 1500000, 30, jsonb_build_object(
    'broadcastPerDay', 2000,
    'messagePerDay', 100000,
    'apiCallPerHour', 50000,
    'maxDevices', 50
  ), true),

  ('Enterprise', 5000000, 30, jsonb_build_object(
    'broadcastPerDay', 999999,    -- Unlimited
    'messagePerDay', 999999,      -- Unlimited
    'apiCallPerHour', 999999,     -- Unlimited
    'maxDevices', 999
  ), true);
```

### **Step 3: Assign Plan to User**

```sql
-- Assign plan ke user
INSERT INTO subscriptions (user_id, plan_id, status, expires_at)
SELECT
  'user-uuid-here',
  id,
  'active',
  NOW() + INTERVAL '30 days'
FROM plans
WHERE name = 'Pro Plan';
```

---

## 🔍 **CARA KERJA**

### **1. User Tanpa Subscription:**
```javascript
// Otomatis dapat UNLIMITED
{
  planName: "Free (Unlimited)",
  broadcastPerDay: 999999,    // Unlimited
  messagePerDay: 999999,      // Unlimited
  apiCallPerHour: 999999      // Unlimited
}
```

### **2. User Dengan Subscription:**
```javascript
// Baca dari plans.features (JSONB)
{
  planName: "Basic Plan",
  broadcastPerDay: 100,       // Dari database
  messagePerDay: 5000,        // Dari database
  apiCallPerHour: 5000        // Dari database
}
```

### **3. Check Rate Limit:**
```javascript
const userRateLimit = require('./services/rateLimit/userRateLimit');

// Check message limit
const limit = await userRateLimit.checkMessageLimit(userId);

console.log(limit);
/*
{
  allowed: true,
  planName: "Basic Plan",
  perDay: {
    current: 850,
    max: 5000,
    remaining: 4150
  },
  message: "Plan: Basic Plan - Rate limit OK"
}
*/

// Jika limit terlampaui:
/*
{
  allowed: false,
  planName: "Basic Plan",
  perDay: {
    current: 5000,
    max: 5000,
    remaining: 0
  },
  message: "Daily message limit reached (5000/day) - Upgrade plan for more"
}
*/
```

---

## 💡 **OPSI UNTUK KAMU**

### **Opsi 1: Unlimited Selamanya** ✅ **CURRENT DEFAULT**

Biarkan seperti sekarang - semua user unlimited.

**Keuntungan:**
- ✅ No customer complaints
- ✅ Easy onboarding
- ✅ Kompetitif (unlimited!)

**Resiko:**
- ⚠️ Potential abuse
- ⚠️ No revenue dari tiering

**Rekomendasi:** Oke untuk MVP/early stage

---

### **Opsi 2: Soft Limit (Warning Only)**

Tracking tapi tidak block - cuma warning.

```javascript
// Di broadcast handler
const limit = await userRateLimit.checkMessageLimit(userId);

if (!limit.allowed) {
  // Jangan block, cuma log warning
  console.warn(`User ${userId} exceeded limit but allowed`);

  // Kirim notifikasi ke user (optional)
  // "You've used 5000/5000 messages. Consider upgrading!"
}

// Tetap allow broadcast/pesan
processBroadcast(broadcast);
```

**Keuntungan:**
- ✅ No blocking (customer happy)
- ✅ Data untuk upsell
- ✅ Gentle nudge to upgrade

---

### **Opsi 3: Hard Limit (Enforce)**

Block jika limit exceeded (seperti Fonnte).

```javascript
// Di broadcast handler
const limit = await userRateLimit.checkMessageLimit(userId);

if (!limit.allowed) {
  return res.status(429).json({
    error: 'Rate limit exceeded',
    message: limit.message,
    currentUsage: limit.perDay.current,
    planLimit: limit.perDay.max,
    upgradeUrl: '/pricing',
    resetAt: 'tomorrow 00:00 UTC'
  });
}

// Only proceed if allowed
processBroadcast(broadcast);
```

**Keuntungan:**
- ✅ Clear tiering
- ✅ Force upgrade (revenue)
- ✅ Prevent abuse

**Resiko:**
- ⚠️ Customer complaints if limits too low
- ⚠️ Need good UX for upgrade flow

---

### **Opsi 4: Hybrid (Best of Both)**

Free unlimited, paid with reasonable limits.

```sql
-- Free plan: UNLIMITED (attract users)
UPDATE plans
SET features = jsonb_build_object(
  'broadcastPerDay', 999999,    -- Unlimited!
  'messagePerDay', 999999,      -- Unlimited!
  'maxDevices', 1               -- But limited devices
)
WHERE name = 'Free Plan';

-- Paid plans: Limits based on price
-- (Users pay for convenience, not limits)
UPDATE plans
SET features = jsonb_build_object(
  'broadcastPerDay', 999999,    -- Still unlimited
  'messagePerDay', 999999,      -- Still unlimited
  'maxDevices', 10,             -- More devices
  'supportPriority', 'high',    -- Better support
  'advancedFeatures', true      -- Advanced features
)
WHERE name = 'Pro Plan';
```

**Differentiation:**
- Free: 1 device, basic features, community support
- Pro: 10 devices, advanced features, priority support
- Enterprise: Unlimited devices, white-label, dedicated support

---

## 🎯 **REKOMENDASI SAYA**

### **Untuk Kamu (HalloWa.id):**

**Phase 1 (Current - MVP):** **UNLIMITED** ✅
- Biarkan unlimited untuk semua
- Focus on user acquisition
- Gather data on usage patterns

**Phase 2 (Growth):** **Soft Limits**
- Track usage
- Show upgrade prompts (not blocking)
- A/B test messaging

**Phase 3 (Monetization):** **Hybrid Model**
- Free: Unlimited messages, 1 device
- Starter: Unlimited messages, 3 devices, basic support
- Pro: Unlimited messages, 20 devices, priority support, advanced features
- Enterprise: Custom (white-label, dedicated support, custom integrations)

**Differentiate by:**
- Number of devices (most important!)
- Support quality
- Advanced features (AI, analytics, integrations)
- NOT by message limits (customer frustration)

---

## 📊 **MONITORING**

### **Track Usage:**

```javascript
const userRateLimit = require('./services/rateLimit/userRateLimit');

// Get usage stats
const status = await userRateLimit.getUserRateLimitStatus(userId);

console.log(status);
/*
{
  userId: "abc-123",
  plan: "Basic Plan",
  limits: {
    broadcast: { current: 45, max: 100, remaining: 55 },
    message: { current: 2500, max: 5000, remaining: 2500 },
    api: { current: 1200, max: 5000, remaining: 3800 }
  },
  overallStatus: "OK"
}
*/

// Identify upgrade candidates
if (status.limits.message.current > status.limits.message.max * 0.8) {
  // User used 80%+ of quota
  // Send upgrade prompt
  console.log('Suggest upgrade to user');
}
```

---

## 🔧 **TESTING**

### **Test Different Plans:**

```javascript
// Test user with Basic Plan
const basicLimit = await userRateLimit.getUserPlanLimits('user-basic');
console.log(basicLimit);
// { planName: "Basic Plan", messagePerDay: 5000, ... }

// Test user with no plan (unlimited)
const freeLimit = await userRateLimit.getUserPlanLimits('user-no-plan');
console.log(freeLimit);
// { planName: "Free (Unlimited)", messagePerDay: 999999, ... }

// Test user with Enterprise (unlimited)
const enterpriseLimit = await userRateLimit.getUserPlanLimits('user-enterprise');
console.log(enterpriseLimit);
// { planName: "Enterprise", messagePerDay: 999999, ... }
```

---

## ✅ **SUMMARY**

**CURRENT STATE:** ✅ **UNLIMITED untuk semua user**

**Cara Enable Limits:**
1. Update `plans` table dengan `features` (JSONB)
2. Assign `subscriptions` ke user
3. Rate limit auto-detect dari plan

**Rekomendasi:**
- Phase 1: Keep unlimited (user acquisition)
- Phase 2: Add soft limits + upgrade prompts
- Phase 3: Differentiate by features, not limits

**Monitoring:**
- Use `getUserRateLimitStatus()` untuk track usage
- Identify upgrade candidates (>80% quota used)
- Log patterns untuk optimize pricing

---

**Customer TIDAK AKAN KABUR karena:**
- ✅ Default: UNLIMITED
- ✅ Plan-based: Flexible
- ✅ Upgrade prompts: Gentle, not blocking
- ✅ Like Fonnte: Proven model

🎉 **Perfect!**
