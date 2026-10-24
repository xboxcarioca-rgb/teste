import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import { faqItems } from "./data";

export function FAQ() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 max-w-3xl space-y-3">
          <p className="text-sm uppercase tracking-[0.24em] text-brand">FAQ</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Perguntas frequentes</h2>
          <p className="text-base leading-7 text-muted-foreground">
            Respostas rápidas para dúvidas comuns sobre uso, formatos e suporte.
          </p>
        </div>

        <Accordion type="single" collapsible className="rounded-lg border border-border/70 bg-card/50 px-6">
          {faqItems.map((item, index) => (
            <AccordionItem key={item.question} value={`item-${index}`} className="border-border/70">
              <AccordionTrigger className="py-5 text-base hover:no-underline">{item.question}</AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-7 text-muted-foreground">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
