import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = () => supabaseAdmin as any;

const COOKIE = "dtflexpro-affiliate-session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

function getSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET não configurado");
  return s;
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function safeEq(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return timingSafeEqual(A, B);
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const calc = scryptSync(password, salt, 64).toString("hex");
  return safeEq(calc, hash);
}

interface SessionData {
  affiliateId: string;
  exp: number;
}

function readSession(): SessionData | null {
  const c = getCookie(COOKIE);
  if (!c) return null;
  const [payload, sig] = c.split(".");
  if (!payload || !sig || !safeEq(sig, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionData;
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function writeSession(affiliateId: string) {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = Buffer.from(JSON.stringify({ affiliateId, exp })).toString("base64url");
  setCookie(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: MAX_AGE,
  });
}

async function requireAffiliate() {
  const s = readSession();
  if (!s) throw new Error("não autenticado");
  const { data } = await db()
    .from("affiliates")
    .select("*")
    .eq("id", s.affiliateId)
    .maybeSingle();
  if (!data || data.status !== "active") throw new Error("não autenticado");
  return data;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

const RESERVED_SLUGS = new Set([
  "admin", "app", "login", "afiliado", "afiliados", "r", "api", "auth",
  "logout", "register", "signup", "checkout", "dashboard", "painel",
  "lovable", "validate-access-code", "verify-admin",
]);

async function uniqueSlug(base: string) {
  let slug = slugify(base) || `aff-${randomBytes(3).toString("hex")}`;
  if (RESERVED_SLUGS.has(slug)) slug = `${slug}-1`;
  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const { data } = await db().from("affiliates").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${slug}-${randomBytes(2).toString("hex")}`;
}

const signupSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
  fullName: z.string().trim().min(2).max(120),
  preferredSlug: z.string().trim().max(32).optional(),
  pixKey: z.string().trim().max(200).optional(),
  whatsapp: z.string().trim().max(40).optional(),
});

export const signupAffiliate = createServerFn({ method: "POST" })
  .inputValidator(signupSchema)
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const { data: exists } = await db().from("affiliates").select("id").eq("email", email).maybeSingle();
    if (exists) throw new Error("Já existe um afiliado com esse e-mail.");

    const slug = await uniqueSlug(data.preferredSlug || data.fullName.split(" ")[0] || email.split("@")[0]);
    const password_hash = hashPassword(data.password);

    const { data: inserted, error } = await db()
      .from("affiliates")
      .insert({
        email,
        password_hash,
        full_name: data.fullName,
        slug,
        pix_key: data.pixKey || null,
        whatsapp: data.whatsapp || null,
      })
      .select()
      .single();

    if (error || !inserted) throw new Error("Não foi possível criar o cadastro.");
    writeSession(inserted.id);
    return { ok: true, slug: inserted.slug };
  });

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});

export const loginAffiliate = createServerFn({ method: "POST" })
  .inputValidator(loginSchema)
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const { data: row } = await db().from("affiliates").select("*").eq("email", email).maybeSingle();
    if (!row || row.status !== "active" || !verifyPassword(data.password, row.password_hash)) {
      throw new Error("E-mail ou senha incorretos.");
    }
    await db().from("affiliates").update({ last_login_at: new Date().toISOString() }).eq("id", row.id);
    writeSession(row.id);
    return { ok: true };
  });

export const logoutAffiliate = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(COOKIE, { path: "/" });
  return { ok: true };
});

export const getAffiliateDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const s = readSession();
  if (!s) return { authenticated: false as const };
  const { data: aff } = await db().from("affiliates").select("*").eq("id", s.affiliateId).maybeSingle();
  if (!aff || aff.status !== "active") return { authenticated: false as const };
  const { data: sales } = await db()
    .from("affiliate_sales")
    .select("*")
    .eq("affiliate_id", aff.id)
    .order("created_at", { ascending: false });
  const list = sales ?? [];
  const activated = list.filter((s: any) => s.status === "activated" || s.status === "paid");
  const paid = list.filter((s: any) => s.status === "paid");
  const totalActivated = activated.length;
  const commissionEarned = activated.reduce((acc: number, s: any) => acc + (s.commission_cents ?? 0), 0);
  const commissionPaid = paid.reduce((acc: number, s: any) => acc + (s.commission_cents ?? 0), 0);
  return {
    authenticated: true as const,
    affiliate: {
      id: aff.id,
      email: aff.email,
      full_name: aff.full_name,
      slug: aff.slug,
      pix_key: aff.pix_key,
      whatsapp: aff.whatsapp,
      commission_cents: aff.commission_cents,
      created_at: aff.created_at,
    },
    sales: list,
    metrics: {
      totalSales: list.length,
      pending: list.filter((s: any) => s.status === "pending").length,
      activated: totalActivated,
      paid: paid.length,
      commissionEarnedCents: commissionEarned,
      commissionPaidCents: commissionPaid,
      commissionPendingCents: commissionEarned - commissionPaid,
    },
  };
});

const saleSchema = z.object({
  customerEmail: z.string().trim().email().max(255),
  customerName: z.string().trim().min(2).max(120).optional(),
  customerWhatsapp: z.string().trim().max(40).optional(),
  pixProofNote: z.string().trim().max(500).optional(),
});

export const submitAffiliateSale = createServerFn({ method: "POST" })
  .inputValidator(saleSchema)
  .handler(async ({ data }) => {
    const aff = await requireAffiliate();
    const { data: row, error } = await db()
      .from("affiliate_sales")
      .insert({
        affiliate_id: aff.id,
        customer_email: data.customerEmail.toLowerCase(),
        customer_name: data.customerName || null,
        customer_whatsapp: data.customerWhatsapp || null,
        pix_proof_note: data.pixProofNote || null,
        plan_code: "anual",
        amount_cents: 14700,
        commission_cents: aff.commission_cents ?? 4000,
        status: "pending",
      })
      .select()
      .single();
    if (error || !row) throw new Error("Não foi possível registrar a venda.");
    return { ok: true, sale: row };
  });

export const updateAffiliateProfile = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      pixKey: z.string().trim().max(200).optional(),
      whatsapp: z.string().trim().max(40).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const aff = await requireAffiliate();
    await db()
      .from("affiliates")
      .update({ pix_key: data.pixKey ?? null, whatsapp: data.whatsapp ?? null })
      .eq("id", aff.id);
    return { ok: true };
  });

/* =================== ADMIN-SIDE =================== */

function getAdminCookie() {
  return getCookie("dtflexpro-admin-session");
}

function readAdmin(): { authenticated: boolean } | null {
  const c = getAdminCookie();
  if (!c) return null;
  const [payload, sig] = c.split(".");
  if (!payload || !sig || !safeEq(sig, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as any;
    if (!data.authenticated || Date.now() > data.expiresAt) return null;
    return { authenticated: true };
  } catch {
    return null;
  }
}

function requireAdmin() {
  const s = readAdmin();
  if (!s?.authenticated) throw new Error("Credenciais inválidas");
}

export const getAffiliateAdminData = createServerFn({ method: "GET" }).handler(async () => {
  requireAdmin();
  const [{ data: affiliates }, { data: sales }] = await Promise.all([
    db().from("affiliates").select("*").order("created_at", { ascending: false }),
    db()
      .from("affiliate_sales")
      .select("*, affiliates(email, full_name, slug, pix_key, whatsapp)")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  return {
    affiliates: (affiliates ?? []).map((a: any) => ({
      id: a.id,
      email: a.email,
      full_name: a.full_name,
      slug: a.slug,
      pix_key: a.pix_key,
      whatsapp: a.whatsapp,
      status: a.status,
      commission_cents: a.commission_cents,
      created_at: a.created_at,
      last_login_at: a.last_login_at,
    })),
    sales: sales ?? [],
  };
});

const activateSaleSchema = z.object({
  saleId: z.string().uuid(),
  deviceLimit: z.number().int().min(1).max(20).optional(),
});

function generateAccessCode() {
  return randomBytes(6)
    .toString("base64")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 8);
}

async function sendProvisionalEmailForSale(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const html = `
    <div style="background:#ffffff;padding:32px;font-family:Arial,sans-serif;color:#111827">
      <div style="max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
        <p style="font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:#6b7280;margin:0 0 12px">DTFlexPRO · Plano Anual</p>
        <h1 style="font-size:24px;line-height:1.3;margin:0 0 16px">Bem-vindo(a) ao DTFlexPRO</h1>
        <p style="font-size:15px;line-height:1.7;color:#374151">Sua compra foi confirmada. Use a senha provisória abaixo para entrar com o e-mail da compra.</p>
        <div style="margin:24px 0;padding:18px;border-radius:10px;background:#fef3c7;border:1px solid #fbbf24">
          <p style="font-size:13px;margin:0 0 8px;color:#92400e;text-transform:uppercase;letter-spacing:.12em">Senha provisória</p>
          <div style="font-family:monospace;font-size:26px;letter-spacing:.18em;color:#111827;text-align:center">${code}</div>
        </div>
        <p style="font-size:13px;color:#6b7280">Equipe DTFlexPRO</p>
      </div>
    </div>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "DTFlexPRO <onboarding@resend.dev>",
      to: [email],
      subject: "Bem-vindo(a) ao DTFlexPRO — Senha de acesso (Plano Anual)",
      html,
    }),
  }).catch(() => {});
}

export const activateAffiliateSale = createServerFn({ method: "POST" })
  .inputValidator(activateSaleSchema)
  .handler(async ({ data }) => {
    requireAdmin();
    const { data: sale } = await db()
      .from("affiliate_sales")
      .select("*")
      .eq("id", data.saleId)
      .maybeSingle();
    if (!sale) throw new Error("Venda não encontrada");
    if (sale.status === "activated" || sale.status === "paid") {
      return { ok: true, alreadyActivated: true };
    }

    const accessCode = generateAccessCode();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const { data: access, error: aerr } = await db()
      .from("user_access")
      .insert({
        email: sale.customer_email,
        access_code: accessCode,
        status: "active",
        expires_at: expiresAt,
        plan_code: "anual",
        device_limit: data.deviceLimit ?? 1,
      })
      .select()
      .single();
    if (aerr || !access) throw new Error("Não foi possível liberar o acesso.");

    await db()
      .from("affiliate_sales")
      .update({
        status: "paid",
        user_access_id: access.id,
        activated_at: new Date().toISOString(),
        paid_at: new Date().toISOString(),
      })
      .eq("id", sale.id);

    await sendProvisionalEmailForSale(sale.customer_email, accessCode);

    return { ok: true, accessCode, email: sale.customer_email };
  });

export const markAffiliateSalePaid = createServerFn({ method: "POST" })
  .inputValidator(z.object({ saleId: z.string().uuid(), note: z.string().max(500).optional() }))
  .handler(async ({ data }) => {
    requireAdmin();
    await db()
      .from("affiliate_sales")
      .update({ status: "paid", paid_at: new Date().toISOString(), admin_note: data.note ?? null })
      .eq("id", data.saleId);
    return { ok: true };
  });

export const deleteAffiliateSale = createServerFn({ method: "POST" })
  .inputValidator(z.object({ saleId: z.string().uuid() }))
  .handler(async ({ data }) => {
    requireAdmin();
    await db().from("affiliate_sales").delete().eq("id", data.saleId);
    return { ok: true };
  });

export const lookupAffiliateBySlug = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string().trim().min(1).max(40) }))
  .handler(async ({ data }) => {
    const { data: row } = await db()
      .from("affiliates")
      .select("slug, full_name, status, whatsapp")
      .eq("slug", data.slug.toLowerCase())
      .maybeSingle();
    if (!row || row.status !== "active") return { found: false as const };
    return {
      found: true as const,
      slug: row.slug,
      fullName: row.full_name,
      whatsapp: row.whatsapp ?? null,
    };
  });
