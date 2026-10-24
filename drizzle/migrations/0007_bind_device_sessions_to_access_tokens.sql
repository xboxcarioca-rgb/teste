ALTER TABLE public.access_device_sessions
  ADD COLUMN IF NOT EXISTS session_token_hash text,
  ADD COLUMN IF NOT EXISTS session_expires_at timestamptz;
CREATE INDEX IF NOT EXISTS access_device_sessions_token_idx
  ON public.access_device_sessions (access_id, session_token_hash)
  WHERE active = true AND session_token_hash IS NOT NULL;