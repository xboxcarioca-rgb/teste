import { randomBytes } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = supabaseAdmin as any;

// InfinitePay envia webhook após pagamento aprovado.
// Configure a URL no painel da InfinitePay:
//   https://www.dtflexpro.com/api/public/infinitepay-webhook
// (opcionalmente com ?token=SEU_SEGREDO se INFINITEPAY_WEBHOOK_SECRET estiver definido)

export const Route = createFileRoute("/api/public/infinitepay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Autenticação obrigatória — sem secret, recusa imediatamente
        const secret = process.env.INFINITEPAY_WEBHOOK_SECRET;
        if (!secret) {
          await log("infinitepay_webhook_misconfigured", false, request);
          return new Response("Server misconfigured", { status: 500 });
        }
        const url = new URL(request.url);
        const provided =
          url.searchParams.get("token") ?? request.headers.get("x-webhook-token") ?? "";
        if (provided !== secret) {
          await log("infinitepay_webhook_unauthorized", false, request);
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: Record<string, any> = {};
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        // Aceita variações comuns dos webhooks InfinitePay
        const email = String(
          payload.email ??
            payload.customer_email ??
            payload.customer?.email ??
            payload.buyer?.email ??
            payload.data?.email ??
            payload.data?.customer?.email ??
            "",
        )
          .trim()
          .toLowerCase();

        // Status — só processa pagamentos aprovados
        const status = String(
          payload.status ?? payload.event ?? payload.data?.status ?? payload.type ?? "",
        ).toLowerCase();
        const isPaid =
          status.includes("paid") ||
          status.includes("aprovad") ||
          status.includes("approved") ||
          status.includes("success") ||
          status.includes("completed");

        // Valor em reais (pode vir em centavos ou em reais)
        let amount = Number(
          payload.amount ??
            payload.total ??
            payload.value ??
            payload.data?.amount ??
            payload.data?.total ??
            0,
        );
        if (amount > 1000) amount = amount / 100; // se vier em centavos

        const transactionId = String(
          payload.transaction_id ??
            payload.id ??
            payload.nsu ??
            payload.order_nsu ??
            payload.data?.id ??
            `inf-${Date.now()}-${randomBytes(4).toString("hex")}`,
        );

        if (!email) {
          await log("infinitepay_webhook_missing_email", false, request);
          return Response.json({ received: true, ignored: "missing_email" });
        }

        if (!isPaid) {
          await log("infinitepay_webhook_not_paid", true, request);
          return Response.json({ received: true, ignored: "not_paid", status });
        }

        // === Pedido avulso de Halftone (R$ 5) ===
        // Não cria assinatura. Apenas marca o pedido como pago.
        if (amount >= 4 && amount <= 6) {
          await db.from("payments").upsert(
            { email, stripe_session_id: transactionId, amount, status: "paid" },
            { onConflict: "stripe_session_id" },
          );

          const { data: pendingOrder } = await db
            .from("halftone_orders")
            .select("id, order_code, payment_status")
            .eq("customer_email", email)
            .eq("payment_status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (pendingOrder) {
            await db
              .from("halftone_orders")
              .update({
                payment_status: "paid",
                delivery_status: "aguardando_envio",
                paid_at: new Date().toISOString(),
                infinitepay_transaction_id: transactionId,
              })
              .eq("id", pendingOrder.id);
            await log("infinitepay_webhook_halftone_paid", true, request);
            return Response.json({ received: true, kind: "halftone_order", order_code: pendingOrder.order_code });
          }

          await log("infinitepay_webhook_halftone_no_order", true, request);
          return Response.json({ received: true, kind: "halftone_order", ignored: "no_pending_order" });
        }

        // Determina plano pelo valor: R$147 => anual, caso contrário mensal (R$47)
        const planCode: "mensal" | "anual" = amount >= 100 ? "anual" : "mensal";

        // Evita duplicar acesso para o mesmo pagamento
        const { data: existingPayment } = await db
          .from("payments")
          .select("id, status")
          .eq("stripe_session_id", transactionId)
          .maybeSingle();

        await db.from("payments").upsert(
          {
            email,
            stripe_session_id: transactionId,
            amount,
            status: "paid",
          },
          { onConflict: "stripe_session_id" },
        );

        if (existingPayment?.status === "paid") {
          return Response.json({ received: true, duplicate: true });
        }

        const provisionalPassword = generateAccessCode();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const { error: insertError } = await db.from("user_access").insert({
          email,
          access_code: provisionalPassword,
          status: "pending",
          expires_at: expiresAt,
          plan_code: planCode,
          device_limit: 1,
        });

        if (insertError) {
          await log("infinitepay_webhook_insert_error", false, request);
          return new Response("Insert failed", { status: 500 });
        }

        void sendProvisionalEmail({
          email,
          provisionalPassword,
          planLabel: planCode === "anual" ? "Plano Anual" : "Plano Mensal",
        }).catch(() => log("infinitepay_provisional_email_error", false, request));

        await log("infinitepay_webhook_provisional_generated", true, request);
        return Response.json({ received: true, planCode });
      },
    },
  },
});

function generateAccessCode() {
  return randomBytes(6)
    .toString("base64")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 8);
}

async function sendProvisionalEmail({
  email,
  provisionalPassword,
  planLabel,
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
        <p style="font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:#6b7280;margin:0 0 12px">DTFlexPRO · ${planLabel}</p>
        <h1 style="font-size:24px;line-height:1.3;margin:0 0 16px">Bem-vindo(a) ao DTFlexPRO</h1>
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 14px">Olá,</p>
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 14px">Muito obrigado por adquirir o nosso Sistema de Geração de Halftone Automático <strong>DTFlexPRO</strong>.</p>
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 14px">Sua compra foi confirmada com sucesso e agora você tem acesso a uma solução avançada desenvolvida para automatizar a criação de efeitos halftone profissionais com máxima qualidade, precisão e velocidade para estampas DTF.</p>
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 14px">O DTFlexPRO foi criado para facilitar seu fluxo de trabalho e elevar o nível das suas artes, entregando resultados profissionais de forma automática e inteligente.</p>
        <div style="margin:24px 0;padding:18px;border-radius:10px;background:#fef3c7;border:1px solid #fbbf24">
          <p style="font-size:13px;margin:0 0 8px;color:#92400e;text-transform:uppercase;letter-spacing:.12em">Plano contratado: ${planLabel}</p>
          <p style="font-size:13px;margin:0 0 8px;color:#92400e;text-transform:uppercase;letter-spacing:.12em">E-mail de acesso</p>
          <div style="font-family:monospace;font-size:16px;color:#111827;text-align:center;margin:8px 0">${email}</div>
          <p style="font-size:13px;margin:14px 0 8px;color:#92400e;text-transform:uppercase;letter-spacing:.12em">Senha provisória de acesso</p>
          <div style="font-family:monospace;font-size:26px;letter-spacing:.18em;color:#111827;text-align:center;margin:8px 0">${provisionalPassword}</div>
          <p style="font-size:12px;color:#92400e;margin:8px 0 0">Use este e-mail e senha para entrar. Em seguida, nossa equipe enviará a senha definitiva conforme o plano contratado (a critério do administrador trocar ou não).</p>
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

async function log(eventType: string, success: boolean, request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  await db.from("security_logs").insert({
    event_type: eventType,
    ip,
    user_agent: userAgent,
    success,
  });
}
