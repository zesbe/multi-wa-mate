-- Add columns for API key hashing
ALTER TABLE public.api_keys 
ADD COLUMN IF NOT EXISTS api_key_hash TEXT,
ADD COLUMN IF NOT EXISTS api_key_prefix TEXT;

-- Create index on hash for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(api_key_hash);

-- Add comment
COMMENT ON COLUMN public.api_keys.api_key_hash IS 'SHA-256 hash of the API key for secure storage';
COMMENT ON COLUMN public.api_keys.api_key_prefix IS 'First 8 characters of API key for display purposes';
