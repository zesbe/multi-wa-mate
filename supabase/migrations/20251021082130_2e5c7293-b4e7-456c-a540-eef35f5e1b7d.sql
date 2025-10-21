-- Create storage bucket for broadcast media files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('broadcast-media', 'broadcast-media', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

-- Create policy for users to upload their own broadcast media
CREATE POLICY "Users can upload their own broadcast media"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'broadcast-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create policy for users to view their own broadcast media
CREATE POLICY "Users can view their own broadcast media"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'broadcast-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create policy for users to delete their own broadcast media
CREATE POLICY "Users can delete their own broadcast media"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'broadcast-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);