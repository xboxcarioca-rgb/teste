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
            `inf-${crypto.randomUUID()}`,
        );
        const orderCode = String(payload.order_code ?? payload.order?.code ?? payload.data?.order_code ?? "").trim();

        if (!email || !orderCode || !transactionId || transactionId.startsWith("inf-")) {
          await log("infinitepay_webhook_missing_email", false, request);
          return Response.json({ received: true, ignored: "missing_verified_order_identity" });
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
            .eq("order_code", orderCode)
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

        await log("infinitepay_webhook_non_service_payment", true, request);
        return Response.json({ received: true, ignored: "plan_sales_use_stripe" });
      },
    },
  },
});

async function log(eventType: string, success: boolean, request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  await db.from("security_logs").insert({ event_type: eventType, success, ip, user_agent: request.headers.get("user-agent") || "unknown" });
}
