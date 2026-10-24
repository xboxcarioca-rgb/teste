import { createFileRoute } from '@tanstack/react-router';

type StripeEnv = 'sandbox' | 'live';

function planCodeFromPrice(priceId?: string) {
  return priceId === 'dtflexpro_anual' ? 'anual' : 'mensal';
}

function accessCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (value) => value.toString(36).toUpperCase()).join('').slice(0, 8);
}

function period(subscription: any) {
  const item = subscription?.items?.data?.[0];
  const start = item?.current_period_start ?? subscription?.current_period_start;
  const end = item?.current_period_end ?? subscription?.current_period_end;
  return {
    start: start ? new Date(start * 1000).toISOString() : null,
    end: end ? new Date(end * 1000).toISOString() : null,
  };
}

function priceDetails(subscription: any) {
  const price = subscription?.items?.data?.[0]?.price;
  return {
    priceId: price?.lookup_key || price?.metadata?.lovable_external_id || price?.id || 'unknown',
    productId: typeof price?.product === 'string' ? price.product : price?.product?.id || 'unknown',
  };
}

async function sendAccessEmail(email: string, code: string, expiresAt: string, planCode: string, origin: string) {
  const apiKey = process.env['RESEND_API_KEY'];
  if (!apiKey) return;
  const accessUrl = `${origin}/login?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
  const plan = planCode === 'anual' ? 'Plano Anual' : 'Plano Mensal';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'DTFLEXPRO <onboarding@resend.dev>',
      to: [email],
      subject: 'Seu acesso DTFLEXPRO está liberado',
      html: `<div style="background:#fff;padding:32px;font-family:Arial,sans-serif;color:#111827"><div style="max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:32px"><p style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#6b7280">DTFLEXPRO · ${plan}</p><h1 style="font-size:26px">Pagamento confirmado</h1><p style="color:#4b5563;line-height:1.7">Seu plano foi ativado automaticamente. Use o código abaixo com o e-mail da compra.</p><div style="margin:24px 0;padding:20px;border-radius:10px;background:#111827;color:#f9fafb;text-align:center;font-family:monospace;font-size:30px;letter-spacing:.18em">${code}</div><a href="${accessUrl}" style="display:inline-block;background:#f2c94c;color:#111827;text-decoration:none;padding:14px 20px;border-radius:8px;font-weight:700">Acessar plataforma</a><p style="font-size:13px;color:#6b7280;margin-top:24px">Acesso vigente até ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(expiresAt))}.</p></div></div>`,
    }),
  });
  if (!response.ok) throw new Error(`Access email failed with status ${response.status}`);
}

async function processEvent(request: Request, env: StripeEnv) {
  const { verifyWebhook, createStripeClient } = await import('@/lib/stripe.server');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const db = supabaseAdmin as any;
  const event = await verifyWebhook(request, env);

  const { data: priorEvent } = await db.from('payment_webhook_events')
    .select('status, attempts')
    .eq('event_id', event.id)
    .eq('environment', env)
    .maybeSingle();
  if (priorEvent?.status === 'processed') return;

  const { error: eventError } = await db.from('payment_webhook_events').upsert({
    event_id: event.id,
    environment: env,
    event_type: event.type,
    status: 'processing',
    attempts: Number(priorEvent?.attempts ?? 0) + 1,
    last_error: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'event_id,environment' });
  if (eventError) throw eventError;

  const markProcessed = async () => {
    await db.from('payment_webhook_events').update({
      status: 'processed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_error: null,
    }).eq('event_id', event.id).eq('environment', env);
  };

  const recordPayment = async (session: any, status: 'pending' | 'paid' | 'failed' | 'expired', failureReason?: string) => {
    const email = String(session?.metadata?.accessEmail ?? session?.customer_details?.email ?? session?.customer_email ?? '').trim().toLowerCase();
    await db.from('payments').upsert({
      email: email || `customer:${session?.customer ?? 'unknown'}`,
      stripe_session_id: String(session.id),
      amount: Number(session.amount_total ?? 0) / 100,
      status,
      environment: env,
      payment_kind: session?.metadata?.paymentKind ?? null,
      price_id: session?.metadata?.planCode ? `dtflexpro_${session.metadata.planCode}${session?.metadata?.paymentKind === 'pix' ? '_pix' : ''}` : null,
      failure_reason: failureReason ?? null,
      status_token_hash: session?.metadata?.statusTokenHash ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'stripe_session_id' });
  };

  const syncSubscription = async (subscription: any) => {
    const email = String(subscription?.metadata?.accessEmail ?? '').trim().toLowerCase();
    const { priceId, productId } = priceDetails(subscription);
    const dates = period(subscription);
    const { data: access } = email
      ? await db.from('user_access').select('id, manual_expiry_override').eq('email', email).order('created_at', { ascending: false }).limit(1).maybeSingle()
      : { data: null };
    const { data: stored } = await db.from('access_subscriptions')
      .select('scheduled_price_id, price_id')
      .eq('stripe_subscription_id', subscription.id)
      .eq('environment', env)
      .maybeSingle();
    const scheduledApplied = stored?.scheduled_price_id && stored.scheduled_price_id === priceId;
    await db.from('access_subscriptions').upsert({
      access_id: access?.id ?? null,
      email: email || `customer:${subscription.customer}`,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: String(subscription.customer),
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: dates.start,
      current_period_end: dates.end,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      scheduled_price_id: subscription.status === 'canceled' || subscription.cancel_at_period_end
        ? null
        : scheduledApplied ? null : stored?.scheduled_price_id ?? null,
      environment: env,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'stripe_subscription_id,environment' });
    if (access?.id) {
      await db.from('user_access').update({
        payment_customer_id: String(subscription.customer),
        payment_subscription_id: subscription.id,
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        plan_code: planCodeFromPrice(priceId),
      }).eq('id', access.id);
    }
  };

  const activate = async (subscription: any, fallbackEmail?: string) => {
    const { priceId } = priceDetails(subscription);
    const planCode = planCodeFromPrice(priceId);
    const dates = period(subscription);
    const email = String(subscription?.metadata?.accessEmail ?? fallbackEmail ?? '').trim().toLowerCase();
    if (!email || !dates.end) throw new Error('Subscription is missing access email or period end');

    const { data: existing } = await db
      .from('user_access')
      .select('id, access_code, device_limit, manual_expiry_override, expires_at')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const code = existing?.access_code || accessCode();
    let accessId = existing?.id;
    if (existing?.id) {
      await db.from('user_access').update({
        access_code: code,
        status: 'active',
        expires_at: existing.manual_expiry_override && existing.expires_at && new Date(existing.expires_at).getTime() > new Date(dates.end).getTime() ? existing.expires_at : dates.end,
        payment_synced_expires_at: dates.end,
        plan_code: planCode,
        device_limit: existing.device_limit ?? 1,
        is_trial: false,
        payment_customer_id: String(subscription.customer),
        payment_subscription_id: subscription.id,
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      }).eq('id', existing.id);
    } else {
      const { data: inserted, error } = await db.from('user_access').insert({
        email,
        access_code: code,
        status: 'active',
        expires_at: dates.end,
        payment_synced_expires_at: dates.end,
        plan_code: planCode,
        device_limit: 1,
        is_trial: false,
        payment_customer_id: String(subscription.customer),
        payment_subscription_id: subscription.id,
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      }).select('id').single();
      if (error) throw error;
      accessId = inserted.id;
    }
    await syncSubscription(subscription);
    if (accessId) {
      await db.from('access_subscriptions').update({ access_id: accessId, email }).eq('stripe_subscription_id', subscription.id).eq('environment', env);
    }
    return { email, code, expiresAt: dates.end, planCode, accessId };
  };

  const activatePix = async (session: any) => {
    const email = String(session?.metadata?.accessEmail ?? session?.customer_details?.email ?? session?.customer_email ?? '').trim().toLowerCase();
    const planCode = session?.metadata?.planCode === 'anual' ? 'anual' : 'mensal';
    const accessDays = planCode === 'anual' ? 365 : 30;
    if (!email) throw new Error('PIX payment is missing access email');

    const { data: existing } = await db.from('user_access')
      .select('id, access_code, expires_at, device_limit')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const code = existing?.access_code || accessCode();
    const currentExpiry = existing?.expires_at ? new Date(existing.expires_at).getTime() : 0;
    const startsAt = Math.max(Date.now(), currentExpiry);
    const expiresAt = new Date(startsAt + accessDays * 24 * 60 * 60 * 1000).toISOString();
    const accessValues = {
      email,
      access_code: code,
      status: 'active',
      expires_at: expiresAt,
      plan_code: planCode,
      device_limit: existing?.device_limit ?? 1,
      is_trial: false,
      cancel_at_period_end: false,
    };
    if (existing?.id) {
      await db.from('user_access').update(accessValues).eq('id', existing.id);
    } else {
      const { error } = await db.from('user_access').insert(accessValues);
      if (error) throw error;
    }
    return { email, code, expiresAt, planCode, accessId: existing?.id };
  };

  const stripe = createStripeClient(env);
  const object = event.data.object;
  try {
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      await syncSubscription(object);
    } else if (event.type === 'customer.subscription.deleted') {
      await syncSubscription(object);
      const dates = period(object);
      await db.from('user_access').update({
        status: dates.end && new Date(dates.end).getTime() > Date.now() ? 'active' : 'expired',
        expires_at: dates.end ?? new Date().toISOString(),
        payment_synced_expires_at: dates.end,
        cancel_at_period_end: true,
      }).eq('payment_subscription_id', object.id);
    } else if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      if (object.payment_status === 'unpaid' && event.type === 'checkout.session.completed') {
        await recordPayment(object, 'pending');
      } else {
        const { data: recorded } = await db.from('payments')
          .select('entitlement_status, email_delivery_status')
          .eq('stripe_session_id', String(object.id))
          .maybeSingle();
        let access: Awaited<ReturnType<typeof activatePix>> | Awaited<ReturnType<typeof activate>> | undefined;
        if (recorded?.entitlement_status !== 'granted') {
          await recordPayment(object, 'pending');
          if (object.metadata?.paymentKind === 'pix') {
            access = await activatePix(object);
          } else if (typeof object.subscription === 'string') {
            const subscription = await stripe.subscriptions.retrieve(object.subscription, { expand: ['items.data.price'] });
            access = await activate(subscription, object.customer_details?.email ?? object.customer_email);
          }
          await db.from('payments').update({ entitlement_status: 'granted', access_id: access?.accessId ?? null }).eq('stripe_session_id', String(object.id));
        }
        await recordPayment(object, 'paid');
        if (access && recorded?.email_delivery_status !== 'sent') {
          try {
            await sendAccessEmail(access.email, access.code, access.expiresAt, access.planCode, new URL(request.url).origin);
            await db.from('payments').update({ email_delivery_status: 'sent', email_delivery_error: null }).eq('stripe_session_id', String(object.id));
          } catch (emailError) {
            await db.from('payments').update({ email_delivery_status: 'failed', email_delivery_error: emailError instanceof Error ? emailError.message : String(emailError) }).eq('stripe_session_id', String(object.id));
          }
        }
      }
    } else if (event.type === 'checkout.session.async_payment_failed') {
      await recordPayment(object, 'failed', 'async_payment_failed');
    } else if (event.type === 'checkout.session.expired') {
      await recordPayment(object, 'expired', 'checkout_expired');
    } else if (event.type === 'invoice.paid') {
      const subscriptionId = typeof object.subscription === 'string' ? object.subscription : object.parent?.subscription_details?.subscription;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['items.data.price'] });
        const access = await activate(subscription, object.customer_email);
        try {
          await sendAccessEmail(access.email, access.code, access.expiresAt, access.planCode, new URL(request.url).origin);
        } catch (emailError) {
          console.error('Renewal access email failed', emailError);
        }
      }
    } else if (event.type === 'invoice.payment_failed') {
      const subscriptionId = typeof object.subscription === 'string' ? object.subscription : object.parent?.subscription_details?.subscription;
      if (subscriptionId) {
        await db.from('access_subscriptions').update({ status: 'past_due' }).eq('stripe_subscription_id', subscriptionId).eq('environment', env);
      }
    } else if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
      const paymentIntent = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id;
      if (paymentIntent) {
        const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 });
        const session = sessions.data[0];
        if (session) {
          await recordPayment(session, 'failed', event.type === 'charge.refunded' ? 'refunded' : 'disputed');
          const { data: payment } = await db.from('payments').select('access_id').eq('stripe_session_id', session.id).maybeSingle();
          if (payment?.access_id) {
            await db.from('user_access').update({
              status: 'revoked',
              active_session_token: null,
              active_session_started_at: null,
            }).eq('id', payment.access_id);
            await db.from('access_device_sessions').update({ active: false, revoked_at: new Date().toISOString() }).eq('access_id', payment.access_id);
          }
        }
      }
    }
    await markProcessed();
  } catch (error) {
    await db.from('payment_webhook_events').update({
      status: 'failed',
      last_error: error instanceof Error ? error.message : String(error),
      updated_at: new Date().toISOString(),
    }).eq('event_id', event.id).eq('environment', env);
    throw error;
  }
}

export const Route = createFileRoute('/api/public/payments/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get('env');
        if (rawEnv !== 'sandbox' && rawEnv !== 'live') return Response.json({ received: true, ignored: 'invalid env' });
        try {
          await processEvent(request, rawEnv);
          return Response.json({ received: true });
        } catch (error) {
          console.error('Payment webhook error', error);
          return new Response('Webhook error', { status: 400 });
        }
      },
    },
  },
});