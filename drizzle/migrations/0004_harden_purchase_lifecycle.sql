CREATE TABLE public.purchase_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  price_id text NOT NULL,
  payment_method text NOT NULL,
  environment text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_confirmations_status_check CHECK (status IN ('pending', 'confirmed', 'consumed', 'expired')),
  CONSTRAINT purchase_confirmations_method_check CHECK (payment_method IN ('card', 'pix')),
  CONSTRAINT purchase_confirmations_environment_check CHECK (environment IN ('sandbox', 'live'))
);
GRANT ALL ON public.purchase_confirmations TO service_role;
ALTER TABLE public.purchase_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages purchase confirmations"
ON public.purchase_confirmations FOR ALL TO service_role
USING (true) WITH CHECK (true);
CREATE INDEX purchase_confirmations_email_idx ON public.purchase_confirmations (email, environment, created_at DESC);
CREATE INDEX purchase_confirmations_expiry_idx ON public.purchase_confirmations (expires_at) WHERE consumed_at IS NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS payment_kind text,
  ADD COLUMN IF NOT EXISTS price_id text,
  ADD COLUMN IF NOT EXISTS access_id uuid REFERENCES public.user_access(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS failure_reason text;
CREATE INDEX IF NOT EXISTS payments_email_environment_idx ON public.payments (email, environment, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments (status, environment, updated_at DESC);

COMMENT ON TABLE public.subscriptions IS 'DEPRECATED: legacy Auth-user subscriptions; custom access subscriptions use public.access_subscriptions.';