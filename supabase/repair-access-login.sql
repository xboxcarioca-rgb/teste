-- ============================================================================
-- DTFLEXPRO — reparo do login (e-mail + código)
--
-- Sintoma: "Código inválido ou expirado" mesmo com o código certo, ou o acesso
-- cai logo depois de entrar.
--
-- Causa: o código atual identifica o dispositivo por `device_key_hash` e guarda
-- a sessão em `session_token_hash` (migrations 0006/0007). Em bancos que ainda
-- estão no schema antigo, a tabela `access_device_sessions` não tem essas
-- colunas, então a gravação falha e o login é recusado.
--
-- Como usar: Supabase → SQL Editor → cole este arquivo → Run.
-- É idempotente: pode rodar quantas vezes quiser, não apaga nada.
-- ============================================================================

-- 1) Colunas que o login grava/lê -------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_id uuid NOT NULL REFERENCES public.user_access(id) ON DELETE CASCADE,
  device_type text NOT NULL DEFAULT 'browser',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.access_device_sessions
  ADD COLUMN IF NOT EXISTS device_key_hash     text,
  ADD COLUMN IF NOT EXISTS session_token_hash  text,
  ADD COLUMN IF NOT EXISTS session_expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS label               text,
  ADD COLUMN IF NOT EXISTS user_agent          text,
  ADD COLUMN IF NOT EXISTS last_ip             text,
  ADD COLUMN IF NOT EXISTS active              boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at          timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at        timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS revoked_at          timestamptz;

-- 2) Backfill das linhas antigas (não tinham hash de dispositivo) ------------
UPDATE public.access_device_sessions
   SET device_key_hash = 'legacy-' || id::text
 WHERE device_key_hash IS NULL;

ALTER TABLE public.access_device_sessions
  ALTER COLUMN device_key_hash SET NOT NULL;

-- 3) Unicidade usada pelo upsert do login -----------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS access_device_sessions_device_unique
  ON public.access_device_sessions (access_id, device_key_hash, device_type);

-- 4) Índice da sessão durável ------------------------------------------------
CREATE INDEX IF NOT EXISTS access_device_sessions_token_idx
  ON public.access_device_sessions (access_id, session_token_hash)
  WHERE active = true AND session_token_hash IS NOT NULL;

-- 5) Permissões (o app acessa via service_role) ------------------------------
GRANT ALL ON public.access_device_sessions TO service_role;
ALTER TABLE public.access_device_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'access_device_sessions'
       AND policyname = 'service role manages access device sessions'
  ) THEN
    CREATE POLICY "service role manages access device sessions"
      ON public.access_device_sessions FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6) Colunas de controle de acesso usadas no login/trial ---------------------
ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS is_trial                 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_device_fp          text,
  ADD COLUMN IF NOT EXISTS device_limit             integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS active_session_token     text,
  ADD COLUMN IF NOT EXISTS active_session_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS active_session_ip        text,
  ADD COLUMN IF NOT EXISTS active_session_user_agent text,
  ADD COLUMN IF NOT EXISTS last_activity_at         timestamptz,
  ADD COLUMN IF NOT EXISTS manual_expiry_override   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_synced_expires_at timestamptz;

-- 7) Fila de eventos de pagamento (webhooks) ---------------------------------
ALTER TABLE public.payment_webhook_events
  ADD COLUMN IF NOT EXISTS status       text NOT NULL DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS attempts     integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_error   text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS status_token_hash   text,
  ADD COLUMN IF NOT EXISTS email_delivery_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS email_delivery_error text,
  ADD COLUMN IF NOT EXISTS entitlement_status  text NOT NULL DEFAULT 'pending';

-- 8) Bucket do Catálogo em Lote ----------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('catalog-assets', 'catalog-assets', false, 20971520,
        ARRAY['image/png', 'image/jpeg', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- 9) Recarrega o cache de schema do PostgREST (evita "column not found") -----
NOTIFY pgrst, 'reload schema';
