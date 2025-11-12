-- Move uuid-ossp extension out of public schema
-- This follows Supabase best practices for extension placement

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop the extension from public schema (if it exists there)
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;

-- Create the extension in the extensions schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;

-- Grant usage on extensions schema to authenticated users
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;