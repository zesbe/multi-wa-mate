# 🏗️ Recurring Messages - Architecture Analysis & Integration Plan

**Tanggal:** 2025-01-17
**Analyst:** Claude AI
**Status:** ✅ User benar - Belum terintegrasi dengan BullMQ!

---

## 📊 Executive Summary

User **BENAR**! Recurring messages **BELUM terkoneksi** dengan BullMQ/Redis yang sudah ada.

**Current State:**
- ❌ Recurring messages **TIDAK ada backend processor**
- ❌ Recurring messages **TIDAK pakai BullMQ queue**
- ❌ Recurring messages **TIDAK ada polling check**
- ✅ Database schema lengkap
- ✅ Frontend UI lengkap
- ✅ Infrastructure BullMQ sudah ada (untuk broadcasts)

**Recommendation:**
✅ **Integrate recurring messages dengan BullMQ queue yang SAMA dengan broadcasts** - efisien, no duplication!

---

## 🔍 Current Architecture Analysis

### **1. Broadcasts (One-Time Messages) - ✅ SUDAH LENGKAP**

**Flow:**
```
User Create Broadcast
    ↓
Save to DB (status='processing')
    ↓
Polling: checkAndQueueBroadcasts() [every 15s]
    ↓
Add to BullMQ Queue
    ↓
BullMQ Worker Process (5 concurrent)
    ↓
Send WhatsApp Messages
    ↓
Update DB (status='completed')
```

**Files:**
- `railway-service/services/broadcast/queuedBroadcastProcessor.js` - Polling & queueing
- `railway-service/jobs/broadcastQueue.js` - BullMQ worker
- `railway-service/index.js` line 113 - Polling interval

**Key Features:**
- ✅ Uses BullMQ queue (Redis)
- ✅ Concurrent processing (5 jobs parallel)
- ✅ Retry logic (3 attempts)
- ✅ Anti-duplicate (Map tracking)
- ✅ Batch processing with pause
- ✅ Adaptive delay (auto/manual/adaptive)
- ✅ Progress tracking
- ✅ Job persistence (24h completed, 7d failed)

---

### **2. Scheduled Broadcasts (Future One-Time) - ✅ SUDAH LENGKAP**

**Flow:**
```
User Create Scheduled Broadcast
    ↓
Save to DB (status='draft', scheduled_at=future)
    ↓
Polling: checkScheduledBroadcasts() [every 30s]
    ↓
IF scheduled_at <= NOW:
    Update status='processing'
    ↓
    Picked up by checkAndQueueBroadcasts()
    ↓
    Add to BullMQ Queue
    ↓
    Send Messages
```

**Files:**
- `railway-service/services/broadcast/scheduledBroadcasts.js`
- `railway-service/index.js` line 109 - Polling interval

**Key Features:**
- ✅ Time-based trigger
- ✅ Reuses broadcast queue infrastructure

---

### **3. Auto-Post (Recurring to Groups) - ✅ SUDAH LENGKAP**

**Flow:**
```
User Create Auto-Post Schedule
    ↓
Save to DB (is_active=true, next_send_at=calculated)
    ↓
Polling: checkAutoPostSchedules() [every 30s]
    ↓
IF next_send_at <= NOW:
    Send to Groups DIRECTLY (NO QUEUE!)
    ↓
    Update last_sent_at, next_send_at
```

**Files:**
- `railway-service/auto-post-handler.js`
- `railway-service/index.js` line 121 - Polling interval

**Key Features:**
- ✅ Direct send (no queue)
- ✅ Supports daily/weekly/monthly/custom
- ✅ Auto-calculate next_send_at
- ✅ Process message variables
- ✅ Media support
- ✅ Random delay between messages

**⚠️ Why NO queue?**
- Auto-post sends to **GROUPS** (usually 5-20 groups)
- Groups = small number of recipients
- Direct send faster for small batches

---

### **4. Recurring Messages (Recurring to Contacts) - ❌ TIDAK ADA!**

**Current State:**
```
User Create Recurring Message
    ↓
Save to DB (is_active=true, next_send_at=calculated)
    ↓
❌ NO POLLING CHECK!
    ↓
❌ NO PROCESSOR!
    ↓
💀 PESAN TIDAK PERNAH TERKIRIM!
```

**Files:**
- ❌ No processor file
- ❌ No polling in index.js
- ❌ No queue integration

**Why Needs Queue:**
- Sends to **CONTACTS** (bisa ratusan/ribuan kontak!)
- Contacts = large number of recipients
- MUST use queue to prevent:
  - Server crash (too many simultaneous sends)
  - WhatsApp ban (too fast sending)
  - Resource exhaustion (memory/CPU spike)

---

## 📈 Comparison Table

| Feature | Broadcasts | Scheduled Broadcasts | Auto-Post | **Recurring Messages** |
|---------|-----------|---------------------|-----------|----------------------|
| **Use Case** | One-time bulk send | Future one-time send | Recurring to groups | **Recurring to contacts** |
| **Recipients** | Contacts (100s-1000s) | Contacts (100s-1000s) | Groups (5-20) | **Contacts (100s-1000s)** |
| **Polling?** | ✅ Every 15s | ✅ Every 30s | ✅ Every 30s | **❌ NO!** |
| **Queue?** | ✅ BullMQ | ✅ BullMQ | ❌ Direct send | **❌ NO!** |
| **Processor?** | ✅ Yes | ✅ Yes | ✅ Yes | **❌ NO!** |
| **Anti-duplicate?** | ✅ Map tracking | ✅ Via status | ✅ Via next_send_at | **❌ NO!** |
| **Status** | ✅ Works | ✅ Works | ✅ Works | **❌ BROKEN** |

---

## 🎯 Recommended Integration Strategy

### **Option A: Reuse Broadcast Queue (RECOMMENDED ✅)**

**Why:**
- ✅ Infrastructure already exists
- ✅ No code duplication
- ✅ Same behavior (delay, batch, retry)
- ✅ Same monitoring/logging
- ✅ Single queue = easier to manage

**Implementation:**

```javascript
// NEW FILE: railway-service/services/recurring/recurringProcessor.js

/**
 * Check recurring messages and convert to broadcast jobs
 */
async function checkAndQueueRecurringMessages() {
  // 1. Get active recurring messages due for sending
  const { data: recurring, error } = await supabase
    .from('recurring_messages')
    .select('*')
    .eq('is_active', true)
    .lte('next_send_at', new Date().toISOString())
    .limit(10);

  for (const message of recurring) {
    // 2. Convert to broadcast format
    const broadcastData = {
      id: `recurring-${message.id}-${Date.now()}`, // Unique ID
      user_id: message.user_id,
      device_id: message.device_id,
      name: `[Recurring] ${message.name}`,
      message: message.message,
      media_url: message.media_url,
      target_contacts: message.target_contacts,
      delay_type: message.delay_type,
      delay_seconds: message.delay_seconds,
      randomize_delay: message.randomize_delay,
      batch_size: message.batch_size,
      pause_between_batches: message.pause_between_batches,
    };

    // 3. Add to SAME BullMQ queue as broadcasts
    await addBroadcastJob(broadcastData);

    // 4. Log to recurring_message_logs
    await supabase.from('recurring_message_logs').insert({
      recurring_message_id: message.id,
      user_id: message.user_id,
      sent_to_count: 0, // Will be updated by worker
      execution_time: new Date().toISOString(),
    });
  }
}

/**
 * Update recurring message after sending
 * Called by BullMQ worker after job completion
 */
async function updateRecurringMessageStats(recurringId, sentCount, failedCount) {
  const { data: message } = await supabase
    .from('recurring_messages')
    .select('*')
    .eq('id', recurringId)
    .single();

  if (!message) return;

  // Update stats
  await supabase
    .from('recurring_messages')
    .update({
      last_sent_at: new Date().toISOString(),
      total_sent: message.total_sent + sentCount,
      total_failed: message.total_failed + failedCount,
    })
    .eq('id', recurringId);

  // Database trigger will auto-calculate next_send_at
}
```

**Add to index.js:**
```javascript
// Line ~123 (after auto-post)
const { checkAndQueueRecurringMessages } = require('./services/recurring/recurringProcessor');

// Check recurring messages every 30 seconds
setInterval(checkAndQueueRecurringMessages, 30000);
console.log('🔁 Recurring messages scheduler started (every 30 seconds)');
```

**Modify broadcastQueue.js worker:**
```javascript
// After job completion (line ~289)
if (broadcastId.startsWith('recurring-')) {
  const recurringId = broadcastId.split('-')[1];
  await updateRecurringMessageStats(recurringId, sentCount, failedCount);
}
```

---

### **Option B: Separate Queue (NOT RECOMMENDED ❌)**

**Why NOT recommended:**
- ❌ Code duplication
- ❌ More Redis keys
- ❌ Harder to monitor
- ❌ Duplicate logic (delay, batch, retry)
- ❌ More maintenance overhead

**Only use if:**
- Need different priority levels
- Need different retry strategies
- Need separate rate limiting

---

## 🛡️ Anti-Duplication Strategy

### **Problem:** Recurring messages bisa trigger multiple times jika:
- Polling interval overlap
- Server restart saat processing
- Clock skew di multi-server setup

### **Solution 1: Track in Memory (Like Broadcasts)**

```javascript
// Track recently queued recurring messages
const queuedRecurringMessages = new Map(); // recurringId -> timestamp

// Before queuing, check:
if (queuedRecurringMessages.has(message.id)) {
  const queuedAt = queuedRecurringMessages.get(message.id);
  if (Date.now() - queuedAt < 15 * 60 * 1000) { // 15 min
    continue; // Skip, already queued
  }
}

// After queuing:
queuedRecurringMessages.set(message.id, Date.now());
```

### **Solution 2: Database Lock (More Robust)**

```javascript
// Use database transaction for atomic check-and-update
const { data, error } = await supabase
  .from('recurring_messages')
  .update({
    last_queued_at: new Date().toISOString()
  })
  .eq('id', message.id)
  .is('last_queued_at', null) // Only update if NOT recently queued
  .or(`last_queued_at.lt.${fifteenMinutesAgo}`)
  .select();

if (data && data.length > 0) {
  // We got the lock, queue it!
  await addBroadcastJob(broadcastData);
}
```

### **Solution 3: BullMQ JobId (Built-in)**

```javascript
// BullMQ already prevents duplicate jobs with same jobId!
await queue.add('send-broadcast', data, {
  jobId: `recurring-${message.id}-${message.next_send_at}`,
  // If job with this ID exists, it won't be added again!
});
```

**Recommendation:** Use **Solution 3** (BullMQ jobId) + **Solution 1** (memory tracking for fast skip)

---

## ⚡ Performance & Resource Analysis

### **Current Polling Intervals:**

| Check | Interval | Impact |
|-------|----------|--------|
| Device check | 10s | LOW (simple DB query) |
| Scheduled broadcasts | 30s | LOW (small result set) |
| Queue broadcasts | 15s | MEDIUM (adds to queue) |
| Auto-post | 30s | LOW-MEDIUM (direct send, few groups) |
| Health ping | 60s | LOW (update timestamp) |
| Server health | 60s | LOW (update status) |

**Adding Recurring:**
- Interval: 30s (same as auto-post)
- Impact: **MEDIUM** (DB query + queue jobs)
- Resource: Minimal (just adds to queue, worker does heavy lifting)

### **Total Polling Workload:**

```
Every 10s: Device check
Every 15s: Queue broadcasts
Every 30s: Scheduled broadcasts, Auto-post, Recurring (NEW)
Every 60s: Health ping, Server health

Average per minute:
- 6 device checks
- 4 queue broadcast checks
- 2 scheduled broadcast checks
- 2 auto-post checks
- 2 recurring message checks (NEW)  ← +10% workload
- 1 health ping
- 1 server health

Total: 18 operations/minute (was 16)
Impact: +12.5% workload ✅ ACCEPTABLE
```

### **BullMQ Queue Load:**

**Current:**
- Broadcasts: Variable (user-triggered)
- Scheduled: ~10-50 jobs/day

**After Adding Recurring:**
- Recurring: ~100-500 jobs/day (depends on user usage)

**Queue Capacity:**
- Concurrency: 5 jobs parallel
- Rate limit: 10 jobs/second max
- Redis: Can handle 10,000+ jobs/sec

**Verdict:** ✅ **NO performance issue!** BullMQ can easily handle the load.

---

## 🚨 Risk Analysis

### **Risk 1: Duplicate Sends**

**Scenario:**
```
1. Recurring message scheduled for 09:00
2. Polling at 09:00:01 → Queue job A
3. Polling at 09:00:16 → Queue job B (duplicate!)
4. Both jobs send → USER RECEIVES 2x MESSAGES! 💀
```

**Mitigation:**
- ✅ Use BullMQ jobId (prevents duplicate in queue)
- ✅ Memory tracking (fast skip in polling)
- ✅ Database last_queued_at check

**Priority:** 🔴 **CRITICAL** - Must implement!

---

### **Risk 2: Race Condition (Multi-Server)**

**Scenario:**
```
Server A: Polling at 09:00:01 → Queue recurring message
Server B: Polling at 09:00:02 → Queue same message!
```

**Mitigation:**
- ✅ BullMQ jobId (Redis atomic operation)
- ✅ Server assignments (device locked to specific server)
- ⚠️ If device assigned to Server A, only Server A processes it

**Priority:** 🟡 **MEDIUM** - BullMQ jobId handles this automatically

---

### **Risk 3: Clock Skew**

**Scenario:**
```
Server A clock: 09:00:00
Server B clock: 09:00:30 (30s ahead!)
Both servers think it's time to send!
```

**Mitigation:**
- ✅ Use database timestamp (single source of truth)
- ✅ BullMQ jobId with timestamp
- ⚠️ NTP sync on servers

**Priority:** 🟢 **LOW** - Rare in managed infrastructure

---

### **Risk 4: Queue Overflow**

**Scenario:**
```
1000 recurring messages all scheduled for 09:00
Polling adds 1000 jobs in 1 second
Queue overwhelmed!
```

**Mitigation:**
- ✅ BullMQ rate limiter (max 10 jobs/sec)
- ✅ Limit query results (LIMIT 10 per poll)
- ✅ Job persistence (won't lose jobs)

**Priority:** 🟢 **LOW** - BullMQ designed for this

---

## 📊 Monitoring & Debugging

### **Metrics to Track:**

```javascript
// Add to monitoring dashboard:
{
  "recurring_messages": {
    "total_active": 45,
    "due_for_sending": 12,
    "queued_today": 89,
    "sent_today": 87,
    "failed_today": 2,
    "next_check_in": "15 seconds",
    "queue_health": "healthy",
    "avg_queue_time": "2.3s",
    "avg_send_time": "45s"
  }
}
```

### **Logging Strategy:**

```javascript
// Polling check
console.log(`🔁 Recurring check: found ${messages.length} due for sending`);

// Queuing
console.log(`📥 Queued recurring: "${message.name}" (ID: ${message.id})`);

// Skipped (already queued)
console.log(`⏭️  Skipped recurring: "${message.name}" (already queued 2m ago)`);

// Completed
console.log(`✅ Recurring completed: ${sentCount} sent, ${failedCount} failed`);

// Error
console.error(`❌ Recurring failed: ${error.message}`);
```

---

## 🎯 Implementation Checklist

### **Phase 1: Core Integration (4-6 hours)**

- [ ] Create `services/recurring/recurringProcessor.js`
- [ ] Implement `checkAndQueueRecurringMessages()`
- [ ] Add anti-duplicate logic (BullMQ jobId)
- [ ] Add to `index.js` polling (30s interval)
- [ ] Modify `broadcastQueue.js` to handle recurring jobs
- [ ] Implement `updateRecurringMessageStats()`
- [ ] Test basic send flow

### **Phase 2: Robustness (2-3 hours)**

- [ ] Add memory tracking (Map)
- [ ] Add database lock (last_queued_at)
- [ ] Handle edge cases (end_date, max_executions)
- [ ] Error handling & logging
- [ ] Retry logic for failed sends
- [ ] Update recurring_message_logs

### **Phase 3: Testing (2-3 hours)**

- [ ] Unit tests (checkAndQueueRecurringMessages)
- [ ] Integration tests (end-to-end flow)
- [ ] Test duplicate prevention
- [ ] Test multi-server scenario
- [ ] Test all frequency types (daily, weekly, monthly, custom)
- [ ] Load testing (100+ recurring messages)

### **Phase 4: Frontend Integration (1-2 hours)**

- [ ] Fix missing form fields (delay_type, pause_between_batches)
- [ ] Fix missing imports (Zap, BarChart3, Shield, Slider)
- [ ] Add validation (weekly days selection)
- [ ] Test create/edit/delete flows

### **Phase 5: Deployment (1 hour)**

- [ ] Add environment variables
- [ ] Update documentation
- [ ] Deploy to staging
- [ ] Monitor logs for 24 hours
- [ ] Deploy to production
- [ ] Monitor first week

**Total Estimated Time:** 10-15 hours

---

## 💡 Code Example: Complete Integration

```javascript
// ============================================
// FILE: services/recurring/recurringProcessor.js
// ============================================

const { supabase } = require('../../config/supabase');
const { addBroadcastJob } = require('../../jobs/broadcastQueue');

// Anti-duplicate tracking
const queuedRecurringMessages = new Map();
const TRACKING_TTL = 15 * 60 * 1000; // 15 minutes

async function checkAndQueueRecurringMessages() {
  try {
    const now = new Date().toISOString();

    // Get active recurring messages due for sending
    const { data: messages, error } = await supabase
      .from('recurring_messages')
      .select('*')
      .eq('is_active', true)
      .lte('next_send_at', now)
      .limit(10); // Process max 10 per poll

    if (error) {
      console.error('❌ Error fetching recurring messages:', error);
      return;
    }

    if (!messages || messages.length === 0) {
      return; // No messages due
    }

    console.log(`🔁 Found ${messages.length} recurring message(s) to queue`);

    for (const message of messages) {
      try {
        // Check if already queued recently (fast skip)
        if (queuedRecurringMessages.has(message.id)) {
          const queuedAt = queuedRecurringMessages.get(message.id);
          if (Date.now() - queuedAt < TRACKING_TTL) {
            console.log(`⏭️  Skipped: "${message.name}" (already queued)`);
            continue;
          }
        }

        // Check if reached max executions
        if (message.max_executions && message.total_sent >= message.max_executions) {
          await supabase
            .from('recurring_messages')
            .update({ is_active: false })
            .eq('id', message.id);
          console.log(`🛑 Stopped: "${message.name}" (max executions reached)`);
          continue;
        }

        // Convert to broadcast format
        const broadcastData = {
          id: `recurring-${message.id}-${Date.now()}`,
          user_id: message.user_id,
          device_id: message.device_id,
          name: `[Recurring] ${message.name}`,
          message: message.message,
          media_url: message.media_url,
          target_contacts: message.target_contacts,
          delay_type: message.delay_type || 'auto',
          delay_seconds: message.delay_seconds || 5,
          randomize_delay: message.randomize_delay !== false,
          batch_size: message.batch_size || 50,
          pause_between_batches: message.pause_between_batches || 60,
        };

        // Add to BullMQ queue (same queue as broadcasts!)
        await addBroadcastJob(broadcastData);

        // Track as queued
        queuedRecurringMessages.set(message.id, Date.now());

        // Create log entry
        await supabase.from('recurring_message_logs').insert({
          recurring_message_id: message.id,
          user_id: message.user_id,
          sent_to_count: 0, // Will be updated after send
          execution_time: now,
        });

        console.log(`📥 Queued: "${message.name}" (${message.target_contacts.length} contacts)`);

      } catch (error) {
        console.error(`❌ Error queuing recurring message ${message.id}:`, error);
      }
    }
  } catch (error) {
    console.error('❌ Error in checkAndQueueRecurringMessages:', error);
  }
}

// Cleanup old tracking entries
setInterval(() => {
  const now = Date.now();
  for (const [id, timestamp] of queuedRecurringMessages.entries()) {
    if (now - timestamp > TRACKING_TTL) {
      queuedRecurringMessages.delete(id);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

module.exports = {
  checkAndQueueRecurringMessages,
};
```

---

## 📝 Summary & Recommendation

### **Current State:**
- ❌ Recurring messages **completely broken** (no backend)
- ✅ BullMQ infrastructure **already exists** for broadcasts
- ✅ Database schema **well-designed**
- ✅ Frontend UI **mostly complete** (needs bug fixes)

### **Recommended Action:**
✅ **Integrate recurring messages dengan BullMQ queue yang SAMA**

**Benefits:**
- ✅ No code duplication
- ✅ Reuse existing infrastructure
- ✅ Same monitoring & logging
- ✅ Same retry & error handling
- ✅ Efficient resource usage
- ✅ Easy to maintain

**Risks:**
- ⚠️ Duplicate sends (MITIGATED by BullMQ jobId)
- ⚠️ Race conditions (MITIGATED by Redis atomic ops)
- ⚠️ Queue overflow (MITIGATED by rate limiting)

**Estimated Effort:** 10-15 hours

**Priority:** 🔴 **CRITICAL** (Fitur user-facing yang tidak jalan!)

---

**Next Steps:**
1. Fix frontend bugs (imports, form fields) - **2 hours**
2. Implement recurring processor - **4-6 hours**
3. Testing & QA - **2-3 hours**
4. Deploy & monitor - **1 hour**

**Total:** 9-12 hours untuk fitur recurring messages **fully functional**! 🚀

---

**Generated by:** Claude AI Architecture Analyzer
**Date:** 2025-01-17
**Version:** 1.0
