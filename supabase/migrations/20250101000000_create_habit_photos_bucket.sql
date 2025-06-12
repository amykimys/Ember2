-- Create storage bucket for habit photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('habit-photos', 'habit-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for habit photos
CREATE POLICY "Users can upload their own habit photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'habit-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own habit photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'habit-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own habit photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'habit-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own habit photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'habit-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  ); 