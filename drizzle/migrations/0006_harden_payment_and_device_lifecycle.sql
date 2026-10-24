ALTER TABLE public.payment_webhook_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.payment_webhook_events
  ADD CONSTRAINT payment_webhook_events_status_check CHECK (status IN ('processing', 'processed', 'failed')) NOT VALID;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS status_token_hash text,
  ADD COLUMN IF NOT EXISTS email_delivery_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS email_delivery_error text,
  ADD COLUMN IF NOT EXISTS entitlement_status text NOT NULL DEFAULT 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS payments_status_token_hash_unique
  ON public.payments (status_token_hash)
  WHERE status_token_hash IS NOT NULL;

ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS manual_expiry_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_synced_expires_at timestamptz;

CREATE TABLE public.access_device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_id uuid NOT NULL REFERENCES public.user_access(id) ON DELETE CASCADE,
  device_key_hash text NOT NULL,
  device_type text NOT NULL DEFAULT 'browser',
  label text,
  user_agent text,
  last_ip text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (access_id, device_key_hash, device_type)
);
GRANT ALL ON public.access_device_sessions TO service_role;
ALTER TABLE public.access_device_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages access device sessions"
ON public.access_device_sessions FOR ALL TO service_role
USING (true) WITH CHECK (true);
CREATE INDEX access_device_sessions_active_idx
  ON public.access_device_sessions (access_id, active, last_seen_at DESC);

ALTER TABLE public.purchase_confirmations
  ADD COLUMN IF NOT EXISTS checkout_claimed_at timestamptz;

COMMENT ON COLUMN public.user_access.active_session_ip IS 'DEPRECATED: device limits use public.access_device_sessions; retained for compatibility.';
COMMENT ON COLUMN public.user_access.active_session_user_agent IS 'DEPRECATED: device limits use public.access_device_sessions; retained for compatibility.';