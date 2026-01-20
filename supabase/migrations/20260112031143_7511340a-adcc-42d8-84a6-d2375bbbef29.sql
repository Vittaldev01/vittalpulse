-- Add media_items column to campaign_messages for multiple media support
ALTER TABLE campaign_messages
ADD COLUMN IF NOT EXISTS media_items jsonb DEFAULT NULL;

COMMENT ON COLUMN campaign_messages.media_items IS 'Array of MediaItem objects: [{url: string, type: "image"|"video"|"audio"|"document", name?: string}]';

-- Create storage bucket for campaign media files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-media',
  'campaign-media',
  true,
  20971520, -- 20MB per file
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/x-m4v',
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/x-m4a',
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
) ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policy for authenticated users to upload campaign media
CREATE POLICY "Authenticated users can upload campaign media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'campaign-media' AND auth.role() = 'authenticated');

-- Policy for public read access to campaign media
CREATE POLICY "Public can view campaign media"
ON storage.objects FOR SELECT
USING (bucket_id = 'campaign-media');

-- Policy for users to delete their own media files
CREATE POLICY "Users can delete own campaign media"
ON storage.objects FOR DELETE
USING (bucket_id = 'campaign-media' AND auth.uid()::text = (storage.foldername(name))[1]);