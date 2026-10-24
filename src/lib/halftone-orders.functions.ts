import { createServerFn } from "@tanstack/react-start";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = supabaseAdmin as any;
const BUCKET = "halftone-uploads";

// ===================================================================
// CONFIGURAÇÃO — LINK DO CHECKOUT INFINITEPAY PARA R$ 5
// Crie um link de pagamento de R$ 5,00 (Pix) no painel InfinitePay
// e cole aqui. Enquanto não trocar, mantemos o link genérico (mensal).
// ===================================================================
export const HALFTONE_CHECKOUT_HREF =
  "https://checkout.infinitepay.io/alexsander-63468735-b77/0pSavbkf8O";

const createSchema = z.object({
  customer_name: z.string().trim().min(2).max(80),
  customer_phone: z
    .string()
    .trim()
    .min(10)
    .max(20)
    .regex(/^[\d\s()+-]+$/),
  customer_email: z.string().trim().email().max(255),
  notes: z.string().trim().max(500).optional().default(""),
  image_base64: z.string().min(20).max(28_000_000), // ~20MB base64
  image_mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
  image_name: z.string().trim().min(1).max(200),
});

function genOrderCode() {
  const raw = randomBytes(4).toString("hex").toUpperCase();
  return `HF-${raw}`;
}

function decodeBase64(input: string) {
  const cleaned = input.includes(",") ? input.split(",")[1] : input;
  return Buffer.from(cleaned, "base64");
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

export const createHalftoneOrder = createServerFn({ method: "POST" })
  .inputValidator(createSchema)
  .handler(async ({ data }) => {
    const order_code = genOrderCode();
    const ext = data.image_mime === "image/png" ? "png" : data.image_mime === "image/webp" ? "webp" : "jpg";
    const path = `${order_code}/${Date.now()}-${safeFileName(data.image_name)}.${ext}`;
    const bytes = decodeBase64(data.image_base64);

    if (bytes.byteLength > 20 * 1024 * 1024) {
      throw new Error("Imagem maior que 20MB.");
    }

    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: data.image_mime, upsert: false });
    if (upErr) {
      throw new Error("Falha ao enviar imagem: " + upErr.message);
    }

    const { data: row, error: insErr } = await db
      .from("halftone_orders")
      .insert({
        order_code,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_email: data.customer_email.toLowerCase(),
        image_path: path,
        notes: data.notes || null,
        amount: 5,
        payment_status: "pending",
        delivery_status: "aguardando_pagamento",
      })
      .select("id, order_code")
      .single();

    if (insErr) {
      // tenta limpar a imagem se a inserção falhou
      await db.storage.from(BUCKET).remove([path]).catch(() => {});
      throw new Error("Falha ao registrar pedido.");
    }

    return {
      id: row.id as string,
      order_code: row.order_code as string,
      checkout_url: HALFTONE_CHECKOUT_HREF,
    };
  });

const getOrderSchema = z.object({
  order_code: z.string().trim().min(3).max(20),
});

export const getHalftoneOrderPublic = createServerFn({ method: "GET" })
  .inputValidator(getOrderSchema)
  .handler(async ({ data }) => {
    const { data: row } = await db
      .from("halftone_orders")
      .select("id, order_code, customer_name, customer_phone, payment_status, delivery_status, created_at")
      .eq("order_code", data.order_code.toUpperCase())
      .maybeSingle();
    if (!row) throw new Error("Pedido não encontrado.");
    return row;
  });

// ---------------------- ADMIN ----------------------
import { getCookie } from "@tanstack/react-start/server";
import { createHmac, timingSafeEqual } from "node:crypto";

function readAdminAuthenticated(): boolean {
  const cookie = getCookie("dtflexpro-admin-session");
  if (!cookie) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const [payload, signature] = cookie.split(".");
  if (!payload || !signature) return false;
  try {
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded?.authenticated) return false;
    if (decoded.expiresAt && decoded.expiresAt < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

async function requireAdmin() {
  if (!readAdminAuthenticated()) throw new Error("Não autorizado");
}

export const listHalftoneOrders = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data } = await db
    .from("halftone_orders")
    .select(
      "id, order_code, customer_name, customer_phone, customer_email, notes, amount, payment_status, delivery_status, image_path, infinitepay_transaction_id, paid_at, delivered_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  return { orders: data ?? [] };
});

const orderIdSchema = z.object({ id: z.string().uuid() });

export const getHalftoneImageUrl = createServerFn({ method: "POST" })
  .inputValidator(orderIdSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: row } = await db
      .from("halftone_orders")
      .select("image_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!row?.image_path) throw new Error("Pedido sem imagem.");
    const { data: signed, error } = await db.storage
      .from(BUCKET)
      .createSignedUrl(row.image_path, 60 * 60 * 24);
    if (error || !signed?.signedUrl) throw new Error("Falha ao gerar link.");
    return { url: signed.signedUrl as string };
  });

export const markHalftoneOrderDelivered = createServerFn({ method: "POST" })
  .inputValidator(orderIdSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    await db
      .from("halftone_orders")
      .update({ delivery_status: "enviado", delivered_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });

export const markHalftoneOrderPaidManual = createServerFn({ method: "POST" })
  .inputValidator(orderIdSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    await db
      .from("halftone_orders")
      .update({
        payment_status: "paid",
        delivery_status: "aguardando_envio",
        paid_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return { ok: true };
  });

export const deleteHalftoneOrder = createServerFn({ method: "POST" })
  .inputValidator(orderIdSchema)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: row } = await db
      .from("halftone_orders")
      .select("image_path")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.image_path) {
      await db.storage.from(BUCKET).remove([row.image_path]).catch(() => {});
    }
    await db.from("halftone_orders").delete().eq("id", data.id);
    return { ok: true };
  });
