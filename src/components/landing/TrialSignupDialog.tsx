import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerTrialAccess } from "@/lib/access.functions";

function computeDeviceFingerprint(): string {
  try {
    const nav = typeof navigator !== "undefined" ? navigator : ({} as Navigator);
    const scr = typeof screen !== "undefined" ? screen : ({} as Screen);
    const parts = [
      nav.userAgent ?? "",
      nav.language ?? "",
      (nav as any).hardwareConcurrency ?? "",
      (nav as any).platform ?? "",
      scr.width ?? "",
      scr.height ?? "",
      scr.colorDepth ?? "",
      new Date().getTimezoneOffset(),
    ].join("|");
    // Canvas fingerprint
    try {
      const c = document.createElement("canvas");
      c.width = 200; c.height = 40;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = "#f60";
        ctx.fillRect(0, 0, 200, 40);
        ctx.fillStyle = "#069";
        ctx.fillText("dtflex-fp-🎨", 2, 2);
        return `${parts}|${c.toDataURL().slice(-64)}`;
      }
    } catch { /* ignore */ }
    return parts;
  } catch {
    return `fallback-${Math.random().toString(36).slice(2)}`;
  }
}

export function TrialSignupDialog({ trigger }: { trigger?: React.ReactNode }) {
  const register = useServerFn(registerTrialAccess);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Informe um e-mail válido");
      return;
    }
    if (trimmedPhone.replace(/\D/g, "").length < 10) {
      toast.error("Informe um número de WhatsApp válido");
      return;
    }
    try {
      setLoading(true);
      const deviceFp = computeDeviceFingerprint();
      const result = await register({ data: { email: trimmedEmail, phone: trimmedPhone, deviceFp } });
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível criar seu teste");
        return;
      }
      toast.success("Teste liberado! Entrando na plataforma...");
      window.location.href = result.redirectTo;
    } catch {
      toast.error("Erro ao criar seu teste. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.55)]">
            <Gift className="h-4 w-4" />
            Testar 7 dias grátis
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Teste grátis por 7 dias</DialogTitle>
          <DialogDescription>
            Sem cartão de crédito. Após 7 dias, escolha um plano para continuar usando.
            Limitado a 1 teste por dispositivo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trial-email">E-mail</Label>
            <Input
              id="trial-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trial-phone">WhatsApp (com DDD)</Label>
            <Input
              id="trial-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              required
              autoComplete="tel"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            {loading ? "Liberando..." : "Começar meus 7 dias grátis"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Ao continuar, você aceita nossos termos de uso.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
