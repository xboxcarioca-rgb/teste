
-- Explicit deny DELETE on halftone_orders for non-service roles
CREATE POLICY "no public delete" ON public.halftone_orders FOR DELETE TO anon, authenticated USING (false);

-- Explicit deny INSERT/UPDATE/DELETE on payments for authenticated/anon (service_role bypasses RLS)
CREATE POLICY "payments no insert" ON public.payments FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "payments no update" ON public.payments FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "payments no delete" ON public.payments FOR DELETE TO anon, authenticated USING (false);

-- Storage RLS for halftone-uploads bucket: deny all non-service access
CREATE POLICY "halftone-uploads no select" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'halftone-uploads' AND false);
CREATE POLICY "halftone-uploads no insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'halftone-uploads' AND false);
CREATE POLICY "halftone-uploads no update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'halftone-uploads' AND false) WITH CHECK (bucket_id = 'halftone-uploads' AND false);
CREATE POLICY "halftone-uploads no delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'halftone-uploads' AND false);
