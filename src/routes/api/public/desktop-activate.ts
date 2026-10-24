import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "crypto";

interface Body {
  email?: string;
  code?: string;
  deviceId?: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Ativação do software desktop (Windows x64).
 * Retorna um "ticket" assinado (HMAC) que o executável guarda localmente
 * para funcionar offline até a data de expiração do plano.
 */
export const Route = createFileRoute("/api/public/desktop-activate")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
      POST: async ({ request }) => {
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return json({ ok: false, error: "Requisição inválida" }, 400);
        }

        const email = (body.email ?? "").trim().toLowerCase();
        const code = normalizeCode(body.code ?? "");
        const deviceId = (body.deviceId ?? "").trim().slice(0, 128);
        const forwarded = request.headers.get("x-forwarded-for");
        const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

        if (!email || code.length < 4 || !deviceId) {
          return json({ ok: false, error: "Informe e-mail e código de ativação." }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { count: failures } = await db.from("security_logs")
          .select("id", { count: "exact", head: true })
          .eq("event_type", `desktop_activation_failure:${email}`)
          .eq("ip", ip)
          .gte("created_at", since);
        if ((failures ?? 0) >= 8) return json({ ok: false, error: "Muitas tentativas. Aguarde alguns minutos." }, 429);
        const { data: row } = await (supabaseAdmin as any)
          .from("user_access")
          .select("id, email, access_code, status, expires_at, plan_code, device_limit")
          .eq("email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!row || normalizeCode(row.access_code ?? "") !== code) {
          await db.from("security_logs").insert({ event_type: `desktop_activation_failure:${email}`, success: false, ip, user_agent: request.headers.get("user-agent") || "desktop" });
          return json({ ok: false, error: "Código de ativação inválido para este e-mail." }, 403);
        }
        if (row.status === "deleted" || row.status === "revoked") {
          return json(
            { ok: false, error: "Acesso bloqueado. Fale com o administrador para renovar." },
            403,
          );
        }
        if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
          return json(
            { ok: false, error: "Plano expirado. Renove para continuar usando o software." },
            403,
          );
        }

        const secret = process.env["SESSION_SECRET"];
        if (!secret) return json({ ok: false, error: "Servidor indisponível" }, 500);

        const hashedDevice = createHmac("sha256", secret).update(deviceId).digest("hex");
        const { data: knownDevice } = await db.from("access_device_sessions")
          .select("id")
          .eq("access_id", row.id)
          .eq("device_key_hash", hashedDevice)
          .eq("device_type", "desktop")
          .maybeSingle();
        const { count: activeDevices } = await db.from("access_device_sessions")
          .select("id", { count: "exact", head: true })
          .eq("access_id", row.id)
          .eq("active", true);
        if (!knownDevice && (activeDevices ?? 0) >= (row.device_limit ?? 1)) {
          return json({ ok: false, error: "O limite de dispositivos desta conta foi atingido." }, 409);
        }
        await db.from("access_device_sessions").upsert({
          access_id: row.id,
          device_key_hash: hashedDevice,
          device_type: "desktop",
          label: `Windows ${deviceId.slice(-8)}`,
          user_agent: request.headers.get("user-agent") || "desktop",
          last_ip: ip,
          active: true,
          last_seen_at: new Date().toISOString(),
          revoked_at: null,
        }, { onConflict: "access_id,device_key_hash,device_type" });

        // Licença válida até a expiração do plano (ou 30 dias para planos sem data).
        const expiresAt =
          row.expires_at ?? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
        const payload = `${email}|${deviceId}|${expiresAt}|${row.plan_code ?? ""}`;
        const signature = createHmac("sha256", secret).update(payload).digest("hex");

        return json({
          ok: true,
          email,
          deviceId,
          expiresAt,
          plan: row.plan_code ?? null,
          signature,
        });
      },
    },
  },
});
