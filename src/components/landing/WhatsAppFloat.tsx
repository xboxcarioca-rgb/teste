import { MessageCircleMore } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const DEFAULT_PHONE = "5511943152441";

function sanitizePhone(input?: string | null): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  // Brazilian numbers without country code -> prefix 55
  return digits.length <= 11 ? `55${digits}` : digits;
}

export function WhatsAppFloat({ phone }: { phone?: string | null } = {}) {
  const number = sanitizePhone(phone) ?? DEFAULT_PHONE;
  const href = `https://wa.me/${number}?text=Ol%C3%A1%21%20Quero%20pedir%20um%20halftone%20pronto%20%28R%24%205%29%20na%20DTFLEXPRO.`;
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label="Fale com o suporte pelo WhatsApp"
            className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full border border-brand/30 bg-brand text-brand-foreground shadow-[var(--shadow-glow)] transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <MessageCircleMore className="h-6 w-6" />
          </a>
        </TooltipTrigger>
        <TooltipContent side="left">Fale com o Suporte</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
