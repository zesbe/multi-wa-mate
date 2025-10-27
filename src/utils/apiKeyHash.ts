/**
 * Hash API key using SHA-256
 * Returns hex string of hash
 */
export const hashApiKey = async (apiKey: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

/**
 * Generate a secure random API key
 * Format: wap_[32 random characters]
 */
export const generateSecureApiKey = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomValues = new Uint8Array(32);
  crypto.getRandomValues(randomValues);
  
  const key = Array.from(randomValues)
    .map(x => chars[x % chars.length])
    .join('');
  
  return `wap_${key}`;
};

/**
 * Get first 8 characters for display purposes
 */
export const getApiKeyPrefix = (apiKey: string): string => {
  return apiKey.substring(0, 8);
};
