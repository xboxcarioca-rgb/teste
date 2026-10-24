CREATE TABLE public.access_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_id uuid REFERENCES public.user_access(id) ON DELETE SET NULL,
  email text NOT NULL,
  stripe_subscription_id text NOT NULL,
  stripe_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  scheduled_price_id text,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stripe_subscription_id, environment)
);
GRANT ALL ON public.access_subscriptions TO service_role;
ALTER TABLE public.access_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages access subscriptions"
ON public.access_subscriptions FOR ALL TO service_role
USING (true) WITH CHECK (true);
CREATE INDEX access_subscriptions_access_idx ON public.access_subscriptions (access_id, environment, created_at DESC);
CREATE INDEX access_subscriptions_email_idx ON public.access_subscriptions (email, environment, created_at DESC);
CREATE INDEX access_subscriptions_customer_idx ON public.access_subscriptions (stripe_customer_id, environment);

CREATE TABLE public.payment_webhook_events (
  event_id text NOT NULL,
  environment text NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, environment)
);
GRANT ALL ON public.payment_webhook_events TO service_role;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages payment webhook events"
ON public.payment_webhook_events FOR ALL TO service_role
USING (true) WITH CHECK (true);

ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS payment_customer_id text,
  ADD COLUMN IF NOT EXISTS payment_subscription_id text,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS user_access_payment_subscription_unique
  ON public.user_access (payment_subscription_id)
  WHERE payment_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_access_payment_customer_idx
  ON public.user_access (payment_customer_id)
  WHERE payment_customer_id IS NOT NULL;

CREATE TRIGGER update_access_subscriptions_updated_at
BEFORE UPDATE ON public.access_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();