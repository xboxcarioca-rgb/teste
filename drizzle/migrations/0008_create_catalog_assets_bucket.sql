-- Bucket de objetos do Catálogo em Lote.
-- Sem este bucket, todo envio de original/mockup falha ("Bucket not found")
-- e a geração por arquivo quebra mesmo com as tabelas criadas.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalog-assets',
  'catalog-assets',
  false,
  26214400, -- 25 MB: cobre PNGs de até 20 MB + margem
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Garante a política mesmo que o bucket já exista sem ela.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Service role manages catalog assets'
  ) THEN
    CREATE POLICY "Service role manages catalog assets"
      ON storage.objects FOR ALL TO service_role
      USING (bucket_id = 'catalog-assets')
      WITH CHECK (bucket_id = 'catalog-assets');
  END IF;
END $$;
