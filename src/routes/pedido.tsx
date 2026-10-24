import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, MessageCircle, CheckCircle2, Loader2, ArrowLeft, Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createHalftoneOrder,
  HALFTONE_CHECKOUT_HREF,
} from "@/lib/halftone-orders.functions";

const WHATSAPP = "5511943152441";

export const Route = createFileRoute("/pedido")({
  head: () => ({
    meta: [
      { title: "Peça seu Halftone Pronto · R$ 5 · DTFLEXPRO" },
      {
        name: "description",
        content:
          "Envie sua arte, pague R$ 5,00 via Pix e receba o arquivo halftone pronto para DTF no WhatsApp.",
      },
    ],
  }),
  component: PedidoPage,
});

type Step = "form" | "pagar" | "pronto";

function PedidoPage() {
  const createFn = useServerFn(createHalftoneOrder);

  const [step, setStep] = useState<Step>("form");
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<{ id: string; order_code: string; checkout_url: string } | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onPickFile(f: File | null) {
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) {
      toast.error("Envie uma imagem PNG, JPG ou WEBP.");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("Imagem maior que 20MB.");
      return;
    }
    setFile(f);
  }

  async function fileToBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Envie a imagem que você quer transformar em halftone.");
      return;
    }
    if (name.trim().length < 2) return toast.error("Informe seu nome.");
    if (phone.replace(/\D/g, "").length < 10) return toast.error("Informe um WhatsApp válido.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error("Informe um e-mail válido.");

    setSubmitting(true);
    try {
      const image_base64 = await fileToBase64(file);
      const result = await createFn({
        data: {
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_email: email.trim().toLowerCase(),
          notes: notes.trim(),
          image_base64,
          image_mime: file.type as "image/png" | "image/jpeg" | "image/webp",
          image_name: file.name,
        },
      });
      setOrder(result);
      setStep("pagar");
      toast.success(`Pedido ${result.order_code} criado!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar pedido.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function whatsAppLink(text: string) {
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar para o site
        </Link>

        <header className="mb-8 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">Atendimento Express</p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Peça seu Halftone pronto por <span className="text-[oklch(0.86_0.18_92)]">R$ 5</span> o arquivo
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            Envie sua imagem, faça o Pix de R$ 5,00 e receba o arquivo halftone pronto para DTF no seu WhatsApp.
          </p>
        </header>

        {step === "form" && (
          <Card className="rounded-lg border-border/70 bg-card/60 p-6 shadow-[var(--shadow-panel)] backdrop-blur-xl md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label className="mb-2 block">Imagem para halftone *</Label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/70 bg-background/40 px-4 py-8 text-center transition hover:border-brand hover:bg-brand-muted/30"
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Pré-visualização"
                      className="max-h-48 rounded-md border border-border/60 object-contain"
                    />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-brand" />
                      <span className="text-sm font-medium">Clique para enviar a imagem</span>
                      <span className="text-xs text-muted-foreground">PNG, JPG ou WEBP — até 20MB</span>
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
                {file && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <ImageIcon className="h-3 w-3" /> {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name">Nome *</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
                </div>
                <div>
                  <Label htmlFor="phone">WhatsApp *</Label>
                  <Input
                    id="phone"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    maxLength={20}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={255}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Use o mesmo e-mail no pagamento Pix. É como identificamos seu pedido.
                </p>
              </div>

              <div>
                <Label htmlFor="notes">Observações (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Ex: halftone para camisa preta, tamanho A3, estilo redondo..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="w-full bg-[oklch(0.86_0.18_92)] text-black hover:bg-[oklch(0.80_0.18_92)] shadow-[0_0_24px_oklch(0.86_0.18_92/0.45)]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  "Continuar para pagamento"
                )}
              </Button>
            </form>
          </Card>
        )}

        {step === "pagar" && order && (
          <Card className="rounded-lg border-border/70 bg-card/60 p-6 shadow-[var(--shadow-panel)] backdrop-blur-xl md:p-8">
            <div className="space-y-5">
              <div className="rounded-md border border-brand/30 bg-brand-muted/30 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand">Seu pedido</p>
                <p className="font-mono text-2xl font-semibold tracking-wider text-foreground">{order.order_code}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Anote ou tire um print. Você vai informar este código no WhatsApp.
                </p>
              </div>

              <ol className="space-y-3 text-sm leading-7 text-foreground">
                <li>
                  <strong>1.</strong> Clique em <em>“Pagar R$ 5,00 via Pix”</em> e finalize o pagamento na página do InfinitePay.
                </li>
                <li>
                  <strong>2.</strong> Volte aqui, clique em <em>“Enviar comprovante no WhatsApp”</em> e mande a foto do comprovante.
                </li>
                <li>
                  <strong>3.</strong> Em até alguns minutos você recebe o arquivo halftone pronto no WhatsApp.
                </li>
              </ol>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-[oklch(0.86_0.18_92)] text-black hover:bg-[oklch(0.80_0.18_92)] shadow-[0_0_24px_oklch(0.86_0.18_92/0.45)]"
                  onClick={() => window.open(order.checkout_url, "_blank", "noopener,noreferrer")}
                >
                  Pagar R$ 5,00 via Pix (InfinitePay)
                </Button>
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-[oklch(0.62_0.19_150)] text-white hover:bg-[oklch(0.56_0.19_150)] shadow-[0_0_24px_oklch(0.62_0.19_150/0.45)]"
                  onClick={() =>
                    window.open(
                      whatsAppLink(
                        `Olá! Acabei de pagar o pedido ${order.order_code} (R$ 5,00) na DTFLEXPRO. Segue o comprovante.`,
                      ),
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  <MessageCircle className="h-4 w-4" /> Enviar comprovante no WhatsApp
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                CNPJ: 63.468.735/0001-64 · Pagamento processado pela InfinitePay.
              </p>

              <button
                type="button"
                onClick={() => setStep("pronto")}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Já enviei o comprovante
              </button>
            </div>
          </Card>
        )}

        {step === "pronto" && order && (
          <Card className="rounded-lg border-border/70 bg-card/60 p-6 shadow-[var(--shadow-panel)] backdrop-blur-xl md:p-8">
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h2 className="text-2xl font-semibold">Tudo certo!</h2>
              <p className="text-muted-foreground">
                Seu pedido <span className="font-mono font-semibold text-foreground">{order.order_code}</span> está na
                fila. Em poucos minutos sua atendente envia o arquivo halftone pronto no WhatsApp.
              </p>
              <Button
                size="lg"
                className="w-full bg-[oklch(0.62_0.19_150)] text-white hover:bg-[oklch(0.56_0.19_150)]"
                onClick={() =>
                  window.open(
                    whatsAppLink(`Oi! Estou aguardando o arquivo do pedido ${order.order_code}.`),
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                <MessageCircle className="h-4 w-4" /> Abrir conversa no WhatsApp
              </Button>
              <Link to="/pedido" className="block text-sm text-muted-foreground underline hover:text-foreground">
                Fazer outro pedido
              </Link>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
