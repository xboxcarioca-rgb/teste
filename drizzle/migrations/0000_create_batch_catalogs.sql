CREATE TABLE public.catalog_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_access_id UUID NOT NULL REFERENCES public.user_access(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Camisetas',
  prefix TEXT NOT NULL DEFAULT 'CAT',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','processing','completed','published','failed')),
  public_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  published_at TIMESTAMPTZ,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_items INTEGER NOT NULL DEFAULT 0,
  completed_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.catalog_batches TO service_role;
ALTER TABLE public.catalog_batches ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.catalog_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.catalog_batches(id) ON DELETE CASCADE,
  user_access_id UUID NOT NULL REFERENCES public.user_access(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  original_path TEXT NOT NULL,
  mockup_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_filename TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('processing','ready','error')),
  error_message TEXT,
  product_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_access_id, code)
);
GRANT ALL ON public.catalog_products TO service_role;
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.catalog_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_access_id UUID NOT NULL REFERENCES public.user_access(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_access_id, name)
);
GRANT ALL ON public.catalog_templates TO service_role;
ALTER TABLE public.catalog_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX catalog_batches_owner_created_idx ON public.catalog_batches(user_access_id, created_at DESC);
CREATE INDEX catalog_products_batch_order_idx ON public.catalog_products(batch_id, sort_order);
CREATE INDEX catalog_products_owner_code_idx ON public.catalog_products(user_access_id, code);
CREATE INDEX catalog_templates_owner_idx ON public.catalog_templates(user_access_id);

CREATE OR REPLACE FUNCTION public.set_catalog_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER catalog_batches_updated_at BEFORE UPDATE ON public.catalog_batches
FOR EACH ROW EXECUTE FUNCTION public.set_catalog_updated_at();
CREATE TRIGGER catalog_products_updated_at BEFORE UPDATE ON public.catalog_products
FOR EACH ROW EXECUTE FUNCTION public.set_catalog_updated_at();
CREATE TRIGGER catalog_templates_updated_at BEFORE UPDATE ON public.catalog_templates
FOR EACH ROW EXECUTE FUNCTION public.set_catalog_updated_at();

CREATE POLICY "Service role manages catalog batches" ON public.catalog_batches FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages catalog products" ON public.catalog_products FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages catalog templates" ON public.catalog_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages catalog assets" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'catalog-assets') WITH CHECK (bucket_id = 'catalog-assets');