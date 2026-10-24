import { useEffect, useMemo, useState } from 'react';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { createCheckoutSession } from '@/lib/payments.functions';
import { getStripe, getStripeEnvironment } from '@/lib/stripe';
import type { PaymentPriceId } from '@/lib/payment-catalog';

function friendlyError(message: string) {
  if (/LIVE_API_KEY|not configured|go-live/i.test(message)) {
    return 'Os pagamentos reais ainda estão sendo liberados pela operadora. Fale com a gente no WhatsApp para concluir sua compra.';
  }
  return `Não foi possível abrir o pagamento: ${message}`;
}

export function StripeEmbeddedCheckout({
  priceId,
  customerEmail,
  confirmationToken,
}: {
  priceId: PaymentPriceId;
  customerEmail: string;
  confirmationToken?: string;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setClientSecret(null);
    setError(null);
    (async () => {
      try {
        const result = await createCheckoutSession({
          data: {
            priceId,
            customerEmail,
            origin: window.location.origin,
            environment: getStripeEnvironment(),
            confirmationToken,
          },
        });
        if (cancelled) return;
        if ('error' in result) setError(friendlyError(result.error));
        else if (!result.clientSecret) setError(friendlyError('sem resposta da operadora'));
        else setClientSecret(result.clientSecret);
      } catch (e) {
        if (!cancelled) setError(friendlyError(e instanceof Error ? e.message : String(e)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [confirmationToken, customerEmail, priceId]);

  const options = useMemo(() => (clientSecret ? { clientSecret } : null), [clientSecret]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-foreground">
        {error}
      </div>
    );
  }
  if (!options) {
    return <div className="min-h-[200px] rounded-lg bg-card p-6 text-sm text-muted-foreground">Carregando pagamento…</div>;
  }
  return (
    <div className="min-h-[620px] overflow-hidden rounded-lg bg-card">
      <EmbeddedCheckoutProvider key={options.clientSecret} stripe={getStripe()} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
