import { createFileRoute } from "@tanstack/react-router";

/**
 * Diagnóstico de configuração do servidor.
 *
 * Responde apenas SE cada variável existe (nunca o valor) para descobrir em
 * segundos por que o login está falhando em um deploy:
 *
 *   GET /api/health
 *
 * Nenhum segredo é exposto — só nomes ausentes e booleanos.
 */

const REQUIRED = [
  { name: "SUPABASE_URL", hint: "Supabase → Project Settings → API → Project URL" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", hint: "Supabase → Project Settings → API → service_role (secreta)" },
  { name: "SESSION_SECRET", hint: "gerar com: openssl rand -hex 32" },
] as const;

const OPTIONAL = [
  "SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "APP_URL",
  "ADMIN_MASTER_PASSWORD",
  "RESEND_API_KEY",
  "LOVABLE_SEND_URL",
  "LOVABLE_API_KEY",
  "VITE_PAYMENTS_CLIENT_TOKEN",
  "STRIPE_WEBHOOK_SECRET",
  "INFINITEPAY_WEBHOOK_SECRET",
] as const;

function isSet(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const missing = REQUIRED.filter((item) => !isSet(process.env[item.name]));
        const optionalMissing = OPTIONAL.filter((name) => !isSet(process.env[name]));

        // Tenta falar com o Supabase apenas quando as credenciais existem.
        let database: { reachable: boolean; detail?: string } = { reachable: false };
        if (missing.length === 0) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { error } = await (supabaseAdmin as any)
              .from("user_access")
              .select("id", { count: "exact", head: true });
            database = error
              ? { reachable: false, detail: error.message }
              : { reachable: true };
          } catch (cause) {
            database = {
              reachable: false,
              detail: cause instanceof Error ? cause.message : String(cause),
            };
          }
        }

        const ok = missing.length === 0 && database.reachable;

        return new Response(
          JSON.stringify(
            {
              ok,
              login: ok ? "pronto" : "indisponível",
              missing: missing.map((item) => ({ variable: item.name, ondeObter: item.hint })),
              optionalMissing,
              database,
              ambiente: process.env.NODE_ENV ?? "unknown",
              checadoEm: new Date().toISOString(),
            },
            null,
            2,
          ),
          {
            status: ok ? 200 : 503,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
            },
          },
        );
      },
    },
  },
});
