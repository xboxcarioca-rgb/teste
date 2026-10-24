-- 1) Adicionar colunas de plano + controle de dispositivo na tabela user_access
ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS plan_code text,
  ADD COLUMN IF NOT EXISTS device_limit integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS active_session_token text,
  ADD COLUMN IF NOT EXISTS active_session_started_at timestamp with time zone;

-- 2) Permitir admin INSERT e DELETE em user_access (faltam essas policies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_access' AND policyname = 'Admins can insert user access'
  ) THEN
    CREATE POLICY "Admins can insert user access"
      ON public.user_access
      FOR INSERT
      TO authenticated
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_access' AND policyname = 'Admins can delete user access'
  ) THEN
    CREATE POLICY "Admins can delete user access"
      ON public.user_access
      FOR DELETE
      TO authenticated
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END
$$;

-- 3) Índice para acelerar busca por código ativo por email
CREATE INDEX IF NOT EXISTS user_access_email_status_idx
  ON public.user_access (email, status);