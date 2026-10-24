import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = supabaseAdmin as any;

export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature");
        const secret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!signature || !secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const rawBody = await request.text();
        const verified = verifyStripeSignature(rawBody, signature, secret);

        if (!verified) {
          await insertSecurityLog("stripe_webhook_signature_invalid", false, request);
          return new Response("Unauthorized", { status: 401 });
        }

        const event = JSON.parse(rawBody) as Record<string, any>;

        try {
          if (event.type === "checkout.session.completed") {
            await handleCompletedCheckout(event.data?.object, request);
          }

          if (event.type === "payment_intent.succeeded") {
            await handlePaymentIntent(event.data?.object);
          }
        } catch {
          await insertSecurityLog("stripe_webhook_processing_error", false, request);
          return Response.json({ received: true }, { status: 200 });
        }

        return Response.json({ received: true });
      },
    },
  },
});

function verifyStripeSignature(payload: string, signatureHeader: string, secret: string) {
  const elements = signatureHeader.split(",");
  const timestamp = elements.find((part) => part.startsWith("t="))?.slice(2);
  const signature = elements.find((part) => part.startsWith("v1="))?.slice(3);

  if (!timestamp || !signature) return false;

  // Replay protection: reject events older than 5 minutes (Stripe's recommended tolerance)
  const timestampSeconds = parseInt(timestamp, 10);
  if (!Number.isFinite(timestampSeconds)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
  const received = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (received.length !== expectedBuffer.length) return false;
  return timingSafeEqual(received, expectedBuffer);
}

function generateAccessCode() {
  return randomBytes(6)
    .toString("base64")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 8);
}

async function handleCompletedCheckout(session: Record<string, any>, request: Request) {
  const email = String(session?.customer_email ?? session?.metadata?.email ?? "").trim().toLowerCase();
  const stripeSessionId = String(session?.id ?? "");
  const amount = Number((session?.amount_total ?? 0) / 100);

  if (!email || !stripeSessionId) return;

  const { data: existingPayment } = await db
    .from("payments")
    .select("id, status")
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle();

  await db.from("payments").upsert(
    {
      email,
      stripe_session_id: stripeSessionId,
      amount,
      status: "paid",
    },
    { onConflict: "stripe_session_id" },
  );

  if (existingPayment?.status === "paid") return;

  const accessCode = generateAccessCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await db.from("user_access").insert({
    email,
    access_code: accessCode,
    status: "active",
    expires_at: expiresAt,
  });

  await insertSecurityLog("payment_confirmed_access_generated", true, request);
  void sendAccessEmail({ email, accessCode, expiresAt, request });
}

async function handlePaymentIntent(intent: Record<string, any>) {
  const email = String(intent?.receipt_email ?? intent?.metadata?.email ?? "").trim().toLowerCase();
  const stripeSessionId = String(intent?.id ?? "");
  const amount = Number((intent?.amount_received ?? 0) / 100);

  if (!email || !stripeSessionId) return;

  await db.from("payments").upsert(
    {
      email,
      stripe_session_id: stripeSessionId,
      amount,
      status: "succeeded",
    },
    { onConflict: "stripe_session_id" },
  );
}

async function sendAccessEmail({
  email,
  accessCode,
  expiresAt,
  request,
}: {
  email: string;
  accessCode: string;
  expiresAt: string;
  request: Request;
}) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("missing_resend_key");

    const origin = new URL(request.url).origin;
    const accessUrl = `${origin}/login?email=${encodeURIComponent(email)}&code=${encodeURIComponent(accessCode)}`;

    const html = `
      <div style="background:#ffffff;padding:32px;font-family:Arial,sans-serif;color:#111827">
        <div style="max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
          <p style="font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:#6b7280;margin:0 0 12px">DTFLEXPRO</p>
          <h1 style="font-size:28px;line-height:1.2;margin:0 0 16px">🔓 Seu acesso à plataforma está liberado!</h1>
          <p style="font-size:15px;line-height:1.7;color:#4b5563;margin:0 0 16px">Olá, seu pagamento foi confirmado e seu código de acesso já está ativo.</p>
          <div style="margin:24px 0;padding:20px;border-radius:10px;background:#111827;color:#f9fafb;text-align:center;font-family:monospace;font-size:30px;letter-spacing:.18em">${accessCode}</div>
          <p style="font-size:14px;line-height:1.7;color:#4b5563;margin:0 0 20px">Esse código é válido por 24 horas e deve ser usado junto com o e-mail da compra.</p>
          <a href="${accessUrl}" style="display:inline-block;background:#f2c94c;color:#111827;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:700">Acessar Plataforma</a>
          <p style="font-size:13px;line-height:1.7;color:#6b7280;margin:24px 0 0">Validade até: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(expiresAt))}</p>
          <p style="font-size:13px;line-height:1.7;color:#6b7280;margin:8px 0 0">Suporte: <a href="mailto:suporte@dtflexpro.com" style="color:#111827">suporte@dtflexpro.com</a></p>
        </div>
      </div>
    `;

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
        html,
      }),
    });
  } catch {
    await insertSecurityLog("access_email_send_error", false, request);
  }
}

async function insertSecurityLog(eventType: string, success: boolean, request: Request) {
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
