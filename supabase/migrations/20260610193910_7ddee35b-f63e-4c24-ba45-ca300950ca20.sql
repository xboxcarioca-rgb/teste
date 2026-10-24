CREATE TABLE public.halftone_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text NOT NULL,
  image_path text NOT NULL,
  notes text,
  amount numeric(10,2) NOT NULL DEFAULT 5.00,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed')),
  delivery_status text NOT NULL DEFAULT 'aguardando_pagamento' CHECK (delivery_status IN ('aguardando_pagamento','aguardando_envio','enviado')),
  infinitepay_transaction_id text,
  paid_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.halftone_orders TO anon;
GRANT SELECT, INSERT, UPDATE ON public.halftone_orders TO authenticated;
GRANT ALL ON public.halftone_orders TO service_role;

ALTER TABLE public.halftone_orders ENABLE ROW LEVEL SECURITY;

-- Bloqueia tudo via RLS; toda a leitura/escrita passa por server functions com supabaseAdmin.
CREATE POLICY "no public read" ON public.halftone_orders FOR SELECT USING (false);
CREATE POLICY "no public insert" ON public.halftone_orders FOR INSERT WITH CHECK (false);
CREATE POLICY "no public update" ON public.halftone_orders FOR UPDATE USING (false);

CREATE INDEX idx_halftone_orders_created_at ON public.halftone_orders (created_at DESC);
CREATE INDEX idx_halftone_orders_delivery_status ON public.halftone_orders (delivery_status);
CREATE INDEX idx_halftone_orders_infinitepay_txn ON public.halftone_orders (infinitepay_transaction_id);

CREATE TRIGGER halftone_orders_updated_at
  BEFORE UPDATE ON public.halftone_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();