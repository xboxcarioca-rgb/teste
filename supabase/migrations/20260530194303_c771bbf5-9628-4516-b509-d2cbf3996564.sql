ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS active_session_ip text,
  ADD COLUMN IF NOT EXISTS active_session_user_agent text;