import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  getRequestHeader,
  getRequestIP,
  getRequestUrl,
  setCookie,
  clearSession,
  useSession,
} from "@tanstack/react-start/server";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const genericAdminError = "Credenciais inválidas";
const genericAccessError = "Código inválido ou expirado";
const deviceConflictError =
  "Este acesso já está em uso em outro dispositivo. Apenas 1 dispositivo é permitido por conta. Entre em contato com a plataforma pelo WhatsApp.";

const adminPasswordSchema = z.object({
  password: z.string().trim().min(1).max(255),
});

const accessCodeSchema = z.object({
  email: z.string().trim().email().max(255),
  code: z.string().trim().min(6).max(32),
});

const revokeSchema = z.object({
  accessId: z.string().uuid(),
});

const deleteSchema = z.object({
  accessId: z.string().uuid(),
});

const deviceLimitSchema = z.object({
  accessId: z.string().uuid(),
  deviceLimit: z.number().int().min(1).max(20),
});

const manualAccessSchema = z.object({
  email: z.string().trim().email().max(255),
  planCode: z.enum(["mensal", "anual", "vitalicia"]),
  durationDays: z.number().int().min(1).max(36500).optional(),
  deviceLimit: z.number().int().min(1).max(20).optional(),
});

const trialSignupSchema = z.object({
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(8).max(32),
  deviceFp: z.string().trim().min(8).max(2048),
});

const activateTrialSchema = z.object({
  accessId: z.string().uuid(),
  planCode: z.enum(["mensal", "anual", "vitalicia"]),
  durationDays: z.number().int().min(1).max(36500).optional(),
});

const provisionalAccessSchema = z.object({
  email: z.string().trim().email().max(255),
  planCode: z.enum(["mensal", "anual", "vitalicia"]),
  deviceLimit: z.number().int().min(1).max(20).optional(),
});


interface AdminSessionData {
  authenticated: boolean;
  loggedAt: string;
}

interface AccessSessionData {
  authenticated: boolean;
  email: string;
  code: string;
  accessId: string;
  sessionToken: string;
  expiresAt: string;
}

const adminCookieName = "dtflexpro-admin-session";
const adminSessionMaxAge = 60 * 60 * 8;


interface SignedAdminSessionData extends AdminSessionData {
  expiresAt: number;
}

function getDb() {
  return supabaseAdmin as any;
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Configuração de sessão indisponível");
  }
  return secret;
}

function getAdminSessionConfig() {
  return {
    password: getSessionSecret(),
    name: "dtflexpro-admin-session",
    maxAge: 60 * 60 * 8,
    cookie: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  };
}

function getAccessSessionConfig() {
  return {
    password: getSessionSecret(),
    name: "dtflexpro-access-session",
    // "Lembrar pra sempre nesse navegador" — sessão dura ~10 anos
    // (efetivamente até a pessoa limpar cookies / sair manualmente).
    maxAge: 60 * 60 * 24 * 365 * 10,
    cookie: {
      httpOnly: true,
      sameSite: "none" as const,
      secure: true,
      path: "/",
    },
  };
}

function signAdminPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function readSignedAdminSession(): AdminSessionData | null {
  const cookie = getCookie(adminCookieName);
  if (!cookie) return null;

  const [payload, signature] = cookie.split(".");
  if (!payload || !signature || !safeEqual(signature, signAdminPayload(payload))) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SignedAdminSessionData;
    if (!data.authenticated || !data.loggedAt || Date.now() > data.expiresAt) return null;
    return { authenticated: true, loggedAt: data.loggedAt };
  } catch {
    return null;
  }
}

function writeSignedAdminSession() {
  const loggedAt = new Date().toISOString();
  const payload = Buffer.from(
    JSON.stringify({
      authenticated: true,
      loggedAt,
      expiresAt: Date.now() + adminSessionMaxAge * 1000,
    } satisfies SignedAdminSessionData),
  ).toString("base64url");

  setCookie(adminCookieName, `${payload}.${signAdminPayload(payload)}`, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: adminSessionMaxAge,
  });

  return { authenticated: true, loggedAt };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeCode(code: string) {
  // Remove espaços, hífens e qualquer caractere não alfanumérico; força maiúsculas.
  return code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}


function safeEqual(input: string, expected: string) {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isConfiguredAdminPassword(input: string) {
  const expectedPassword = process.env.ADMIN_MASTER_PASSWORD;
  if (!expectedPassword) {
    throw new Error("ADMIN_MASTER_PASSWORD não configurado");
  }
  return safeEqual(input, expectedPassword);
}

function generateAccessCode() {
  return randomBytes(6)
    .toString("base64")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 8);
}

async function sendAccessEmail({
  email,
  accessCode,
  expiresAt,
  planLabel,
}: {
  email: string;
  accessCode: string;
  expiresAt: string;
  planLabel: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("missing_resend_key");
  }

  const baseUrl = process.env.APP_URL ?? process.env.URL ?? new URL(getRequestUrl()).origin;
  const accessUrl = `${baseUrl}/login?email=${encodeURIComponent(email)}&code=${encodeURIComponent(accessCode)}`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "DTFLEXPRO <onboarding@resend.dev>",
      to: [email],
      subject: "🔓 Seu acesso à plataforma está liberado!",
      html: `
        <div style="background:#ffffff;padding:32px;font-family:Arial,sans-serif;color:#111827">
          <div style="max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
            <p style="font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:#6b7280;margin:0 0 12px">DTFLEXPRO · ${planLabel}</p>
            <h1 style="font-size:28px;line-height:1.2;margin:0 0 16px">Seu acesso à plataforma está liberado</h1>
            <p style="font-size:15px;line-height:1.7;color:#4b5563;margin:0 0 16px">Seu código de acesso já está ativo.</p>
            <div style="margin:24px 0;padding:20px;border-radius:10px;background:#111827;color:#f9fafb;text-align:center;font-family:monospace;font-size:30px;letter-spacing:.18em">${accessCode}</div>
            <p style="font-size:14px;line-height:1.7;color:#4b5563;margin:0 0 20px">Use esse código com o e-mail da compra para entrar na plataforma. Importante: o acesso é vinculado a 1 dispositivo por vez.</p>
            <a href="${accessUrl}" style="display:inline-block;background:#f2c94c;color:#111827;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:700">Acessar Plataforma</a>
            <p style="font-size:13px;line-height:1.7;color:#6b7280;margin:24px 0 0">Validade até: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(expiresAt))}</p>
          </div>
        </div>
      `,
    }),
  });
}

async function logSecurity(eventType: string, success: boolean) {
  const db = getDb();
  const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
  const userAgent = getRequestHeader("user-agent") ?? "unknown";

  await db.from("security_logs").insert({
    event_type: eventType,
    ip,
    user_agent: userAgent,
    success,
  });
}

async function logDeviceConflict(email: string, accessId: string) {
  const db = getDb();
  const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
  const userAgent = getRequestHeader("user-agent") ?? "unknown";
  await db.from("audit_logs").insert({
    event_type: "access_device_conflict",
    ip_address: ip,
    user_agent: userAgent,
    metadata: { email, access_id: accessId, attempted_at: new Date().toISOString() },
  });
}

async function notifyOwnerOfConflict(email: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const ip = getRequestIP({ xForwardedFor: true }) ?? "desconhecido";
  const userAgent = getRequestHeader("user-agent") ?? "desconhecido";
  const when = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "DTFLEXPRO <onboarding@resend.dev>",
        to: [email],
        subject: "⚠️ Tentativa de acesso em outro dispositivo",
        html: `
          <div style="background:#fff;padding:32px;font-family:Arial,sans-serif;color:#111827">
            <div style="max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
              <h1 style="font-size:22px;margin:0 0 12px">Alguém tentou usar seu acesso em outro dispositivo</h1>
              <p style="font-size:14px;color:#4b5563;line-height:1.7">O acesso foi <strong>bloqueado</strong> automaticamente porque seu plano permite apenas 1 dispositivo.</p>
              <ul style="font-size:13px;color:#4b5563;line-height:1.8;padding-left:18px">
                <li>Quando: ${when}</li>
                <li>IP: ${ip}</li>
                <li>Dispositivo: ${userAgent}</li>
              </ul>
              <p style="font-size:13px;color:#6b7280;margin-top:16px">Se foi você, ignore este e-mail. Se não foi, fale com a DTFLEXPRO no WhatsApp.</p>
            </div>
          </div>
        `,
      }),
    });
  } catch {
    /* best-effort */
  }
}

async function requireAdminSession() {
  const session = readSignedAdminSession();
  if (!session?.authenticated) {
    throw new Error(genericAdminError);
  }
  return session;
}

function planDurationDays(planCode: string) {
  if (planCode === "anual") return 365;
  if (planCode === "vitalicia") return 36500; // ~100 anos = vitalícia
  return 30;
}

function planLabel(planCode: string) {
  if (planCode === "anual") return "Plano Anual";
  if (planCode === "vitalicia") return "Plano Vitalício";
  return "Plano Mensal";
}

function refreshedExpiresAt(row: { expires_at?: string | null; plan_code?: string | null }) {
  const current = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (current > Date.now()) return row.expires_at!;
  const days = planDurationDays(row.plan_code ?? "mensal");
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}


export const getAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  const session = readSignedAdminSession();
  return {
    authenticated: Boolean(session?.authenticated),
    loggedAt: session?.loggedAt ?? null,
  };
});

export const verifyAdminPassword = createServerFn({ method: "POST" })
  .inputValidator(adminPasswordSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    if (isConfiguredAdminPassword(data.password)) {
      writeSignedAdminSession();
      await logSecurity("admin_login_attempt", true);
      return { ok: true };
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count } = await db
      .from("security_logs")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "admin_login_attempt")
      .eq("ip", ip)
      .eq("success", false)
      .gte("created_at", oneHourAgo);

    if ((count ?? 0) >= 5) {
      await logSecurity("admin_login_rate_limited", false);
      return { ok: false };
    }

    await logSecurity("admin_login_attempt", false);
    return { ok: false };
  });

export const logoutAdminSession = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(adminCookieName, { path: "/" });
  return { ok: true };
});

export const validateAccessCode = createServerFn({ method: "POST" })
  .inputValidator(accessCodeSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const email = normalizeEmail(data.email);
    const code = normalizeCode(data.code);

    // Não filtra por expires_at nem por status: códigos vencidos OU revogados ainda validam.
    // O painel do cliente mostra o aviso de expiração e pede para contatar o admin para renovar.
    // Se o código existir para este e-mail (em qualquer status), libera o acesso.
    const { data: accessRow } = await db
      .from("user_access")
      .select("id, email, access_code, expires_at, status, plan_code, device_limit, active_session_token, active_session_started_at, active_session_ip, active_session_user_agent")
      .eq("email", email)
      .eq("access_code", code)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!accessRow) {
      await logSecurity("access_code_validation", false);
      return { ok: false, error: genericAccessError };
    }

    // Conta excluída pelo admin (plano vencido não renovado) — mostra convite de renovação
    if (accessRow.status === "deleted") {
      await logSecurity("access_code_deleted", false);
      return {
        ok: false,
        expired: true,
        error: "Sua conta foi encerrada. Vamos renovar? Entre em contato com o administrador pelo WhatsApp.",
      };
    }

    // Conta revogada pelo admin — bloqueia login e exige reativação explícita via fluxo próprio
    if (accessRow.status === "revoked") {
      await logSecurity("access_code_revoked", false);
      return {
        ok: false,
        revoked: true,
        error: "Seu acesso foi revogado pelo administrador. Use a opção de reativação ou fale com o suporte.",
      };
    }

    // Bloqueia acesso expirado — só admin pode renovar
    if (accessRow.expires_at && new Date(accessRow.expires_at).getTime() <= Date.now()) {
      await logSecurity("access_code_expired", false);
      return {
        ok: false,
        expired: true,
        error: "Seu acesso expirou. Entre em contato com o administrador pelo WhatsApp para renovar.",
      };
    }






    // Controle de sessão única por dispositivo
    // Regra: abrir várias abas / re-logar no MESMO navegador (mesmo IP) NÃO é outro dispositivo.
    // Só bloqueia quando o IP de origem é diferente do IP da sessão ativa.
    const currentIp = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    const currentUa = getRequestHeader("user-agent") ?? "unknown";
    const deviceLimit = accessRow.device_limit ?? 1;
    if (deviceLimit <= 1 && accessRow.active_session_token) {
      const startedAt = accessRow.active_session_started_at
        ? new Date(accessRow.active_session_started_at).getTime()
        : 0;
      const sessionMaxAgeMs = 30 * 24 * 60 * 60 * 1000;
      const sessionStillFresh = Date.now() - startedAt < sessionMaxAgeMs;
      const sameIp = accessRow.active_session_ip && accessRow.active_session_ip === currentIp;
      // Só bloqueia se a sessão é recente E o IP é diferente do registrado.
      // Sem IP registrado (sessões antigas) ou mesmo IP → libera (várias abas / re-login no mesmo navegador).
      if (sessionStillFresh && accessRow.active_session_ip && !sameIp) {
        await logSecurity("access_device_conflict", false);
        await logDeviceConflict(email, accessRow.id);
        notifyOwnerOfConflict(email).catch(() => {});
        return { ok: false, error: deviceConflictError };
      }
    }

    const sessionToken = randomUUID();
    const expiresAt = refreshedExpiresAt(accessRow);
    const { error: updateError } = await db
      .from("user_access")
      .update({
        status: "active",
        expires_at: expiresAt,
        active_session_token: sessionToken,
        active_session_started_at: new Date().toISOString(),
        active_session_ip: currentIp,
        active_session_user_agent: currentUa,
      })
      .eq("id", accessRow.id);

    if (updateError) {
      await logSecurity("access_code_validation", false);
      return { ok: false, error: genericAccessError };
    }

    const session = await useSession<AccessSessionData>(getAccessSessionConfig());
    await session.update({
      authenticated: true,
      email,
      code,
      accessId: accessRow.id,
      sessionToken,
      expiresAt,
    });

    await logSecurity("access_code_validation", true);
    return { ok: true, redirectTo: "/app" };
  });

export const getAccessSession = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<AccessSessionData>(getAccessSessionConfig());
  const expiresAt = session.data?.expiresAt;
  const accessId = session.data?.accessId;
  const sessionToken = session.data?.sessionToken;

  const baseValid = Boolean(session.data?.authenticated && expiresAt);

  if (!baseValid || !accessId || !sessionToken) {
    return { authenticated: false, email: null, expiresAt: null };
  }

  // Revalida que esta sessão ainda é a "ativa" no banco.
  // Não bloqueia por expires_at: códigos vencidos continuam logados; o painel exibe aviso.
  const db = getDb();
  const { data: row } = await db
    .from("user_access")
    .select("active_session_token, status, expires_at, is_trial")
    .eq("id", accessId)
    .maybeSingle();

  const stillActive =
    row &&
    row.status !== "deleted" &&
    row.status !== "revoked" &&
    row.active_session_token === sessionToken;


  if (!stillActive) {
    await clearSession(getAccessSessionConfig());
    return { authenticated: false, email: null, expiresAt: null };
  }

  // Se o plano expirou, encerra a sessão e força renovação pelo admin
  if (row?.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    await clearSession(getAccessSessionConfig());
    return { authenticated: false, email: session.data?.email ?? null, expiresAt: row.expires_at, expired: true };
  }

  return {
    authenticated: true,
    email: session.data?.email ?? null,
    expiresAt: expiresAt ?? null,
    isTrial: Boolean(row?.is_trial),
  };
});


export const logoutAccessSession = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AccessSessionData>(getAccessSessionConfig());
  const accessId = session.data?.accessId;
  const sessionToken = session.data?.sessionToken;

  if (accessId && sessionToken) {
    const db = getDb();
    // Só limpa se ainda for esta sessão a dona do token
    await db
      .from("user_access")
      .update({ active_session_token: null, active_session_started_at: null })
      .eq("id", accessId)
      .eq("active_session_token", sessionToken);
  }

  await clearSession(getAccessSessionConfig());
  return { ok: true };
});

export const getAdminDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const db = getDb();

  const [{ data: codes }, { data: payments }, { data: logs }, { data: attempts }, { data: affiliateSales }] = await Promise.all([
    db
      .from("user_access")
      .select(
        "id, email, phone, access_code, status, expires_at, created_at, plan_code, device_limit, is_trial, trial_device_fp, active_session_token, active_session_started_at, active_session_ip, active_session_user_agent, last_activity_at",
      )
      .order("created_at", { ascending: false })
      .limit(400),
    db
      .from("payments")
      .select("id, email, stripe_session_id, amount, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("security_logs")
      .select("id, event_type, ip, user_agent, success, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("audit_logs")
      .select("id, event_type, ip_address, user_agent, metadata, created_at")
      .eq("event_type", "access_device_conflict")
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("affiliate_sales")
      .select("id, affiliate_id, user_access_id, customer_email, status, commission_cents, affiliates(full_name, slug)")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  // Métricas: total de clientes únicos e vendas por mês (últimos 12 meses)
  // Remove contas excluídas e deduplica por e-mail (mantém a linha mais recente)
  const seenEmails = new Set<string>();
  const allCodes = (codes ?? []).filter((c: any) => {
    if (c.status === "deleted") return false;
    const key = String(c.email ?? "").trim().toLowerCase();
    if (seenEmails.has(key)) return false;
    seenEmails.add(key);
    return true;
  });
  const uniqueEmails = new Set(allCodes.map((c: any) => c.email));

  const monthly: Record<string, { mensal: number; anual: number; total: number }> = {};
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthly[key] = { mensal: 0, anual: 0, total: 0 };
  }
  for (const c of allCodes) {
    const d = new Date(c.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthly[key]) {
      monthly[key].total += 1;
      if (c.plan_code === "anual") monthly[key].anual += 1;
      else if (c.plan_code === "mensal") monthly[key].mensal += 1;
    }
  }

  const affiliateSalesMap: Record<string, any> = {};
  for (const s of (affiliateSales ?? []) as any[]) {
    if (s.user_access_id) affiliateSalesMap[s.user_access_id] = s;
  }

  return {
    codes: allCodes.map((c: any) => ({
      ...c,
      affiliate_sale: affiliateSalesMap[c.id] || null,
    })),
    payments: payments ?? [],
    logs: logs ?? [],
    deviceAttempts: (attempts ?? []).map((a: any) => ({
      id: a.id,
      email: a.metadata?.email ?? "-",
      ip: a.ip_address ?? "-",
      user_agent: a.user_agent ?? "-",
      created_at: a.created_at,
    })),
    metrics: {
      totalCodes: allCodes.length,
      activeCodes: allCodes.filter((c: any) => c.status === "active").length,
      uniqueClients: uniqueEmails.size,
      monthly: Object.entries(monthly).map(([month, v]) => ({ month, ...v })),
    },
  };
});

const setExpirySchema = z.object({
  accessId: z.string().uuid(),
  expiresAt: z.string().min(8).max(40),
  planCode: z.enum(["mensal", "anual", "teste"]).optional(),
});

/** Admin define manualmente a data de validade do plano do cliente. */
export const setAccessExpiry = createServerFn({ method: "POST" })
  .inputValidator(setExpirySchema)
  .handler(async ({ data }) => {
    await requireAdminSession();
    const db = getDb();

    const parsed = new Date(
      data.expiresAt.length <= 10 ? `${data.expiresAt}T23:59:59` : data.expiresAt,
    );
    if (Number.isNaN(parsed.getTime())) throw new Error("Data inválida");

    const update: Record<string, any> = {
      expires_at: parsed.toISOString(),
      status: "active",
    };
    if (data.planCode) {
      update.plan_code = data.planCode;
      update.is_trial = data.planCode === "teste";
    }

    const { error } = await db.from("user_access").update(update).eq("id", data.accessId);
    if (error) throw new Error("Não foi possível atualizar a data de validade");

    await logSecurity("admin_set_expiry", true);
    return { ok: true, expiresAt: parsed.toISOString() };
  });

export const revokeAccess = createServerFn({ method: "POST" })

  .inputValidator(revokeSchema)
  .handler(async ({ data }) => {
    await requireAdminSession();
    const db = getDb();

    const { error } = await db
      .from("user_access")
      .update({
        status: "revoked",
        active_session_token: null,
        active_session_started_at: null,
      })
      .eq("id", data.accessId);

    if (error) {
      throw new Error("Não foi possível revogar o acesso");
    }

    await logSecurity("admin_revoke_access", true);
    return { ok: true };
  });

export const deleteAccess = createServerFn({ method: "POST" })
  .inputValidator(deleteSchema)
  .handler(async ({ data }) => {
    await requireAdminSession();
    const db = getDb();

    // Descobre o e-mail para apagar TODAS as linhas duplicadas do mesmo cliente
    const { data: row } = await db
      .from("user_access")
      .select("email")
      .eq("id", data.accessId)
      .maybeSingle();

    const patch = {
      status: "deleted",
      active_session_token: null,
      active_session_started_at: null,
      active_session_ip: null,
      active_session_user_agent: null,
    };

    // Soft-delete: mantém o registro para bloquear futuros logins com mensagem de renovação
    const query = row?.email
      ? db.from("user_access").update(patch).eq("email", row.email)
      : db.from("user_access").update(patch).eq("id", data.accessId);

    const { error } = await query;
    if (error) throw new Error("Não foi possível excluir a conta");

    await logSecurity("admin_delete_access", true);
    return { ok: true };
  });


export const updateDeviceLimit = createServerFn({ method: "POST" })
  .inputValidator(deviceLimitSchema)
  .handler(async ({ data }) => {
    await requireAdminSession();
    const db = getDb();

    const update: Record<string, any> = { device_limit: data.deviceLimit };
    // Ao aumentar o limite, libera a sessão presa para o cliente entrar de novo
    if (data.deviceLimit > 1) {
      update.active_session_token = null;
      update.active_session_started_at = null;
    }

    const { error } = await db.from("user_access").update(update).eq("id", data.accessId);
    if (error) throw new Error("Não foi possível atualizar o limite de dispositivos");

    await logSecurity("admin_update_device_limit", true);
    return { ok: true };
  });

export const resetActiveSession = createServerFn({ method: "POST" })
  .inputValidator(revokeSchema)
  .handler(async ({ data }) => {
    await requireAdminSession();
    const db = getDb();
    const { data: row } = await db
      .from("user_access")
      .select("email")
      .eq("id", data.accessId)
      .maybeSingle();

    if (!row) throw new Error("Acesso não encontrado");

    const { error } = await db
      .from("user_access")
      .update({ active_session_token: null, active_session_started_at: null, active_session_ip: null, active_session_user_agent: null })
      .eq("email", row.email);
    if (error) throw new Error("Não foi possível liberar a sessão");
    await logSecurity("admin_reset_session", true);
    return { ok: true };
  });

export const regenerateAccessCode = createServerFn({ method: "POST" })
  .inputValidator(revokeSchema)
  .handler(async ({ data }) => {
    await requireAdminSession();
    const db = getDb();

    // Gera um código novo SEM invalidar o código antigo.
    // Isso evita o erro "código inválido ou expirado" quando o cliente usa o código anterior.
    const { data: row, error: readError } = await db
      .from("user_access")
      .select("id, email, expires_at, plan_code, device_limit")
      .eq("id", data.accessId)
      .maybeSingle();

    if (readError || !row) {
      throw new Error("Conta não encontrada");
    }

    const newCode = generateAccessCode();
    const expiresAt = refreshedExpiresAt(row);
    // Atualiza a MESMA linha para refletir o novo código no painel admin.
    // Limpa sessão ativa para que o cliente possa entrar imediatamente com o novo código.
    const { error } = await db
      .from("user_access")
      .update({
        access_code: newCode,
        status: "active",
        expires_at: expiresAt,
        active_session_token: null,
        active_session_started_at: null,
        active_session_ip: null,
        active_session_user_agent: null,
      })
      .eq("id", data.accessId);

    if (error) {
      throw new Error("Não foi possível atualizar o código");
    }


    try {
      await sendAccessEmail({
        email: row.email,
        accessCode: newCode,
        expiresAt,
        planLabel: planLabel((row.plan_code as any) ?? "mensal"),
      });
    } catch {
      await logSecurity("regenerate_access_email_error", false);
    }

    await logSecurity("admin_regenerate_code", true);
    return { ok: true, accessCode: newCode };
  });


export const generateManualAccessCode = createServerFn({ method: "POST" })
  .inputValidator(manualAccessSchema)
  .handler(async ({ data }) => {
    await requireAdminSession();
    const db = getDb();
    const email = normalizeEmail(data.email);
    const accessCode = generateAccessCode();
    const days = data.durationDays ?? planDurationDays(data.planCode);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await db.from("user_access").insert({
      email,
      access_code: accessCode,
      status: "active",
      expires_at: expiresAt,
      plan_code: data.planCode,
      device_limit: data.deviceLimit ?? 1,
    });

    if (error) {
      throw new Error("Não foi possível gerar o código manual");
    }

    try {
      await sendAccessEmail({
        email,
        accessCode,
        expiresAt,
        planLabel: planLabel(data.planCode),
      });
    } catch {
      await logSecurity("manual_access_email_error", false);
    }

    await logSecurity("manual_access_generated", true);
    return { email, accessCode, expiresAt, planCode: data.planCode };
  });

async function sendProvisionalEmail({
  email,
  provisionalPassword,
  planLabel: planName,
}: {
  email: string;
  provisionalPassword: string;
  planLabel: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("missing_resend_key");

  const html = `
    <div style="background:#ffffff;padding:32px;font-family:Arial,sans-serif;color:#111827">
      <div style="max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
        <p style="font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:#6b7280;margin:0 0 12px">DTFlexPRO · ${planName}</p>
        <h1 style="font-size:24px;line-height:1.3;margin:0 0 16px">Bem-vindo(a) ao DTFlexPRO</h1>
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 14px">Olá,</p>
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 14px">Muito obrigado por adquirir o nosso Sistema de Geração de Halftone Automático <strong>DTFlexPRO</strong>.</p>
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 14px">Sua compra foi confirmada com sucesso e agora você tem acesso a uma solução avançada desenvolvida para automatizar a criação de efeitos halftone profissionais com máxima qualidade, precisão e velocidade para estampas DTF.</p>
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 14px">O DTFlexPRO foi criado para facilitar seu fluxo de trabalho e elevar o nível das suas artes, entregando resultados profissionais de forma automática e inteligente.</p>
        <div style="margin:24px 0;padding:18px;border-radius:10px;background:#fef3c7;border:1px solid #fbbf24">
          <p style="font-size:13px;margin:0 0 8px;color:#92400e;text-transform:uppercase;letter-spacing:.12em">Senha provisória de acesso</p>
          <div style="font-family:monospace;font-size:26px;letter-spacing:.18em;color:#111827;text-align:center;margin:8px 0">${provisionalPassword}</div>
          <p style="font-size:12px;color:#92400e;margin:8px 0 0">Use esta senha junto com o e-mail da compra para entrar. Em seguida, nossa equipe enviará a sua senha definitiva conforme o plano contratado.</p>
        </div>
        <p style="font-size:14px;line-height:1.7;color:#4b5563;margin:0 0 14px"><strong>Importante:</strong> seu plano permite o uso em <strong>1 dispositivo</strong>. Acessos em outros dispositivos serão bloqueados automaticamente.</p>
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 14px">Caso tenha qualquer dúvida, suporte técnico ou precise de ajuda durante o uso do sistema, nossa equipe estará pronta para ajudar você.</p>
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 14px">Agradecemos pela confiança no DTFlexPRO e desejamos muito sucesso nas suas criações.</p>
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:24px 0 0">Atenciosamente,<br/><strong>Equipe DTFlexPRO</strong></p>
      </div>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "DTFlexPRO <onboarding@resend.dev>",
      to: [email],
      subject: "Bem-vindo(a) ao DTFlexPRO — Senha provisória de acesso",
      html,
    }),
  });
}

export const registerProvisionalAccess = createServerFn({ method: "POST" })
  .inputValidator(provisionalAccessSchema)
  .handler(async ({ data }) => {
    await requireAdminSession();
    const db = getDb();
    const email = normalizeEmail(data.email);
    const provisionalPassword = generateAccessCode();
    // senha provisória curta — 7 dias — só vale até o admin liberar a definitiva
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await db.from("user_access").insert({
      email,
      access_code: provisionalPassword,
      status: "active",
      expires_at: expiresAt,
      plan_code: data.planCode,
      device_limit: data.deviceLimit ?? 1,
    });

    if (error) {
      throw new Error("Não foi possível registrar a compra");
    }

    try {
      await sendProvisionalEmail({
        email,
        provisionalPassword,
        planLabel: planLabel(data.planCode),
      });
    } catch {
      await logSecurity("provisional_access_email_error", false);
    }

    await logSecurity("provisional_access_generated", true);
    return { email, provisionalPassword, expiresAt, planCode: data.planCode };
  });

export const releaseOwnDeviceSession = createServerFn({ method: "POST" })
  .inputValidator(accessCodeSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const email = normalizeEmail(data.email);
    const code = normalizeCode(data.code);

    const { data: accessRow } = await db
      .from("user_access")
      .select("id, device_limit, expires_at, plan_code")
      .eq("email", email)
      .eq("access_code", code)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!accessRow) {
      return { ok: false, error: genericAccessError };
    }

    await db
      .from("user_access")
      .update({ status: "active", expires_at: refreshedExpiresAt(accessRow), active_session_token: null, active_session_started_at: null, active_session_ip: null, active_session_user_agent: null })
      .eq("id", accessRow.id);

    await logSecurity("access_self_release", true);
    return { ok: true };
  });

export const pingAccessSession = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AccessSessionData>(getAccessSessionConfig());
  const accessId = session.data?.accessId;
  const sessionToken = session.data?.sessionToken;
  if (!accessId || !sessionToken) return { ok: false };
  const db = getDb();
  await db
    .from("user_access")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", accessId)
    .eq("active_session_token", sessionToken);
  return { ok: true };
});

export const reactivateOwnAccess = createServerFn({ method: "POST" })
  .inputValidator(accessCodeSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const email = normalizeEmail(data.email);
    const code = normalizeCode(data.code);

    const { data: row } = await db
      .from("user_access")
      .select("id, expires_at, plan_code")
      .eq("email", email)
      .eq("access_code", code)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) {
      return { ok: false, error: "Nenhum acesso revogado encontrado para esse e-mail e código." };
    }

    await db
      .from("user_access")
      .update({
        status: "active",
        expires_at: refreshedExpiresAt(row),
        device_limit: 1,
        active_session_token: null,
        active_session_started_at: null,
        active_session_ip: null,
        active_session_user_agent: null,
      })
      .eq("id", row.id);

    await logSecurity("access_self_reactivate", true);
    return { ok: true };
  });

const deviceWarningSchema = z.object({
  accessId: z.string().uuid(),
  kind: z.enum(["warning", "allow", "remove", "add"]),
  customMessage: z.string().trim().max(2000).optional(),
});

export const sendDeviceWarning = createServerFn({ method: "POST" })
  .inputValidator(deviceWarningSchema)
  .handler(async ({ data }) => {
    await requireAdminSession();
    const db = getDb();
    const apiKey = process.env.RESEND_API_KEY;

    const { data: row } = await db
      .from("user_access")
      .select("id, email, device_limit, expires_at, plan_code, active_session_ip, active_session_user_agent, active_session_started_at")
      .eq("id", data.accessId)
      .maybeSingle();

    if (!row) throw new Error("Acesso não encontrado");

    if (data.kind === "allow" || data.kind === "remove") {
      const renewedExpiresAt = refreshedExpiresAt(row);
      await db
        .from("user_access")
        .update({
          active_session_token: null,
          active_session_started_at: null,
          active_session_ip: null,
          active_session_user_agent: null,
        })
        .eq("email", row.email);

      await db
        .from("user_access")
        .update({
          status: "active",
          expires_at: renewedExpiresAt,
        })
        .eq("id", data.accessId);
    }

    const subjects: Record<string, string> = {
      warning: "⚠️ Aviso de uso de dispositivo - DTFLEXPRO",
      allow: "✅ Novo dispositivo liberado - DTFLEXPRO",
      remove: "🚫 Dispositivo removido - DTFLEXPRO",
      add: "➕ Slot de dispositivo adicionado - DTFLEXPRO",
    };

    const headlines: Record<string, string> = {
      warning: "Detectamos uso da sua conta em outro dispositivo",
      allow: "Liberamos o acesso para o seu novo dispositivo",
      remove: "Um dispositivo foi removido da sua conta",
      add: "Adicionamos um slot extra de dispositivo",
    };

    const bodies: Record<string, string> = {
      warning: "Identificamos uma tentativa de uso da sua conta em um dispositivo diferente do habitual. Se foi você, ignore este e-mail. Caso contrário, entre em contato com o suporte imediatamente.",
      allow: "O acesso ao seu novo dispositivo foi liberado pelo administrador. Você já pode entrar normalmente.",
      remove: "O dispositivo ativo foi removido pelo administrador. Para voltar a usar a plataforma, faça login novamente em um único dispositivo.",
      add: `O administrador aumentou o limite de dispositivos da sua conta. Limite atual: ${row.device_limit ?? 1}.`,
    };

    if (apiKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "DTFLEXPRO <onboarding@resend.dev>",
            to: [row.email],
            subject: subjects[data.kind],
            html: `
              <div style="background:#fff;padding:32px;font-family:Arial,sans-serif;color:#111827">
                <div style="max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
                  <h1 style="font-size:22px;margin:0 0 12px">${headlines[data.kind]}</h1>
                  <p style="font-size:14px;color:#4b5563;line-height:1.7">${bodies[data.kind]}</p>
                  ${data.customMessage ? `<p style="font-size:14px;color:#111827;line-height:1.7;margin-top:16px;padding:12px;border-left:3px solid #f2c94c;background:#fffbeb">${data.customMessage}</p>` : ""}
                  <p style="font-size:12px;color:#6b7280;margin-top:24px">Equipe DTFLEXPRO</p>
                </div>
              </div>
            `,
          }),
        });
      } catch {
        /* best-effort */
      }
    }

    await db.from("audit_logs").insert({
      event_type: `admin_device_${data.kind}`,
      metadata: { email: row.email, access_id: row.id, custom: data.customMessage ?? null },
    });

    await logSecurity(`admin_device_${data.kind}`, true);
    return { ok: true };
  });

// ============ Teste grátis 7 dias ============
async function sendTrialWelcomeEmail({ email, accessCode, expiresAt }: { email: string; accessCode: string; expiresAt: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const baseUrl = process.env.APP_URL ?? process.env.URL ?? new URL(getRequestUrl()).origin;
  const accessUrl = `${baseUrl}/login?email=${encodeURIComponent(email)}&code=${encodeURIComponent(accessCode)}`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "DTFLEXPRO <onboarding@resend.dev>",
        to: [email],
        subject: "🎁 Seu teste grátis de 7 dias no DTFLEXPRO",
        html: `
          <div style="background:#fff;padding:32px;font-family:Arial,sans-serif;color:#111827">
            <div style="max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
              <p style="font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:#6b7280;margin:0 0 12px">DTFLEXPRO · Teste grátis</p>
              <h1 style="font-size:26px;line-height:1.2;margin:0 0 16px">Você tem 7 dias grátis!</h1>
              <p style="font-size:15px;line-height:1.7;color:#4b5563;margin:0 0 16px">Aproveite todos os recursos da plataforma. Após 7 dias, escolha um plano para continuar usando.</p>
              <div style="margin:20px 0;padding:20px;border-radius:10px;background:#111827;color:#f9fafb;text-align:center;font-family:monospace;font-size:28px;letter-spacing:.18em">${accessCode}</div>
              <a href="${accessUrl}" style="display:inline-block;background:#f2c94c;color:#111827;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:700">Acessar Plataforma</a>
              <p style="font-size:12px;color:#6b7280;margin:20px 0 0">Válido até: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(expiresAt))}</p>
            </div>
          </div>
        `,
      }),
    });
  } catch { /* best-effort */ }
}

export const registerTrialAccess = createServerFn({ method: "POST" })
  .inputValidator(trialSignupSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const email = normalizeEmail(data.email);
    const phone = data.phone.replace(/[^\d+]/g, "");
    const currentIp = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    const currentUa = getRequestHeader("user-agent") ?? "unknown";
    // Fingerprint combina impressão do navegador com IP para dificultar burlas
    const deviceFp = createHmac("sha256", getSessionSecret())
      .update(`${data.deviceFp}|${currentIp}`)
      .digest("hex")
      .slice(0, 48);

    // Bloqueia se já existe conta ativa/expirada para este e-mail
    const { data: existingEmail } = await db
      .from("user_access")
      .select("id, is_trial, status")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (existingEmail) {
      return { ok: false, error: "Este e-mail já possui cadastro. Faça login ou use outro e-mail." };
    }

    // Bloqueia se este dispositivo já criou um teste
    const { data: existingFp } = await db
      .from("user_access")
      .select("id")
      .eq("trial_device_fp", deviceFp)
      .limit(1)
      .maybeSingle();
    if (existingFp) {
      return { ok: false, error: "Este dispositivo já usou o teste grátis. Escolha um plano para continuar." };
    }

    const accessCode = generateAccessCode();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const sessionToken = randomUUID();

    const { data: inserted, error } = await db
      .from("user_access")
      .insert({
        email,
        phone,
        access_code: accessCode,
        status: "active",
        expires_at: expiresAt,
        plan_code: "trial",
        device_limit: 1,
        is_trial: true,
        trial_device_fp: deviceFp,
        active_session_token: sessionToken,
        active_session_started_at: new Date().toISOString(),
        active_session_ip: currentIp,
        active_session_user_agent: currentUa,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      await logSecurity("trial_signup_error", false);
      // Race condition — outro insert bateu no índice único
      if ((error as any)?.code === "23505") {
        return { ok: false, error: "Este dispositivo ou e-mail já foi cadastrado." };
      }
      return { ok: false, error: "Não foi possível criar seu teste. Tente novamente." };
    }

    const session = await useSession<AccessSessionData>(getAccessSessionConfig());
    await session.update({
      authenticated: true,
      email,
      code: accessCode,
      accessId: inserted.id,
      sessionToken,
      expiresAt,
    });

    await sendTrialWelcomeEmail({ email, accessCode, expiresAt });
    await logSecurity("trial_signup", true);
    return { ok: true, redirectTo: "/app", accessCode, expiresAt };
  });

export const activateTrialAsPaid = createServerFn({ method: "POST" })
  .inputValidator(activateTrialSchema)
  .handler(async ({ data }) => {
    await requireAdminSession();
    const db = getDb();
    const days = data.durationDays ?? planDurationDays(data.planCode);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { data: row, error: readError } = await db
      .from("user_access")
      .select("id, email, access_code, plan_code, is_trial")
      .eq("id", data.accessId)
      .maybeSingle();
    if (readError || !row) throw new Error("Conta não encontrada");

    const { error } = await db
      .from("user_access")
      .update({
        is_trial: false,
        plan_code: data.planCode,
        status: "active",
        expires_at: expiresAt,
      })
      .eq("id", data.accessId);
    if (error) throw new Error("Não foi possível ativar o plano");

    try {
      await sendAccessEmail({
        email: row.email,
        accessCode: row.access_code,
        expiresAt,
        planLabel: planLabel(data.planCode),
      });
    } catch { /* best-effort */ }

    await logSecurity("admin_activate_trial_paid", true);
    return { ok: true, expiresAt };
  });
