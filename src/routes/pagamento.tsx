import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, CheckCircle2, CreditCard, LockKeyhole, QrCode } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';
import { StripeEmbeddedCheckout } from '@/components/StripeEmbeddedCheckout';
import { pricingOptions } from '@/components/landing/data';
import { getStripeEnvironment } from '@/lib/stripe';
import { paymentPriceId } from '@/lib/payment-catalog';
import { preparePurchase } from '@/lib/payments.functions';
import { isStripeConfigured, kiwifyCheckoutUrl } from '@/lib/kiwify';

const searchSchema = z.object({ plano: z.enum(['mensal', 'anual']).catch('anual') });

export const Route = createFileRoute('/pagamento')({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: 'Assinar DTFLEXPRO' },
      { name: 'description', content: 'Assine o plano mensal ou anual DTFLEXPRO com liberação automática do acesso.' },
      { property: 'og:title', content: 'Assinar DTFLEXPRO' },
      { property: 'og:description', content: 'Pagamento seguro dos planos DTFLEXPRO com liberação automática.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: PagamentoPage,
});

function PagamentoPage() {
  const { plano } = Route.useSearch();
  const plan = pricingOptions.find((option) => option.billing === plano) ?? pricingOptions[0];
  const [email, setEmail] = useState('');
  const [checkoutEmail, setCheckoutEmail] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cartao' | 'pix'>('cartao');
  const [error, setError] = useState<string | null>(null);
  const priceId = paymentPriceId(plano, paymentMethod === 'pix' ? 'pix' : 'card');
  const stripeReady = isStripeConfigured();
  const kiwifyHref = kiwifyCheckoutUrl(plano);

  return (
    <main className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar para a página inicial
        </Link>
        <Card className="rounded-lg border-border/70 bg-card/60 p-6 shadow-[var(--shadow-panel)] md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-6">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-brand">Assinatura</p>
              <h1 className="mt-2 text-3xl font-semibold">{plan.label}</h1>
              <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">{plan.summary}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold text-brand">{plan.price}</div>
              <div className="text-sm text-muted-foreground">{plan.cadence}</div>
            </div>
          </div>
          <div className="grid gap-3 py-6">
            {plan.benefits.map((benefit) => (
              <div key={benefit} className="flex items-start gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border/70 pt-6">
            <Label>Forma de pagamento</Label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={paymentMethod === 'cartao' ? 'default' : 'outline'}
                onClick={() => { setPaymentMethod('cartao'); setCheckoutEmail(null); }}
              >
                <CreditCard className="h-4 w-4" /> Cartão
              </Button>
              <Button
                type="button"
                variant={paymentMethod === 'pix' ? 'default' : 'outline'}
                onClick={() => { setPaymentMethod('pix'); setCheckoutEmail(null); }}
              >
                <QrCode className="h-4 w-4" /> PIX
              </Button>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {paymentMethod === 'pix'
                ? `PIX à vista: acesso por ${plano === 'anual' ? '12 meses' : '30 dias'}, sem renovação automática.`
                : 'O cartão renova automaticamente conforme o período escolhido.'}
            </p>
          </div>
          {!stripeReady && (
            <div className="mt-6 rounded-lg border border-brand/40 bg-brand-muted p-5">
              <p className="font-semibold text-foreground">
                Finalize sua assinatura na Kiwify
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                O pagamento com cartão direto no site ainda não está ativado. Pelo checkout da Kiwify
                você paga com Pix, cartão ou boleto e recebe o acesso do mesmo jeito.
              </p>
              <Button asChild size="lg" className="mt-4 w-full sm:w-auto">
                <a href={kiwifyHref} target="_blank" rel="noopener noreferrer">
                  <LockKeyhole className="h-4 w-4" /> Pagar {plan.price} na Kiwify
                </a>
              </Button>
            </div>
          )}

          {!checkoutEmail ? (
            <form
              className={`mt-6 space-y-4 border-t border-border/70 pt-6 ${stripeReady ? '' : 'hidden'}`}
              onSubmit={async (event) => {
                event.preventDefault();
                const value = email.trim().toLowerCase();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return;
                setPreparing(true);
                setConfirmationSent(false);
                setError(null);
                try {
                  const result = await preparePurchase({ data: { email: value, priceId, origin: window.location.origin, environment: getStripeEnvironment() } });
                  if (!result.ok) {
                    setConfirmationSent(false);
                    setError('Não foi possível iniciar a compra com este e-mail. Tente novamente.');
                    return;
                  }
                  if (result.ready) setCheckoutEmail(value);
                  else setConfirmationSent(true);
                } catch (cause) {
                  setError(
                    'O pagamento com cartão ainda não está ativo. Use o botão da Kiwify abaixo para assinar agora.',
                  );
                  console.error('[pagamento] falha ao preparar compra:', cause);
                } finally {
                  setPreparing(false);
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="payment-email">E-mail para receber seu acesso</Label>
                <Input id="payment-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={preparing}>
                <LockKeyhole className="h-4 w-4" /> {preparing ? 'Verificando…' : 'Continuar para o pagamento'}
              </Button>
              {confirmationSent && <p className="rounded-md border border-brand/30 bg-brand-muted p-3 text-sm text-foreground">Enviamos um link de confirmação. Abra seu e-mail para continuar com segurança.</p>}
              {error && <p className="rounded-md border border-destructive/40 bg-destructive/15 p-3 text-sm text-foreground">{error}</p>}
              <p className="text-xs leading-5 text-muted-foreground">Use o mesmo e-mail no qual deseja receber seu código de acesso.</p>
            </form>
          ) : (
            <div className="border-t border-border/70 pt-6">
              <div className="mb-4 flex items-center justify-between gap-4 text-sm">
                <span className="truncate text-muted-foreground">Acesso para: {checkoutEmail}</span>
                <Button variant="ghost" size="sm" onClick={() => setCheckoutEmail(null)}>Alterar</Button>
              </div>
              <StripeEmbeddedCheckout priceId={priceId} customerEmail={checkoutEmail} />
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}