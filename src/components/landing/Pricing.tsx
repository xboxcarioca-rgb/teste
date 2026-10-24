import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { pricingOptions } from "./data";

const WHATSAPP_NUMBER = "5511943152441";

export function Pricing({ affiliateMode = false }: { affiliateMode?: boolean } = {}) {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<"mensal" | "anual">("anual");
  const effectiveBilling = affiliateMode ? "anual" : billing;

  const selectedPlan = useMemo(
    () => pricingOptions.find((option) => option.billing === effectiveBilling) ?? pricingOptions[0],
    [effectiveBilling],
  );

  function handleCheckout() {
    // Abre a página de pagamento na MESMA janela (sem segunda janela/aba).
    navigate({ to: "/pagamento", search: { plano: effectiveBilling } });
  }

  function handleSendReceipt() {
    const message = encodeURIComponent(
      `Olá! Acabei de pagar o ${selectedPlan.label} (${selectedPlan.price}) da DTFLEXPRO. Segue o comprovante.`,
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank", "noopener,noreferrer");
  }

  return (
    <section id="precos" className="border-b border-border/60 scroll-mt-24">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8 max-w-3xl space-y-3">
          <p className="text-sm uppercase tracking-[0.24em] text-brand">Planos</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Escolha a assinatura que combina com o seu ritmo de produção</h2>
          <p className="text-base leading-7 text-muted-foreground">
            Pagamento via Nubank (Pix ou cartão). Após o pagamento, envie o comprovante pelo WhatsApp para liberarmos seu acesso.
          </p>
        </div>

        {!affiliateMode && (
          <div className="mb-8 inline-flex rounded-md border border-border/70 bg-card/65 p-1">
            {(["mensal", "anual"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setBilling(option)}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  billing === option
                    ? "bg-[oklch(0.58_0.25_27)] text-white shadow-[0_0_18px_oklch(0.58_0.25_27/0.55)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option === "mensal" ? "Mensal" : "Anual"}
              </button>
            ))}
          </div>
        )}


        <Card className="max-w-3xl rounded-lg border-border/70 bg-card/60 p-8 shadow-[var(--shadow-panel)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 border-b border-border/70 pb-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-2xl font-semibold">{selectedPlan.label}</h3>
                {selectedPlan.badge ? (
                  <span className="rounded-full border border-brand/25 bg-brand-muted px-3 py-1 text-xs font-medium text-brand">
                    {selectedPlan.badge}
                  </span>
                ) : null}
              </div>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground">{selectedPlan.summary}</p>
            </div>
            <div className="shrink-0">
              <div className="text-4xl font-semibold tracking-tight text-[oklch(0.86_0.18_92)]">{selectedPlan.price}</div>
              <div className="mt-1 text-sm text-[oklch(0.86_0.18_92)]/80">{selectedPlan.cadence}</div>
            </div>

          </div>

          <div className="grid gap-3 py-6">
            {selectedPlan.benefits.map((benefit) => (
              <div key={benefit} className="flex items-start gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span className="leading-7">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-border/70 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-[oklch(0.86_0.18_92)] text-black hover:bg-[oklch(0.80_0.18_92)] shadow-[0_0_24px_oklch(0.86_0.18_92/0.45)]"
                onClick={handleCheckout}
              >
                Pagar com Nubank ({selectedPlan.price})
              </Button>
              <Button
                size="lg"
                className="w-full sm:w-auto bg-[oklch(0.62_0.19_150)] text-white hover:bg-[oklch(0.56_0.19_150)] shadow-[0_0_24px_oklch(0.62_0.19_150/0.45)]"
                onClick={handleSendReceipt}
              >
                <MessageCircle className="h-4 w-4" />
                Enviar comprovante no WhatsApp
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Após o pagamento, envie o comprovante pelo WhatsApp e libere seu acesso em minutos.
              Acesso vinculado a 1 dispositivo por conta.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
