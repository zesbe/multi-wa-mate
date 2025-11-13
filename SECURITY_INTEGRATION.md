# 🔒 Security Integration Guide - HalloWa.id

> **Last Updated**: 2025-11-13
> **Version**: Frontend Security Hardening v2.0

This guide explains how to use the security utilities, hooks, and components implemented across HalloWa.id for comprehensive XSS prevention, input validation, and secure form handling.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Security Infrastructure](#security-infrastructure)
3. [Quick Start](#quick-start)
4. [Secure Components](#secure-components)
5. [Secure Hooks](#secure-hooks)
6. [Validation Utilities](#validation-utilities)
7. [Best Practices](#best-practices)
8. [Migration Guide](#migration-guide)
9. [Examples](#examples)

---

## Overview

### What's Been Implemented

**Frontend Security (React/TypeScript)**:
- ✅ **SecureInput/SecureTextarea** - Drop-in replacements with automatic XSS sanitization
- ✅ **useSecureForm** - Reusable hook for secure form handling
- ✅ **Dynamic CSP Plugin** - Strict CSP in production, relaxed in dev
- ✅ **Strong Password Validation** - 12+ chars with complexity requirements
- ✅ **Input Sanitization** - HTML/script tag removal
- ✅ **Session Security** - sessionStorage instead of localStorage

**Backend Security (Node.js)**:
- ✅ **Input Validation** - UUID, phone numbers, user IDs
- ✅ **SSRF Protection** - Media URL validation
- ✅ **DoS Protection** - File size limits, rate limiting
- ✅ **Redis Key Sanitization** - Prevent injection attacks
- ✅ **Memory Leak Fixes** - Proper cleanup intervals

---

## Security Infrastructure

### File Structure

```
src/
├── components/
│   └── secure/
│       ├── SecureInput.tsx       # Secure input components
│       └── index.ts              # Barrel export
├── hooks/
│   └── useSecureForm.ts          # Secure form hook
├── utils/
│   ├── inputValidation.ts        # Input sanitization utilities
│   ├── passwordValidation.ts     # Password validation with Zod
│   └── phoneValidation.ts        # Phone number validation
├── plugins/
│   └── vite-plugin-csp.ts       # Dynamic CSP plugin
└── integrations/
    └── supabase/
        └── client.ts             # Secure Supabase config

railway-service/
└── utils/
    └── inputValidation.js        # Backend validation utilities
```

---

## Quick Start

### 1. Install Dependencies (if needed)

All dependencies are already installed:
- `zod` - Schema validation
- `dompurify` - HTML sanitization (via CDN)

### 2. Import Secure Components

```typescript
import { SecureInput, SecureTextarea } from '@/components/secure';
```

### 3. Replace Regular Inputs

**Before (Vulnerable)**:
```tsx
<Input
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

**After (Secure)**:
```tsx
<SecureInput
  value={value}
  onChange={(e) => setValue(e.target.value)}
  maxLength={200}
/>
```

---

## Secure Components

### SecureInput

Drop-in replacement for `<Input>` with automatic XSS prevention.

**Features**:
- ✅ Auto-sanitizes on blur
- ✅ Optional character limit
- ✅ Visual character counter
- ✅ Callback for sanitized value

**Usage**:

```tsx
import { SecureInput } from '@/components/secure';

function MyForm() {
  const [name, setName] = useState('');

  return (
    <SecureInput
      value={name}
      onChange={(e) => setName(e.target.value)}
      onSecureChange={(sanitized) => console.log('Sanitized:', sanitized)}
      maxLength={100}
      sanitizeOnBlur={true} // default
      placeholder="Enter your name"
    />
  );
}
```

**Props**:
- All standard `Input` props
- `maxLength?: number` - Character limit
- `sanitizeOnBlur?: boolean` - Auto-sanitize on blur (default: true)
- `onSecureChange?: (value: string) => void` - Callback with sanitized value

---

### SecureTextarea

Drop-in replacement for `<Textarea>` with XSS prevention and character counter.

**Features**:
- ✅ Auto-sanitizes on blur
- ✅ Built-in character counter
- ✅ Max length enforcement
- ✅ Visual feedback

**Usage**:

```tsx
import { SecureTextarea } from '@/components/secure';

function BroadcastForm() {
  const [message, setMessage] = useState('');

  return (
    <SecureTextarea
      value={message}
      onChange={(e) => setMessage(e.target.value)}
      onSecureChange={(sanitized) => console.log('Sanitized:', sanitized)}
      maxLength={4096}
      rows={6}
      placeholder="Enter your message"
    />
  );
}
```

**Props**:
- All standard `Textarea` props
- `maxLength?: number` - Character limit with counter
- `sanitizeOnBlur?: boolean` - Auto-sanitize on blur (default: true)
- `onSecureChange?: (value: string) => void` - Callback with sanitized value

---

## Secure Hooks

### useSecureTextInput

Reusable hook for individual text input fields with validation.

**Features**:
- ✅ Automatic sanitization
- ✅ Built-in validation
- ✅ Error handling
- ✅ Reset functionality

**Usage**:

```tsx
import { useSecureTextInput } from '@/components/secure';

function ProfileForm() {
  const fullName = useSecureTextInput('', {
    required: true,
    maxLength: 100,
    validator: (val) => {
      if (val.length < 2) return 'Name too short';
      return null;
    }
  });

  const handleSubmit = () => {
    if (!fullName.validate()) {
      console.error(fullName.error);
      return;
    }

    // Use sanitized value for API call
    api.updateProfile({ name: fullName.sanitizedValue });
  };

  return (
    <div>
      <Input
        value={fullName.value}
        onChange={(e) => fullName.setValue(e.target.value)}
      />
      {fullName.error && <p className="text-red-500">{fullName.error}</p>}
      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
}
```

**Returns**:
```typescript
{
  value: string;              // Raw value
  sanitizedValue: string;     // Auto-sanitized value
  error: string | null;       // Validation error
  setValue: (val: string) => void;
  validate: () => boolean;
  reset: () => void;
}
```

---

### useSecureForm

Hook for managing multiple form fields with validation.

**Usage**:

```tsx
import { useSecureForm } from '@/components/secure';

function ContactForm() {
  const form = useSecureForm({
    name: '',
    email: '',
    message: ''
  });

  const handleSubmit = async () => {
    if (!form.validateAll()) {
      console.error('Validation failed:', form.errors);
      return;
    }

    // Use sanitized values for API
    await api.createContact(form.sanitizedValues);
    form.reset();
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <div>
        <Input
          value={form.values.name}
          onChange={(e) => form.setField('name', e.target.value)}
        />
        {form.errors.name && <p className="text-red-500">{form.errors.name}</p>}
      </div>

      <div>
        <Textarea
          value={form.values.message}
          onChange={(e) => form.setField('message', e.target.value)}
        />
        {form.errors.message && <p className="text-red-500">{form.errors.message}</p>}
      </div>

      <button type="submit">Submit</button>
    </form>
  );
}
```

**Returns**:
```typescript
{
  values: Record<string, string>;          // Raw values
  sanitizedValues: Record<string, string>; // Auto-sanitized values
  errors: Record<string, string | null>;   // Validation errors
  setField: (field, value) => void;
  validateAll: () => boolean;
  reset: () => void;
}
```

---

### usePhoneInput

Specialized hook for Indonesian phone number validation.

**Usage**:

```tsx
import { usePhoneInput } from '@/components/secure';

function PhoneForm() {
  const phone = usePhoneInput('');

  const handleSubmit = () => {
    if (!phone.validate()) {
      console.error(phone.error);
      return;
    }

    // Use cleaned value (digits only)
    api.savePhone(phone.cleanedValue);
  };

  return (
    <div>
      <Input
        type="tel"
        value={phone.value}
        onChange={(e) => phone.setPhone(e.target.value)}
        placeholder="628123456789"
      />
      {phone.error && <p className="text-red-500">{phone.error}</p>}
      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
}
```

**Validation Rules**:
- ✅ Must start with `62` (Indonesia)
- ✅ Length: 10-15 digits
- ✅ Auto-removes non-digits (except +)

---

## Validation Utilities

### Frontend (TypeScript)

#### sanitizeText

Removes dangerous HTML/script tags from user input.

```typescript
import { sanitizeText } from '@/utils/inputValidation';

const userInput = '<script>alert("XSS")</script>Hello';
const safe = sanitizeText(userInput);
// Output: "Hello"
```

#### passwordSchema (Zod)

Validates password strength.

```typescript
import { passwordSchema, calculatePasswordStrength } from '@/utils/passwordValidation';

const result = passwordSchema.safeParse('MyP@ssw0rd123');
if (!result.success) {
  console.error(result.error.errors);
}

const strength = calculatePasswordStrength('MyP@ssw0rd123');
// Returns: 0-100
```

**Requirements**:
- Minimum 12 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

---

### Backend (JavaScript)

#### validateUserId

Validates and sanitizes user IDs (UUID format).

```javascript
const { validateUserId } = require('./utils/inputValidation');

try {
  const validId = validateUserId(userId);
  // Use validId for database queries
} catch (error) {
  console.error('Invalid user ID');
}
```

#### isValidMediaUrl (SSRF Protection)

Validates media URLs to prevent SSRF attacks.

```javascript
const { isValidMediaUrl } = require('./utils/inputValidation');

if (!isValidMediaUrl(url)) {
  throw new Error('Invalid or unsafe URL');
}
```

**Blocks**:
- ❌ Non-HTTPS URLs
- ❌ Private IPs (10.x, 192.168.x, 172.16-31.x)
- ❌ Localhost/127.0.0.1
- ❌ Metadata endpoints (169.254.x.x)

#### sanitizeRedisKey

Prevents Redis key injection.

```javascript
const { sanitizeRedisKey } = require('./utils/inputValidation');

const safeKey = `ratelimit:user:${sanitizeRedisKey(userId)}:broadcast`;
```

---

## Best Practices

### ✅ DO

1. **Always use SecureInput/SecureTextarea for user-generated content**
   ```tsx
   <SecureInput value={name} onChange={...} maxLength={100} />
   ```

2. **Use sanitizedValue for API calls**
   ```tsx
   const field = useSecureTextInput('');
   api.save({ name: field.sanitizedValue }); // ✅ Sanitized
   ```

3. **Set reasonable maxLength limits**
   - Names: 100-200 chars
   - Messages: 1000-4096 chars
   - Descriptions: 500-1000 chars

4. **Validate on both client and server**
   ```tsx
   // Client
   if (!form.validateAll()) return;

   // Server also validates
   ```

5. **Use password validation for signup**
   ```tsx
   const validation = passwordSchema.safeParse(password);
   if (!validation.success) {
     toast.error('Password tidak memenuhi syarat');
   }
   ```

---

### ❌ DON'T

1. **Don't use raw Input for user content**
   ```tsx
   <Input value={userInput} /> // ❌ Vulnerable to XSS
   ```

2. **Don't skip sanitization on API calls**
   ```tsx
   api.save({ message: rawInput }); // ❌ Dangerous
   api.save({ message: sanitizeText(rawInput) }); // ✅ Safe
   ```

3. **Don't trust client-side validation alone**
   ```tsx
   // Always validate on backend too!
   ```

4. **Don't hardcode credentials**
   ```tsx
   const API_KEY = "abc123"; // ❌ Never!
   const API_KEY = import.meta.env.VITE_API_KEY; // ✅ Use env vars
   ```

---

## Migration Guide

### Step 1: Identify Vulnerable Inputs

Search for regular `<Input>` and `<Textarea>` components that handle user-generated content:

```bash
# Find all Input components
grep -r "<Input" src/pages/
grep -r "<Textarea" src/pages/
```

### Step 2: Import Secure Components

```tsx
import { SecureInput, SecureTextarea } from '@/components/secure';
```

### Step 3: Replace Components

**Before**:
```tsx
<Input
  value={formData.name}
  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
  placeholder="Enter name"
/>
```

**After**:
```tsx
<SecureInput
  value={formData.name}
  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
  placeholder="Enter name"
  maxLength={200}
/>
```

### Step 4: Use Sanitized Values for API

**Before**:
```tsx
await supabase.from('contacts').insert({
  name: formData.name // ❌ Raw value
});
```

**After (Option 1 - Direct sanitization)**:
```tsx
import { sanitizeText } from '@/utils/inputValidation';

await supabase.from('contacts').insert({
  name: sanitizeText(formData.name) // ✅ Sanitized
});
```

**After (Option 2 - useSecureForm hook)**:
```tsx
const form = useSecureForm({ name: '', email: '' });

await supabase.from('contacts').insert({
  name: form.sanitizedValues.name, // ✅ Auto-sanitized
  email: form.sanitizedValues.email
});
```

---

## Examples

### Example 1: Secure Contact Form

```tsx
import { SecureInput, SecureTextarea, useSecureForm } from '@/components/secure';

function ContactForm() {
  const form = useSecureForm({
    name: '',
    email: '',
    message: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.validateAll()) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      const { error } = await supabase.from('contacts').insert({
        name: form.sanitizedValues.name,
        email: form.sanitizedValues.email,
        message: form.sanitizedValues.message
      });

      if (error) throw error;

      toast.success('Contact saved!');
      form.reset();
    } catch (error) {
      toast.error('Failed to save contact');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <Label>Name</Label>
        <SecureInput
          value={form.values.name}
          onChange={(e) => form.setField('name', e.target.value)}
          maxLength={100}
          required
        />
        {form.errors.name && <p className="text-red-500">{form.errors.name}</p>}
      </div>

      <div>
        <Label>Message</Label>
        <SecureTextarea
          value={form.values.message}
          onChange={(e) => form.setField('message', e.target.value)}
          maxLength={1000}
          rows={5}
          required
        />
        {form.errors.message && <p className="text-red-500">{form.errors.message}</p>}
      </div>

      <Button type="submit">Submit</Button>
    </form>
  );
}
```

---

### Example 2: Broadcast Form (Real Implementation)

See `src/pages/Broadcast.tsx` for a complete real-world example with:
- ✅ SecureInput for campaign name, variables
- ✅ SecureTextarea for message content
- ✅ Character limits on all fields
- ✅ Phone number validation
- ✅ File upload with size limits

Key sections:
```tsx
// Campaign name with 200 char limit
<SecureInput
  id="name"
  value={formData.name}
  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
  maxLength={200}
  required
/>

// Message with 4096 char limit and counter
<SecureTextarea
  id="message"
  value={formData.message}
  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
  maxLength={4096}
  rows={6}
  required
/>
```

---

### Example 3: Password Validation

```tsx
import {
  passwordSchema,
  calculatePasswordStrength,
  getPasswordStrengthLabel,
  PASSWORD_REQUIREMENTS
} from '@/utils/passwordValidation';

function SignupForm() {
  const [password, setPassword] = useState('');
  const [strength, setStrength] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const newStrength = calculatePasswordStrength(password);
    setStrength(newStrength);

    const validation = passwordSchema.safeParse(password);
    if (!validation.success) {
      setErrors(validation.error.errors.map(e => e.message));
    } else {
      setErrors([]);
    }
  }, [password]);

  const handleSubmit = async () => {
    const validation = passwordSchema.safeParse(password);
    if (!validation.success) {
      toast.error('Password tidak memenuhi syarat keamanan');
      return;
    }

    // Proceed with signup
  };

  return (
    <div>
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={12}
      />

      {/* Strength indicator */}
      <div className="mt-2">
        <div className="flex justify-between text-xs">
          <span>Password Strength</span>
          <span className={getPasswordStrengthLabel(strength).color}>
            {getPasswordStrengthLabel(strength).label}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={getPasswordStrengthLabel(strength).bgColor}
            style={{ width: `${strength}%` }}
          />
        </div>
      </div>

      {/* Requirements checklist */}
      <div className="mt-2 space-y-1">
        {PASSWORD_REQUIREMENTS.map((req, i) => {
          const isMet = !errors.some(err =>
            err.toLowerCase().includes(req.split(' ')[0].toLowerCase())
          );
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              {isMet ? <CheckCircle2 className="text-green-600" /> : <XCircle className="text-gray-400" />}
              <span>{req}</span>
            </div>
          );
        })}
      </div>

      <Button onClick={handleSubmit}>Sign Up</Button>
    </div>
  );
}
```

---

## Testing Security

### Manual Testing

1. **XSS Test**:
   ```
   Input: <script>alert('XSS')</script>Hello
   Expected: "Hello" (script removed)
   ```

2. **HTML Injection Test**:
   ```
   Input: <img src=x onerror=alert('XSS')>
   Expected: Text only, no execution
   ```

3. **Character Limit Test**:
   ```
   Input: 201 characters in name field (max 200)
   Expected: Truncated or prevented
   ```

4. **Password Strength Test**:
   ```
   Weak: "password"
   Expected: Rejected

   Strong: "MyP@ssw0rd123"
   Expected: Accepted with strength indicator
   ```

---

## CSP Configuration

### Dynamic CSP Plugin

The Vite plugin (`src/plugins/vite-plugin-csp.ts`) automatically handles CSP:

**Development**:
- Adds `'unsafe-inline' 'unsafe-eval'` for HMR
- Relaxed for developer experience

**Production**:
- Strict CSP without unsafe directives
- Automatic security hardening

**Configuration** (`vite.config.ts`):
```typescript
import { dynamicCSP } from './src/plugins/vite-plugin-csp';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    dynamicCSP(), // 🔒 Automatic CSP management
    VitePWA({ ... })
  ]
}));
```

**Production CSP** (`index.html`):
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://cdn.jsdelivr.net;
  style-src 'self' https://fonts.googleapis.com;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co;
  img-src 'self' data: https: blob:;
  font-src 'self' https://fonts.gstatic.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
">
```

---

## Environment Variables

### Required Variables

Create `.env.local` (never commit!):

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Optional: Backend API
# VITE_API_URL=http://localhost:3000
```

### Security Notes

1. ✅ All variables MUST start with `VITE_`
2. ✅ Never commit `.env.local` to Git
3. ✅ Supabase anon key is safe to expose (RLS protected)
4. ✅ Set in hosting platform for production (Vercel, Netlify, etc.)
5. ✅ App uses sessionStorage (cleared on browser close)

---

## Troubleshooting

### Issue: "Missing Supabase environment variables"

**Cause**: `.env.local` not created or variables missing

**Fix**:
```bash
cp .env.example .env.local
# Edit .env.local and add your Supabase credentials
```

### Issue: Characters not being sanitized

**Cause**: Not using sanitized value for API calls

**Fix**:
```tsx
// ❌ Wrong
api.save({ name: field.value });

// ✅ Correct
api.save({ name: field.sanitizedValue });
```

### Issue: CSP blocking resources in dev

**Cause**: CSP plugin not configured

**Fix**: Ensure `dynamicCSP()` is in `vite.config.ts` plugins array

---

## Support & Contribution

### Reporting Security Issues

For security vulnerabilities, please contact the security team directly:
- **Email**: security@hallowa.id
- **GitHub**: Create private security advisory

### Documentation Updates

This guide should be updated whenever:
- New security utilities are added
- Validation rules change
- New components are created
- Best practices evolve

---

## Changelog

### v2.0 (2025-11-13) - Frontend Security Hardening
- ✅ Added SecureInput/SecureTextarea components
- ✅ Added useSecureForm hook
- ✅ Implemented dynamic CSP plugin
- ✅ Strong password validation (12+ chars)
- ✅ Session security (sessionStorage)
- ✅ Removed hardcoded credentials
- ✅ Applied to Broadcast page

### v1.0 (Previous) - Backend Security
- ✅ Input validation utilities
- ✅ SSRF protection
- ✅ DoS protection
- ✅ Rate limiting
- ✅ Memory leak fixes

---

## References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [CSP Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Zod Documentation](https://zod.dev/)
- [React Security Best Practices](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)

---

**End of Security Integration Guide**
