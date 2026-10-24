import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, MessageCircle } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { pricingOptions } from "@/components/landing/data";

const WHATSAPP_NUMBER = "5511943152441";

const searchSchema = z.object({
  plano: z.enum(["mensal", "anual"]).catch("anual"),
});

export const Route = createFileRoute("/pagamento")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Pagamento do plano — DTFLEXPRO" },
      {
        name: "description",
        content:
          "Finalize o pagamento do plano mensal ou anual da DTFLEXPRO via Nubank (Pix ou cartão) e libere seu acesso.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Pagamento do plano — DTFLEXPRO" },
      {
        property: "og:description",
        content: "Finalize o pagamento do plano mensal ou anual da DTFLEXPRO via Nubank (Pix ou cartão).",
      },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Pagamento do plano — DTFLEXPRO" },
      {
        name: "twitter:description",
        content: "Finalize o pagamento do plano mensal ou anual da DTFLEXPRO via Nubank (Pix ou cartão).",
      },
    ],
  }),
  component: PagamentoPage,
});

function PagamentoPage() {
  const { plano } = Route.useSearch();
  const plan = pricingOptions.find((option) => option.billing === plano) ?? pricingOptions[0];

  function handleSendReceipt() {
    const message = encodeURIComponent(
      `Olá! Acabei de pagar o ${plan.label} (${plan.price}) da DTFLEXPRO. Segue o comprovante.`,
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="mx-auto max-w-2xl px-6">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a página inicial
        </Link>

        <Card className="rounded-lg border-border/70 bg-card/60 p-8 shadow-[var(--shadow-panel)] backdrop-blur-xl">
          <div className="space-y-3 border-b border-border/70 pb-6">
            <p className="text-sm uppercase tracking-[0.24em] text-brand">Pagamento</p>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{plan.label}</h1>
              <div className="text-right">
                <div className="text-3xl font-semibold tracking-tight text-[oklch(0.86_0.18_92)]">{plan.price}</div>
                <div className="text-sm text-[oklch(0.86_0.18_92)]/80">{plan.cadence}</div>
              </div>
            </div>
            <p className="text-sm leading-7 text-muted-foreground">{plan.summary}</p>
          </div>

          <div className="grid gap-3 py-6">
            {plan.benefits.map((benefit) => (
              <div key={benefit} className="flex items-start gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span className="leading-7">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t border-border/70 pt-6">
            <a
              href={plan.checkoutHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[oklch(0.86_0.18_92)] px-8 text-sm font-medium text-black shadow-[0_0_24px_oklch(0.86_0.18_92/0.45)] transition-colors hover:bg-[oklch(0.80_0.18_92)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Pagar com Nubank ({plan.price})
            </a>
            <Button
              size="lg"
              variant="outline"
              className="w-full bg-[oklch(0.62_0.19_150)] text-white hover:bg-[oklch(0.56_0.19_150)] border-transparent shadow-[0_0_24px_oklch(0.62_0.19_150/0.45)]"
              onClick={handleSendReceipt}
            >
              <MessageCircle className="h-4 w-4" />
              Enviar comprovante no WhatsApp
            </Button>
            <p className="text-sm text-muted-foreground">
              O pagamento abre em uma segunda tela (Nova aba), assim esta página continua aberta para você voltar.
              Após pagar, envie o comprovante pelo WhatsApp para liberarmos seu acesso.
            </p>
            <div className="pt-2">
              <Link
                to="/"
                className="text-sm font-medium text-brand underline-offset-4 hover:underline"
              >
                Voltar para a landpage
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
