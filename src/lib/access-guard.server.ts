import { useSession } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface AccessSessionData {
  authenticated: boolean;
  email: string;
  code: string;
  accessId: string;
  sessionToken: string;
  expiresAt: string;
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

  const active =
    row &&
    row.status !== "deleted" &&
    row.status !== "revoked" &&
    row.active_session_token === sessionToken &&
    (!row.expires_at || new Date(row.expires_at).getTime() > Date.now());

  if (!active) {
    throw new Error("Acesso não autorizado");
  }

  return { accessId, email: session.data.email ?? "" };
}
