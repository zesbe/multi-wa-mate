-- Add error_message column to devices table if not exists
ALTER TABLE public.devices 
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.devices.error_message IS 'Store error messages for debugging connection issues';