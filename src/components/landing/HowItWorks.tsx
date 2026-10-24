import { ArrowRight, Download, SlidersHorizontal, Upload } from "lucide-react";

import { steps } from "./data";

const iconMap = {
  upload: Upload,
  adjustments: SlidersHorizontal,
  download: Download,
} as const;

export function HowItWorks() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 max-w-3xl space-y-3">
          <p className="text-sm uppercase tracking-[0.24em] text-brand">Como funciona</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Simples como 1, 2, 3</h2>
          <p className="text-base leading-7 text-muted-foreground">
            Um fluxo enxuto para sair da imagem original até o arquivo final sem travar sua operação criativa.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = iconMap[step.icon];

            return (
              <div key={step.title} className="relative rounded-lg border border-border/70 bg-card/55 p-6 backdrop-blur">
                <div className="mb-5 flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md border border-brand/25 bg-brand-muted text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">0{index + 1}</span>
                </div>
                <h3 className="text-lg font-medium">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.description}</p>
                {index < steps.length - 1 ? (
                  <ArrowRight className="absolute -right-3 top-10 hidden h-6 w-6 text-brand md:block" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
