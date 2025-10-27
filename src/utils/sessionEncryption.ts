/**
 * Encrypt WhatsApp session data using AES-256-GCM
 * Returns base64 encoded encrypted data with IV prepended
 */
export const encryptSessionData = async (
  sessionData: any,
  encryptionKey: string
): Promise<string> => {
  // Convert session data to string
  const dataString = JSON.stringify(sessionData);
  const encoder = new TextEncoder();
  const data = encoder.encode(dataString);

  // Derive key from encryption key using SHA-256
  const keyMaterial = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(encryptionKey)
  );

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt data
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    cryptoKey,
    data
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedData), iv.length);

  // Convert to base64
  return btoa(String.fromCharCode(...combined));
};

/**
 * Decrypt WhatsApp session data
 * Expects base64 encoded data with IV prepended
 */
export const decryptSessionData = async (
  encryptedData: string,
  encryptionKey: string
): Promise<any> => {
  // Decode base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

  // Extract IV (first 12 bytes)
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  // Derive key from encryption key
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(encryptionKey)
  );

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Decrypt data
  const decryptedData = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    cryptoKey,
    encrypted
  );

  // Convert back to object
  const decoder = new TextDecoder();
  const dataString = decoder.decode(decryptedData);
  return JSON.parse(dataString);
};

/**
 * Generate a secure encryption key for a device
 * Should be stored securely (e.g., Supabase Vault)
 */
export const generateEncryptionKey = (): string => {
  const array = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};
