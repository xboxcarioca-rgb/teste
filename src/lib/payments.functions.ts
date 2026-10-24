import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from '@/lib/stripe.server';
import { allowedPaymentOrigin, paymentEnvironmentForOrigin, PAYMENT_CATALOG, type PaymentEnvironment, type PaymentPriceId } from '@/lib/payment-catalog';

const priceIdSchema = z.enum([
    'dtflexpro_mensal',
    'dtflexpro_anual',
    'dtflexpro_mensal_pix',
    'dtflexpro_anual_pix',
  ]);

const checkoutSchema = z.object({
  priceId: priceIdSchema,
  customerEmail: z.string().trim().email().max(255),
  origin: z.string().url().max(2000),
  environment: z.enum(['sandbox', 'live']),
  confirmationToken: z.string().min(32).max(256).optional(),
});

type CheckoutResult = { clientSecret: string } | { error: string };
type PortalResult = { url: string } | { error: string };

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function trustedEnvironment(requested: PaymentEnvironment, origin: string): StripeEnv {
  const expected = paymentEnvironmentForOrigin(origin);
  if (!expected) throw new Error('Endereço de pagamento inválido');
  if (requested !== expected) throw new Error('Ambiente de pagamento inválido');
  return expected;
}

async function privilegedDb() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return supabaseAdmin as any;
}

async function claimExistingAccountConfirmation(options: {
  email: string;
  priceId: PaymentPriceId;
  environment: StripeEnv;
  token?: string;
}) {
  const db = await privilegedDb();
  const { data: account } = await db.from('user_access').select('id, status').eq('email', options.email).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!account) return;
  if (account.status === 'deleted' || account.status === 'revoked') {
    throw new Error('Esta conta precisa ser liberada pelo administrador antes de uma nova compra');
  }
  if (!options.token) throw new Error('Confirme a compra pelo link enviado ao seu e-mail');
  const tokenHash = await sha256(options.token);
  const { data: confirmation } = await db.from('purchase_confirmations')
    .update({ status: 'consumed', consumed_at: new Date().toISOString(), checkout_claimed_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .eq('email', options.email)
    .eq('price_id', options.priceId)
    .eq('environment', options.environment)
    .eq('status', 'confirmed')
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('id')
    .maybeSingle();
  if (!confirmation) {
    throw new Error('A confirmação expirou ou já foi utilizada');
  }
  return confirmation.id as string;
}

async function releaseConfirmationClaim(id?: string) {
  if (!id) return;
  const db = await privilegedDb();
  await db.from('purchase_confirmations')
    .update({ status: 'confirmed', consumed_at: null, checkout_claimed_at: null })
    .eq('id', id)
    .eq('status', 'consumed');
}

async function assertPixAllowed(email: string, environment: StripeEnv) {
  const db = await privilegedDb();
  const { data } = await db.from('access_subscriptions')
    .select('id')
    .eq('email', email)
    .eq('environment', environment)
    .in('status', ['active', 'trialing', 'past_due'])
    .or(`current_period_end.is.null,current_period_end.gt.${new Date().toISOString()}`)
    .limit(1);
  if (data?.length) throw new Error('Sua assinatura no cartão já está vigente. Gerencie ou cancele a assinatura antes de comprar por PIX.');
}

export const preparePurchase = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({
    email: z.string().trim().email().max(255),
    priceId: priceIdSchema,
    origin: z.string().url().max(2000),
    environment: z.enum(['sandbox', 'live']),
  }).parse(input))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const origin = allowedPaymentOrigin(data.origin);
    if (!origin) return { ok: false as const, error: 'Endereço de retorno inválido' };
    const environment = trustedEnvironment(data.environment, origin);
    const db = await privilegedDb();
    const { data: account } = await db.from('user_access').select('id').eq('email', email).limit(1).maybeSingle();
    if (!account) return { ok: true as const, ready: true as const };

    const token = randomToken();
    const tokenHash = await sha256(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await db.from('purchase_confirmations').insert({
      email,
      token_hash: tokenHash,
      price_id: data.priceId,
      payment_method: data.priceId.endsWith('_pix') ? 'pix' : 'card',
      environment,
      expires_at: expiresAt,
    });
    const apiKey = process.env['RESEND_API_KEY'];
    if (!apiKey) return { ok: false as const, error: 'Não foi possível enviar a confirmação agora' };
    const plan = PAYMENT_CATALOG[data.priceId];
    const confirmUrl = `${origin}/confirmar-compra?token=${encodeURIComponent(token)}`;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'DTFLEXPRO <onboarding@resend.dev>',
        to: [email],
        subject: 'Confirme sua compra DTFLEXPRO',
        html: `<div style="font-family:Arial,sans-serif;padding:32px;color:#111827"><h1>Confirme sua compra</h1><p>Recebemos uma solicitação para renovar ou alterar o acesso associado a este e-mail.</p><p><strong>${plan.planCode === 'anual' ? 'Plano Anual' : 'Plano Mensal'} · ${data.priceId.endsWith('_pix') ? 'PIX' : 'Cartão'}</strong></p><a href="${confirmUrl}" style="display:inline-block;background:#111827;color:#fff;padding:14px 20px;border-radius:8px;text-decoration:none">Confirmar e continuar</a><p>Este link expira em 30 minutos. Ignore esta mensagem se você não solicitou a compra.</p></div>`,
      }),
    });
    if (!response.ok) return { ok: false as const, error: 'Não foi possível enviar a confirmação agora' };
    return { ok: true as const, ready: false as const, confirmationRequired: true as const };
  });

export const confirmPurchase = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({ token: z.string().min(32).max(256) }).parse(input))
  .handler(async ({ data }) => {
    const db = await privilegedDb();
    const tokenHash = await sha256(data.token);
    const { data: row } = await db.from('purchase_confirmations')
      .select('id, email, price_id, payment_method, environment, expires_at, consumed_at, status')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (!row || row.consumed_at || row.status !== 'pending' || new Date(row.expires_at).getTime() <= Date.now()) {
      return { ok: false as const, error: 'Este link expirou ou já foi utilizado' };
    }
    await db.from('purchase_confirmations').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('id', row.id);
    return { ok: true as const, email: row.email as string, priceId: row.price_id as PaymentPriceId, environment: row.environment as StripeEnv };
  });

async function authenticatedSubscription(environment: StripeEnv) {
  const { getAuthenticatedAccess } = await import('@/lib/access-guard.server');
  const { accessId } = await getAuthenticatedAccess();
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data } = await (supabaseAdmin as any)
    .from('access_subscriptions')
    .select('stripe_subscription_id, stripe_customer_id, price_id, status, current_period_end, cancel_at_period_end, scheduled_price_id')
    .eq('access_id', accessId)
    .eq('environment', environment)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { accessId, subscription: data, db: supabaseAdmin as any };
}

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  email: string,
): Promise<string> {
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;
  const created = await stripe.customers.create({
    email,
    metadata: { accessEmail: email },
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: 'POST' })
  .inputValidator((input) => checkoutSchema.parse(input))
  .handler(async ({ data }): Promise<CheckoutResult> => {
    let confirmationId: string | undefined;
    try {
      const origin = allowedPaymentOrigin(data.origin);
      if (!origin) throw new Error('Endereço de retorno inválido');
      const environment = trustedEnvironment(data.environment, origin);
      const email = data.customerEmail.toLowerCase();
      const catalog = PAYMENT_CATALOG[data.priceId];
      confirmationId = await claimExistingAccountConfirmation({ email, priceId: data.priceId, environment, token: data.confirmationToken });
      const stripe = createStripeClient(environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId], active: true, limit: 1 });
      const stripePrice = prices.data[0];
      if (!stripePrice) throw new Error('Plano não encontrado');

      const isPix = data.priceId.endsWith('_pix');
      if (isPix) await assertPixAllowed(email, environment);
      if (isPix && stripePrice.type !== 'one_time') throw new Error('Preço PIX inválido');
      if (!isPix && stripePrice.type !== 'recurring') throw new Error('Assinatura inválida');
      if (stripePrice.unit_amount !== catalog.amount || stripePrice.currency.toLowerCase() !== catalog.currency) {
        throw new Error('O valor configurado no pagamento não corresponde ao plano escolhido');
      }
      const isAnnual = catalog.planCode === 'anual';

      const customerId = await resolveOrCreateCustomer(stripe, email);
      const statusToken = randomToken();
      const statusTokenHash = await sha256(statusToken);
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isPix ? 'payment' : 'subscription',
        ui_mode: 'embedded_page',
        return_url: `${origin}/pagamento-retorno?session_id={CHECKOUT_SESSION_ID}&status_token=${encodeURIComponent(statusToken)}`,
        customer: customerId,
        ...(isPix && {
          payment_method_types: ['pix'] as const,
          payment_intent_data: {
            description: isAnnual ? 'DTFLEXPRO — acesso anual via PIX' : 'DTFLEXPRO — acesso mensal via PIX',
          },
        }),
        metadata: {
          accessEmail: email,
          planCode: catalog.planCode,
          paymentKind: isPix ? 'pix' : 'subscription',
          accessDays: String(catalog.accessDays),
          managed_payments: 'false',
          statusTokenHash,
        },
        ...(!isPix && { subscription_data: {
          metadata: {
            accessEmail: email,
            planCode: catalog.planCode,
          },
        } }),
      });

      if (!session.client_secret) throw new Error('O pagamento não pôde ser iniciado');
      return { clientSecret: session.client_secret };
    } catch (error) {
      await releaseConfirmationClaim(confirmationId);
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createCustomerPortalSession = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({
    origin: z.string().url().max(2000),
    environment: z.enum(['sandbox', 'live']),
  }).parse(input))
  .handler(async ({ data }): Promise<PortalResult> => {
    try {
      const origin = allowedPaymentOrigin(data.origin);
      if (!origin) return { error: 'Endereço de retorno inválido' };
      const environment = trustedEnvironment(data.environment, origin);
      const { subscription } = await authenticatedSubscription(environment);

      if (!subscription?.stripe_customer_id) return { error: 'Nenhuma assinatura ativa foi encontrada' };
      const stripe = createStripeClient(environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: subscription.stripe_customer_id,
        return_url: `${origin}/app`,
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const getSubscriptionOverview = createServerFn({ method: 'GET' })
  .inputValidator((input) => z.object({ environment: z.enum(['sandbox', 'live']) }).parse(input))
  .handler(async ({ data }) => {
    try {
      const { subscription } = await authenticatedSubscription(data.environment);
      if (!subscription) return { subscription: null };
      return {
        subscription: {
          priceId: subscription.price_id as string,
          status: subscription.status as string,
          currentPeriodEnd: subscription.current_period_end as string | null,
          cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
          scheduledPriceId: subscription.scheduled_price_id as string | null,
        },
      };
    } catch {
      return { subscription: null };
    }
  });

export const getPaymentStatus = createServerFn({ method: 'GET' })
  .inputValidator((input) => z.object({ sessionId: z.string().min(8).max(255), statusToken: z.string().min(32).max(256), environment: z.enum(['sandbox', 'live']) }).parse(input))
  .handler(async ({ data }) => {
    const db = await privilegedDb();
    const statusTokenHash = await sha256(data.statusToken);
    const { data: payment } = await db.from('payments')
      .select('status, payment_kind, price_id, failure_reason')
      .eq('stripe_session_id', data.sessionId)
      .eq('environment', data.environment)
      .eq('status_token_hash', statusTokenHash)
      .maybeSingle();
    if (!payment) return { status: 'pending' as const };
    return {
      status: payment.status as 'pending' | 'paid' | 'failed' | 'expired',
      paymentKind: payment.payment_kind as string | null,
      priceId: payment.price_id as string | null,
      message: payment.failure_reason ? 'O pagamento não foi concluído. Tente novamente.' : null,
    };
  });

export const scheduleSubscriptionPlanChange = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({
    priceId: z.enum(['dtflexpro_mensal', 'dtflexpro_anual']),
    environment: z.enum(['sandbox', 'live']),
  }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    try {
      const env = data.environment as StripeEnv;
      const { subscription, db } = await authenticatedSubscription(env);
      if (!subscription?.stripe_subscription_id) return { error: 'Nenhuma assinatura ativa foi encontrada' };
      if (subscription.price_id === data.priceId) return { error: 'Este já é o seu plano atual' };

      const stripe = createStripeClient(env);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId], active: true, limit: 1 });
      const nextPrice = prices.data[0];
      if (!nextPrice) return { error: 'O plano escolhido não foi encontrado' };
      const current = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      const item = current.items.data[0];
      if (!item) return { error: 'A assinatura não possui um plano válido' };
      const currentEnd = item.current_period_end;
      if (!currentEnd) return { error: 'A data de renovação não foi encontrada' };
      let scheduleId = typeof current.schedule === 'string' ? current.schedule : current.schedule?.id;
      if (!scheduleId) {
        const schedule = await stripe.subscriptionSchedules.create({ from_subscription: current.id });
        scheduleId = schedule.id;
      }
      await stripe.subscriptionSchedules.update(scheduleId, {
        end_behavior: 'release',
        phases: [
          {
            items: [{ price: item.price.id, quantity: item.quantity ?? 1 }],
            start_date: current.start_date,
            end_date: currentEnd,
            proration_behavior: 'none',
          },
          {
            items: [{ price: nextPrice.id, quantity: item.quantity ?? 1 }],
            start_date: currentEnd,
            proration_behavior: 'none',
          },
        ],
        metadata: {
          accessEmail: current.metadata.accessEmail ?? '',
          pendingPlanCode: data.priceId === 'dtflexpro_anual' ? 'anual' : 'mensal',
        },
      });
      await db.from('access_subscriptions').update({ scheduled_price_id: data.priceId })
        .eq('stripe_subscription_id', current.id)
        .eq('environment', env);
      return { ok: true };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });