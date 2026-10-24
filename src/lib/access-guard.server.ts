import { useSession } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface AccessSessionData {
  authenticated: boolean;
  email: string;
  code: string;
  accessId: string;
  sessionToken: string;
  expiresAt: string;
  deviceSessionId?: string;
}

function config() {
  const password = process.env.SESSION_SECRET;
  if (!password) throw new Error("Configuração de sessão indisponível");
  return {
    password,
    name: "dtflexpro-access-session",
    maxAge: 60 * 60 * 24 * 365 * 10,
    cookie: {
      httpOnly: true,
      sameSite: "none" as const,
      secure: true,
      path: "/",
    },
  };
}

/**
 * Rejeita chamadas de RPC feitas por visitantes sem sessão de acesso ativa.
 * Bloqueia abuso direto de endpoints pagos (AI image gen etc.).
 */
export async function assertAccessAuthenticated(): Promise<void> {
  await getAuthenticatedAccess();
}

export async function getAuthenticatedAccess(): Promise<{ accessId: string; email: string }> {
  const session = await useSession<AccessSessionData>(config());
  const accessId = session.data?.accessId;
  const sessionToken = session.data?.sessionToken;
  if (!session.data?.authenticated || !accessId || !sessionToken) {
    throw new Error("Acesso não autorizado");
  }

  const { data: row } = await (supabaseAdmin as any)
    .from("user_access")
    .select("active_session_token, status, expires_at")
    .eq("id", accessId)
    .maybeSingle();

  const { data: deviceSession } = session.data?.deviceSessionId
    ? await (supabaseAdmin as any)
        .from("access_device_sessions")
        .select("active, session_token_hash, session_expires_at")
        .eq("id", session.data.deviceSessionId)
        .eq("access_id", accessId)
        .maybeSingle()
    : { data: null };

  const secret = process.env.SESSION_SECRET;
  const expectedHash = secret
    ? (await import("node:crypto")).createHmac("sha256", secret).update(sessionToken).digest("hex")
    : "";
  const durableSessionActive = deviceSession?.active &&
    deviceSession.session_token_hash === expectedHash &&
    (!deviceSession.session_expires_at || new Date(deviceSession.session_expires_at).getTime() > Date.now());

  const active =
    row &&
    row.status !== "deleted" &&
    row.status !== "revoked" &&
    (durableSessionActive || row.active_session_token === sessionToken) &&
    (!row.expires_at || new Date(row.expires_at).getTime() > Date.now());

  if (!active) {
    throw new Error("Acesso não autorizado");
  }

  return { accessId, email: session.data.email ?? "" };
}
