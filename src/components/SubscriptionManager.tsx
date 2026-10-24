import { useEffect, useState } from 'react';
import { CreditCard, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  createCustomerPortalSession,
  getSubscriptionOverview,
  scheduleSubscriptionPlanChange,
} from '@/lib/payments.functions';
import { getStripeEnvironment } from '@/lib/stripe';

type Overview = {
  priceId: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  scheduledPriceId: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Assinatura ativa',
  trialing: 'Período de teste',
  past_due: 'Pagamento da renovação em atraso',
  canceled: 'Assinatura cancelada',
  unpaid: 'Pagamento pendente',
};

export function SubscriptionManager({ onClose }: { onClose: () => void }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSubscriptionOverview({ data: { environment: getStripeEnvironment() } })
      .then((result) => setOverview(result.subscription))
      .finally(() => setLoading(false));
  }, []);

  async function openPortal() {
    const result = await createCustomerPortalSession({
      data: { environment: getStripeEnvironment(), origin: window.location.origin },
    });
    if ('error' in result) return toast.error(result.error);
    window.open(result.url, '_blank', 'noopener,noreferrer');
  }

  async function switchPlan() {
    if (!overview) return;
    const target = overview.priceId === 'dtflexpro_anual' ? 'dtflexpro_mensal' : 'dtflexpro_anual';
    const result = await scheduleSubscriptionPlanChange({
      data: { priceId: target, environment: getStripeEnvironment() },
    });
    if ('error' in result) return toast.error(result.error);
    setOverview({ ...overview, scheduledPriceId: target });
    toast.success('Troca programada para a próxima renovação');
  }

  return (
    <div className="fixed inset-0 z-[140] grid place-items-center bg-background/90 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg rounded-lg border-border bg-card p-6 shadow-[var(--shadow-panel)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand">Assinatura</p>
            <h2 className="mt-2 text-2xl font-semibold">Gerenciar plano</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
        </div>
        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Carregando assinatura…</p>
        ) : overview ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
              <p className="font-semibold text-foreground">{overview.priceId === 'dtflexpro_anual' ? 'Plano Anual' : 'Plano Mensal'}</p>
              <p className="mt-1 text-foreground">{STATUS_LABELS[overview.status] ?? 'Situação em atualização'}</p>
              <p className="mt-1 text-muted-foreground">
                {overview.currentPeriodEnd ? `Vigente até ${new Date(overview.currentPeriodEnd).toLocaleDateString('pt-BR')}` : 'Assinatura ativa'}
              </p>
              {overview.cancelAtPeriodEnd && <p className="mt-2 text-destructive">Cancelamento programado para o fim do período.</p>}
              {overview.scheduledPriceId && (
                <p className="mt-2 text-brand">Troca programada para {overview.scheduledPriceId === 'dtflexpro_anual' ? 'Anual' : 'Mensal'}.</p>
              )}
            </div>
            <Button className="w-full" onClick={switchPlan} disabled={Boolean(overview.scheduledPriceId)}>
              <RefreshCw className="h-4 w-4" />
              Trocar para {overview.priceId === 'dtflexpro_anual' ? 'Mensal' : 'Anual'} na renovação
            </Button>
            <Button variant="outline" className="w-full" onClick={openPortal}>
              <ExternalLink className="h-4 w-4" /> Atualizar pagamento ou cancelar
            </Button>
          </div>
        ) : (
          <div className="mt-6 text-sm text-muted-foreground">
            <CreditCard className="mb-3 h-6 w-6 text-brand" />
            Não encontramos uma assinatura feita pelo pagamento embutido nesta conta.
          </div>
        )}
      </Card>
    </div>
  );
}