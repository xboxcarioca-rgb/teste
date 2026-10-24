import { useEffect, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CheckCircle2, Clock3, Mail, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';
import { getPaymentStatus } from '@/lib/payments.functions';
import { getStripeEnvironment } from '@/lib/stripe';

export const Route = createFileRoute('/pagamento-retorno')({
  validateSearch: (search: Record<string, unknown>): { session_id?: string; status_token?: string } => ({
    session_id: typeof search.session_id === 'string' ? search.session_id : undefined,
    status_token: typeof search.status_token === 'string' ? search.status_token : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'Pagamento recebido — DTFLEXPRO' },
      { name: 'description', content: 'Confirmação do pagamento e liberação automática do acesso DTFLEXPRO.' },
      { property: 'og:title', content: 'Pagamento recebido — DTFLEXPRO' },
      { property: 'og:description', content: 'Pagamento processado e acesso DTFLEXPRO em liberação automática.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: PaymentReturnPage,
});

function PaymentReturnPage() {
  const { session_id: sessionId, status_token: statusToken } = Route.useSearch();
  const [status, setStatus] = useState<'pending' | 'paid' | 'failed' | 'expired'>(sessionId && statusToken ? 'pending' : 'failed');

  useEffect(() => {
    if (!sessionId || !statusToken) return;
    let active = true;
    let attempts = 0;
    const check = async () => {
      const result = await getPaymentStatus({ data: { sessionId, statusToken, environment: getStripeEnvironment() } });
      if (!active) return;
      setStatus(result.status);
      attempts += 1;
      if (result.status === 'pending' && attempts < 40) window.setTimeout(check, 3000);
    };
    check().catch(() => setStatus('pending'));
    return () => { active = false; };
  }, [sessionId, statusToken]);

  return (
    <main className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="mx-auto flex max-w-xl px-6 py-16">
        <Card className="w-full rounded-lg border-border/70 bg-card/70 p-8 text-center shadow-[var(--shadow-panel)]">
          {status === 'paid' ? <CheckCircle2 className="mx-auto h-12 w-12 text-brand" /> : status === 'pending' ? <Clock3 className="mx-auto h-12 w-12 text-brand" /> : <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />}
          <h1 className="mt-5 text-3xl font-semibold text-foreground">{status === 'paid' ? 'Pagamento confirmado' : status === 'pending' ? 'Aguardando confirmação' : status === 'expired' ? 'Pagamento expirado' : 'Pagamento não concluído'}</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {status === 'paid' ? 'Seu acesso foi ativado automaticamente.' : status === 'pending' ? 'Esta página será atualizada assim que o cartão ou PIX for confirmado.' : 'Volte ao plano escolhido para iniciar uma nova tentativa.'}
          </p>
          <div className="mt-6 flex items-start gap-3 rounded-md border border-border bg-muted/50 p-4 text-left text-sm text-muted-foreground">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <span>Enviaremos o código de acesso ao e-mail usado no pagamento. Métodos em processamento podem levar alguns minutos.</span>
          </div>
          {(!sessionId || !statusToken) && <p className="mt-4 text-sm text-destructive">Não foi possível identificar esta sessão de pagamento.</p>}
          {(status === 'failed' || status === 'expired') && <Button asChild className="mt-7 w-full"><Link to="/pagamento" search={{ plano: 'anual' }}>Tentar novamente</Link></Button>}
          <Button asChild className={(status === 'failed' || status === 'expired') ? 'mt-3 w-full' : 'mt-7 w-full'}>
            <Link to="/login" search={{ email: '' }}>Entrar na plataforma</Link>
          </Button>
          <Button asChild variant="outline" className="mt-3 w-full">
            <Link to="/">Voltar para a página inicial</Link>
          </Button>
        </Card>
      </div>
    </main>
  );
}