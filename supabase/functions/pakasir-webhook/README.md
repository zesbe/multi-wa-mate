# Pakasir Webhook Handler

This edge function handles payment webhook callbacks from Pakasir payment gateway with HMAC signature verification for security.

## Security Features

- ✅ **HMAC SHA-256 Signature Verification** - Prevents fake/unauthorized webhooks
- ✅ **Constant-time Comparison** - Prevents timing attacks
- ✅ **Replay Attack Protection** - Prevents duplicate payment activations
- ✅ **Multiple Header Support** - Checks x-webhook-signature, x-pakasir-signature, x-signature

## Environment Variables Required

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PAKASIR_WEBHOOK_SECRET=your_webhook_secret_from_pakasir
```

## Setup Instructions

### 1. Configure Webhook Secret in Supabase

```bash
# Using Supabase CLI
supabase secrets set PAKASIR_WEBHOOK_SECRET=your_secret_key_here

# Or via Supabase Dashboard:
# Project Settings → Edge Functions → Secrets
# Add: PAKASIR_WEBHOOK_SECRET = your_secret_key
```

### 2. Configure Webhook in Pakasir Dashboard

1. Login to Pakasir dashboard
2. Go to Settings → Webhooks
3. Set webhook URL: `https://your-project.supabase.co/functions/v1/pakasir-webhook`
4. Copy the webhook secret key
5. Add the secret to Supabase (step 1)
6. Enable webhook events: `payment.completed`, `payment.failed`

## Webhook Request Format

### Headers
```
Content-Type: application/json
X-Webhook-Signature: <hmac-sha256-hex-signature>
```

### Body
```json
{
  "order_id": "ORD-123456",
  "amount": 100000,
  "status": "completed",
  "payment_method": "bank_transfer",
  "completed_at": "2025-01-15T10:30:00Z",
  "project": "halowa"
}
```

### Signature Calculation

The signature is calculated as:
```
HMAC-SHA256(webhook_secret, raw_request_body)
```

Converted to hexadecimal string.

## Response Codes

| Status | Description |
|--------|-------------|
| 200 | Webhook processed successfully |
| 401 | Missing signature header |
| 403 | Invalid signature |
| 400 | Invalid webhook data |

## Testing Webhook Locally

```bash
# Generate signature using Node.js
node -e "
const crypto = require('crypto');
const payload = JSON.stringify({
  order_id: 'TEST-001',
  amount: 100000,
  status: 'completed',
  payment_method: 'test'
});
const secret = 'your_webhook_secret';
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log('Signature:', signature);
console.log('Payload:', payload);
"

# Then use the signature in curl
curl -X POST https://your-project.supabase.co/functions/v1/pakasir-webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: <signature_from_above>" \
  -d '<payload_from_above>'
```

## Security Best Practices

1. **Keep Webhook Secret Secure**
   - Never commit webhook secret to git
   - Rotate webhook secret periodically (every 6 months)
   - Use different secrets for production and staging

2. **Monitor Webhook Logs**
   - Check Supabase logs for failed signature verifications
   - Alert on multiple failed attempts (possible attack)

3. **Rotate Secret After Breach**
   - If secret is exposed, rotate immediately
   - Update in both Pakasir and Supabase

4. **Use HTTPS Only**
   - Never use HTTP for webhook endpoints
   - Supabase Edge Functions automatically use HTTPS

## Troubleshooting

### Error: "Missing webhook signature header"
- Check that Pakasir is configured to send signature header
- Verify header name matches: `x-webhook-signature`, `x-pakasir-signature`, or `x-signature`

### Error: "Invalid webhook signature"
- Verify webhook secret matches between Pakasir and Supabase
- Check that raw body is used for signature (not parsed JSON)
- Ensure no whitespace trimming of request body

### Error: "Webhook secret not configured"
- Add `PAKASIR_WEBHOOK_SECRET` to Supabase Edge Functions secrets
- Restart edge function after adding secret

## Additional Notes

- Webhook automatically handles subscription activation on payment completion
- Duplicate webhooks are safely ignored if payment already completed
- Supports subscription extension for existing active subscriptions
