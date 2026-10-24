-- Affiliates: explicit deny for client roles + revoke grants (all access is service_role only)
REVOKE ALL ON public.affiliates FROM anon, authenticated;
REVOKE ALL ON public.affiliate_sales FROM anon, authenticated;

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "affiliates no client access" ON public.affiliates;
CREATE POLICY "affiliates no client access"
ON public.affiliates FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "affiliate_sales no client access" ON public.affiliate_sales;
CREATE POLICY "affiliate_sales no client access"
ON public.affiliate_sales FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);

-- downloads bucket: explicit deny-all for client roles (served via signed URLs from server)
DROP POLICY IF EXISTS "downloads no select" ON storage.objects;
CREATE POLICY "downloads no select"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'downloads' AND false);

DROP POLICY IF EXISTS "downloads no insert" ON storage.objects;
CREATE POLICY "downloads no insert"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'downloads' AND false);

DROP POLICY IF EXISTS "downloads no update" ON storage.objects;
CREATE POLICY "downloads no update"
ON storage.objects FOR UPDATE TO anon, authenticated
USING (bucket_id = 'downloads' AND false)
WITH CHECK (bucket_id = 'downloads' AND false);

DROP POLICY IF EXISTS "downloads no delete" ON storage.objects;
CREATE POLICY "downloads no delete"
ON storage.objects FOR DELETE TO anon, authenticated
USING (bucket_id = 'downloads' AND false);