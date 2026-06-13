
CREATE POLICY "own food images read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'food-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own food images insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'food-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own food images update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'food-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own food images delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'food-images' AND (storage.foldername(name))[1] = auth.uid()::text);
