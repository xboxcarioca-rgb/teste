-- ============================================================================
-- DTFLEXPRO 2410 — Pedidos de acesso (substitui a entrada por código/senha)
--
-- O cliente digita apenas o e-mail. O pedido aparece no painel do administrador,
-- que escolhe o plano e libera. Aprovado, o dispositivo entra sozinho.
--
-- Idempotente: pode rodar quantas vezes quiser, não apaga nada.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.access_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text NOT NULL,
  device_key_hash    text NOT NULL,
  user_agent         text,
  ip                 text,
  status             text NOT NULL DEFAULT 'pending',
                     -- pending | approved | denied | expired
  requested_at       timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  decided_at         timestamptz,
  decided_by         text,
  access_id          uuid REFERENCES public.user_access(id) ON DELETE SET NULL,
  session_token_hash text,
  plan_code          text,
  note               text
);

COMMENT ON TABLE public.access_requests IS
  'Pedidos de liberação de acesso feitos pelo cliente informando apenas o e-mail.';

-- Um pedido pendente por e-mail + dispositivo (evita duplicar ao atualizar a página)
CREATE UNIQUE INDEX IF NOT EXISTS access_requests_pending_unique
  ON public.access_requests (email, device_key_hash)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS access_requests_status_idx
  ON public.access_requests (status, requested_at DESC);

CREATE INDEX IF NOT EXISTS access_requests_email_idx
  ON public.access_requests (email, requested_at DESC);

GRANT ALL ON public.access_requests TO service_role;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Marca como expirados os pedidos que passaram do prazo.
-- Chamada pelo painel antes de listar.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expirar_pedidos()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH upd AS (
    UPDATE public.access_requests
       SET status = 'expired'
     WHERE status = 'pending'
       AND expires_at < now()
    RETURNING 1
  )
  SELECT count(*)::int FROM upd;
$$;

GRANT EXECUTE ON FUNCTION public.expirar_pedidos() TO service_role;
