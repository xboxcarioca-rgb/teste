import { useEffect, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CheckCircle2, LoaderCircle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';
import { StripeEmbeddedCheckout } from '@/components/StripeEmbeddedCheckout';
import { confirmPurchase } from '@/lib/payments.functions';
import type { PaymentPriceId } from '@/lib/payment-catalog';

export const Route = createFileRoute('/confirmar-compra')({
  validateSearch: (search: Record<string, unknown>) => ({ token: typeof search.token === 'string' ? search.token : '' }),
  head: () => ({ meta: [
    { title: 'Confirmar compra — DTFLEXPRO' },
    { name: 'description', content: 'Confirme sua compra e continue para o pagamento seguro DTFLEXPRO.' },
    { property: 'og:title', content: 'Confirmar compra — DTFLEXPRO' },
    { property: 'og:description', content: 'Confirmação segura para renovar ou alterar o acesso DTFLEXPRO.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: ConfirmPurchasePage,
});

function ConfirmPurchasePage() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<{ email: string; priceId: PaymentPriceId } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!token) { setError('Link de confirmação inválido'); return; }
    confirmPurchase({ data: { token } }).then((result) => {
      if (!result.ok) setError(result.error);
      else setState({ email: result.email, priceId: result.priceId });
    }).catch(() => setError('Não foi possível confirmar esta compra'));
  }, [token]);

  return <main className="min-h-screen bg-background">
    <PaymentTestModeBanner />
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Card className="rounded-lg border-border bg-card p-6 md:p-8">
        {!state && !error && <div className="flex items-center gap-3"><LoaderCircle className="h-5 w-5 animate-spin text-brand" /><span>Confirmando sua solicitação…</span></div>}
        {error && <div className="text-center"><ShieldAlert className="mx-auto h-10 w-10 text-destructive" /><h1 className="mt-4 text-2xl font-semibold">Não foi possível confirmar</h1><p className="mt-2 text-muted-foreground">{error}</p><Button asChild className="mt-6"><Link to="/">Voltar ao início</Link></Button></div>}
        {state && <><div className="mb-6 flex items-start gap-3"><CheckCircle2 className="mt-1 h-6 w-6 text-brand" /><div><h1 className="text-2xl font-semibold">E-mail confirmado</h1><p className="mt-1 text-sm text-muted-foreground">Continue abaixo para concluir o pagamento.</p></div></div><StripeEmbeddedCheckout priceId={state.priceId} customerEmail={state.email} confirmationToken={token} /></>}
      </Card>
    </div>
  </main>;
}