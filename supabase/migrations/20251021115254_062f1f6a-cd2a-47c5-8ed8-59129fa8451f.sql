-- Fix storage bucket untuk broadcast media
-- Set bucket menjadi public agar file bisa diakses
UPDATE storage.buckets 
SET public = true 
WHERE id = 'broadcast-media';

-- Pastikan RLS policies untuk storage sudah benar
-- Policy untuk public access (read)
DROP POLICY IF EXISTS "Public can view broadcast media" ON storage.objects;
CREATE POLICY "Public can view broadcast media"
ON storage.objects FOR SELECT
USING (bucket_id = 'broadcast-media');

-- Policy untuk user upload files
DROP POLICY IF EXISTS "Users can upload their own broadcast media" ON storage.objects;
CREATE POLICY "Users can upload their own broadcast media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'broadcast-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy untuk user update files
DROP POLICY IF EXISTS "Users can update their own broadcast media" ON storage.objects;
CREATE POLICY "Users can update their own broadcast media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'broadcast-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy untuk user delete files
DROP POLICY IF EXISTS "Users can delete their own broadcast media" ON storage.objects;
CREATE POLICY "Users can delete their own broadcast media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'broadcast-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);