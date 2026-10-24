import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Clock, ShieldAlert, XCircle } from "lucide-react";
import { consultarPedido, solicitarAcesso } from "@/lib/access.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : "",
    ...(typeof search.next === "string" ? { next: search.next } : {}),
  }),
  head: () => ({
    meta: [
      { title: "DTFLEXPRO | Entrar na plataforma" },
      {
        name: "description",
        content: "Informe seu e-mail para solicitar acesso à plataforma DTFLEXPRO.",
      },
      { property: "og:title", content: "DTFLEXPRO | Entrar na plataforma" },
      { property: "og:description", content: "Informe seu e-mail para solicitar acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

type Estado =
  | { fase: "formulario" }
  | { fase: "aguardando"; requestId: string; email: string; expiresAt?: string }
  | { fase: "recusado"; email: string }
  | { fase: "expirado"; email: string }
  | { fase: "bloqueado"; mensagem: string };

const INTERVALO_CONSULTA_MS = 3000;

function LoginPage() {
  const search = Route.useSearch();
  const destino = search.next ?? "/app";
  const solicitar = useServerFn(solicitarAcesso);
  const consultar = useServerFn(consultarPedido);

  const [email, setEmail] = useState(search.email);
  const [deviceKey, setDeviceKey] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<Estado>({ fase: "formulario" });
  const [restante, setRestante] = useState<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Chave do dispositivo: identifica este aparelho entre visitas.
  useEffect(() => {
    const storageKey = "dtflexpro-device-key";
    let stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      stored = crypto.randomUUID();
      window.localStorage.setItem(storageKey, stored);
    }
    setDeviceKey(stored);
  }, []);

  // Enquanto aguarda, consulta o servidor a cada 3 segundos.
  useEffect(() => {
    if (estado.fase !== "aguardando") {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    const requestId = estado.requestId;
    let cancelado = false;

    async function verificar() {
      try {
        const resultado = await consultar({ data: { requestId } });
        if (cancelado) return;

        if (resultado.status === "approved") {
          if (timerRef.current) clearInterval(timerRef.current);
          toast.success("Acesso liberado! Entrando...");
          window.location.href = destino;
          return;
        }
        if (resultado.status === "denied") {
          if (timerRef.current) clearInterval(timerRef.current);
          setEstado({ fase: "recusado", email: estadoEmailAtual() });
          return;
        }
        if (resultado.status === "expired") {
          if (timerRef.current) clearInterval(timerRef.current);
          setEstado({ fase: "expirado", email: estadoEmailAtual() });
        }
      } catch {
        /* rede oscilou — tenta no próximo ciclo */
      }
    }

    function estadoEmailAtual() {
      return estado.fase === "aguardando" ? estado.email : "";
    }

    timerRef.current = setInterval(verificar, INTERVALO_CONSULTA_MS);
    void verificar();

    return () => {
      cancelado = true;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.fase, estado.fase === "aguardando" ? estado.requestId : null]);

  // Contagem regressiva do pedido.
  useEffect(() => {
    if (estado.fase !== "aguardando" || !estado.expiresAt) {
      setRestante("");
      return;
    }
    const alvo = new Date(estado.expiresAt).getTime();
    const atualizar = () => {
      const diff = alvo - Date.now();
      if (diff <= 0) {
        setRestante("expirado");
        return;
      }
      const min = Math.floor(diff / 60000);
      const seg = Math.floor((diff % 60000) / 1000);
      setRestante(`${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`);
    };
    atualizar();
    const t = setInterval(atualizar, 1000);
    return () => clearInterval(t);
  }, [estado]);

  async function handleSolicitar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const limpo = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) {
      toast.error("Informe um e-mail válido");
      return;
    }

    try {
      setEnviando(true);
      const resultado = await solicitar({ data: { email: limpo, deviceKey } });

      if (!resultado.ok) {
        if ("status" in resultado && resultado.status === "deleted") {
          setEstado({ fase: "bloqueado", mensagem: resultado.error ?? "" });
        } else if ("status" in resultado && resultado.status === "revoked") {
          setEstado({ fase: "bloqueado", mensagem: resultado.error ?? "" });
        } else {
          toast.error(resultado.error ?? "Não foi possível solicitar o acesso.");
        }
        return;
      }

      if (resultado.status === "approved") {
        window.location.href = destino;
        return;
      }

      setEstado({
        fase: "aguardando",
        requestId: resultado.requestId!,
        email: limpo,
        expiresAt: resultado.expiresAt,
      });
    } catch (erro) {
      console.error(erro);
      toast.error("Erro ao solicitar acesso. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md rounded-lg bg-card/70 p-6 backdrop-blur">
        <div className="mb-6 space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">DTFLEXPRO</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {estado.fase === "formulario" && "Entrar na plataforma"}
            {estado.fase === "aguardando" && "Aguardando liberação"}
            {estado.fase === "recusado" && "Acesso não liberado"}
            {estado.fase === "expirado" && "Pedido expirado"}
            {estado.fase === "bloqueado" && "Acesso indisponível"}
          </h1>
        </div>

        {estado.fase === "formulario" && (
          <>
            <p className="mb-5 text-center text-sm text-muted-foreground">
              Informe seu e-mail. O administrador libera o acesso e você entra automaticamente.
            </p>
            <form onSubmit={handleSolicitar} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando ? "Enviando pedido..." : "Solicitar acesso"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Primeiro acesso? O pedido aparece no painel do administrador e costuma ser
                liberado em instantes.
              </p>
            </form>
          </>
        )}

        {estado.fase === "aguardando" && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <Clock className="h-10 w-10 animate-pulse text-amber-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              Pedido enviado para <strong className="text-foreground">{estado.email}</strong>.
              Assim que for liberado, você entra automaticamente — pode deixar esta página
              aberta.
            </p>
            {restante && (
              <p className="text-xs text-muted-foreground">
                {restante === "expirado"
                  ? "O pedido expirou. Solicite novamente."
                  : `Expira em ${restante}`}
              </p>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setEstado({ fase: "formulario" })}
            >
              Cancelar e voltar
            </Button>
          </div>
        )}

        {estado.fase === "recusado" && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <XCircle className="h-10 w-10 text-red-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              O pedido de <strong className="text-foreground">{estado.email}</strong> não foi
              liberado.
            </p>
            <p className="text-xs text-muted-foreground">
              Fale com o suporte pelo WhatsApp para resolver.
            </p>
            <Button className="w-full" onClick={() => setEstado({ fase: "formulario" })}>
              Solicitar novamente
            </Button>
          </div>
        )}

        {estado.fase === "expirado" && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <Clock className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              O pedido de <strong className="text-foreground">{estado.email}</strong> expirou
              antes de ser liberado.
            </p>
            <Button className="w-full" onClick={() => setEstado({ fase: "formulario" })}>
              Solicitar novamente
            </Button>
          </div>
        )}

        {estado.fase === "bloqueado" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
              <div className="flex gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Somente o administrador pode liberar</p>
                  <p className="mt-1 text-amber-100/80">{estado.mensagem}</p>
                </div>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setEstado({ fase: "formulario" })}>
              Voltar
            </Button>
          </div>
        )}

        {estado.fase === "formulario" && (
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3" />
            <span>Acesso vinculado ao dispositivo liberado</span>
          </div>
        )}

        <div className="mt-5 flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <Link to="/" className="text-foreground hover:text-primary">
            Voltar para a landing page
          </Link>
        </div>
      </Card>
    </main>
  );
}
