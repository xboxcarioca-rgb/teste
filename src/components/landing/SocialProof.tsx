import { Star } from "lucide-react";

import { Card } from "@/components/ui/card";

import { proofBadge, testimonialItems } from "./data";

export function SocialProof() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 space-y-4">
          <div className="inline-flex items-center rounded-full border border-brand/25 bg-brand-muted px-4 py-2 text-sm text-brand">
            {proofBadge}
          </div>
          <div className="max-w-3xl space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Clientes que já aceleram aprovação e produção com a DTFLEXPRO</h2>
            <p className="text-base leading-7 text-muted-foreground">
              A ferramenta foi pensada para acelerar aprovação, manter consistência e reduzir retrabalho em operações criativas.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {testimonialItems.map((item) => (
            <Card key={item.name} className="rounded-lg border-border/70 bg-card/55 p-6 backdrop-blur">
              <div className="mb-5 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-brand/25 bg-brand-muted text-sm font-semibold text-brand">
                  {item.avatar}
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">{item.role}</p>
                </div>
              </div>
              <div className="mb-4 flex gap-1 text-brand" aria-label="5 estrelas">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">{item.quote}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
