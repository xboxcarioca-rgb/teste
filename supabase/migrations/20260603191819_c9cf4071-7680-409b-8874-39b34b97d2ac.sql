
CREATE TABLE public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  pix_key TEXT,
  whatsapp TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  commission_cents INTEGER NOT NULL DEFAULT 4000,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.affiliates TO service_role;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only affiliates" ON public.affiliates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER update_affiliates_updated_at BEFORE UPDATE ON public.affiliates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_affiliates_slug ON public.affiliates(slug);
CREATE INDEX idx_affiliates_email ON public.affiliates(email);

CREATE TABLE public.affiliate_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  customer_whatsapp TEXT,
  pix_proof_note TEXT,
  plan_code TEXT NOT NULL DEFAULT 'anual',
  amount_cents INTEGER NOT NULL DEFAULT 14700,
  commission_cents INTEGER NOT NULL DEFAULT 4000,
  status TEXT NOT NULL DEFAULT 'pending',
  user_access_id UUID REFERENCES public.user_access(id) ON DELETE SET NULL,
  admin_note TEXT,
  activated_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.affiliate_sales TO service_role;
ALTER TABLE public.affiliate_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only affiliate_sales" ON public.affiliate_sales FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER update_affiliate_sales_updated_at BEFORE UPDATE ON public.affiliate_sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_affiliate_sales_affiliate ON public.affiliate_sales(affiliate_id, created_at DESC);
CREATE INDEX idx_affiliate_sales_status ON public.affiliate_sales(status);
CREATE INDEX idx_affiliate_sales_customer_email ON public.affiliate_sales(customer_email);
