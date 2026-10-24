import { Package, Printer, Save, Shield, SlidersHorizontal, Zap } from "lucide-react";

import { Card } from "@/components/ui/card";

import { featureItems } from "./data";

const iconMap = {
  zap: Zap,
  sliders: SlidersHorizontal,
  package: Package,
  shield: Shield,
  save: Save,
  printer: Printer,
} as const;

export function Features() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 max-w-3xl space-y-3">
          <p className="text-sm uppercase tracking-[0.24em] text-brand">O que a ferramenta faz</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Velocidade, precisão e controle para fechar arte com confiança</h2>
          <p className="text-base leading-7 text-muted-foreground">
            Cada recurso foi pensado para transformar imagens em halftone com consistência visual e agilidade no fluxo de produção.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featureItems.map((item) => {
            const Icon = iconMap[item.icon];

            return (
              <Card key={item.title} className="rounded-lg border-border/70 bg-card/55 p-6 backdrop-blur transition-transform duration-200 hover:-translate-y-1">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-brand/30 bg-brand-muted text-brand">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-medium">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
