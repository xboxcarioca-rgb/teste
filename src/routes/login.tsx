import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";
import { validateAccessCode, releaseOwnDeviceSession, reactivateOwnAccess } from "@/lib/access.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : "",
    email: typeof search.email === "string" ? search.email : "",
    expired: typeof search.expired === "string" ? search.expired : "",
  }),
  head: () => ({
    meta: [
      { title: "DTFLEXPRO | Validar código" },
      { name: "description", content: "Valide seu código de acesso para entrar na plataforma." },
    ],
  }),
  component: LoginPage,
});


function LoginPage() {
  const search = Route.useSearch();
  const validateCode = useServerFn(validateAccessCode);
  const releaseDevice = useServerFn(releaseOwnDeviceSession);
  const reactivateAccess = useServerFn(reactivateOwnAccess);
  const [email, setEmail] = useState(search.email);
  const [code, setCode] = useState(search.code);
  const [loading, setLoading] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [revoked, setRevoked] = useState<string | null>(null);

  async function handleReactivate() {
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || trimmedCode.length < 6) {
      toast.error("Preencha e-mail e código antes de liberar o acesso");
      return;
    }
    try {
      setReactivating(true);
      const result = await reactivateAccess({ data: { email: trimmedEmail, code: trimmedCode } });
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível reativar o acesso");
        return;
      }
      toast.success("Acesso reativado para 1 dispositivo. Entrando...");
      setRevoked(null);
      setConflict(null);
      const login = await validateCode({ data: { email: trimmedEmail, code: trimmedCode } });
      if (!login.ok) {
        toast.error(login.error ?? "Falha ao entrar após reativar");
        return;
      }
      window.location.href = login.redirectTo;
    } catch (err) {
      console.error(err);
      toast.error("Erro ao reativar acesso");
    } finally {
      setReactivating(false);
    }
  }

  async function handleRelease() {
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || trimmedCode.length < 6) {
      toast.error("Preencha e-mail e código antes de liberar o acesso");
      return;
    }
    try {
      setReleasing(true);
      const result = await releaseDevice({ data: { email: trimmedEmail, code: trimmedCode } });
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível liberar o acesso");
        return;
      }
      toast.success("Acesso liberado. Entrando neste dispositivo...");
      setConflict(null);
      const login = await validateCode({ data: { email: trimmedEmail, code: trimmedCode } });
      if (!login.ok) {
        toast.error(login.error ?? "Falha ao entrar após liberar");
        return;
      }
      window.location.href = login.redirectTo;
    } catch (err) {
      console.error(err);
      toast.error("Erro ao liberar acesso");
    } finally {
      setReleasing(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConflict(null);
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Informe um e-mail válido");
      return;
    }
    if (trimmedCode.length < 6) {
      toast.error("O código de acesso precisa ter ao menos 6 caracteres");
      return;
    }
    try {
      setLoading(true);
      setConflict(null);
      setRevoked(null);
      const result = await validateCode({
        data: { email: trimmedEmail, code: trimmedCode },
      });
      if (!result.ok) {
        if ((result as any).expired) {
          toast.error(result.error ?? "Seu acesso expirou", { duration: 10000 });
          window.location.href = `/login?expired=1&email=${encodeURIComponent(trimmedEmail)}`;
        } else if ((result as any).revoked) {
          setRevoked(result.error ?? "Seu acesso foi revogado.");
          toast.error(result.error, { duration: 10000 });
        } else if (result.error && /dispositivo/i.test(result.error)) {
          setConflict(result.error);
          toast.error(result.error, { duration: 10000 });
        } else {
          toast.error(result.error);
        }
        return;
      }

      window.location.href = result.redirectTo;
    } catch (error) {
      console.error(error);
      toast.error("Código inválido ou expirado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md rounded-lg bg-card/70 p-6 backdrop-blur">
        <div className="mb-6 space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">DTFLEXPRO</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Entrar com código</h1>
          <p className="text-sm text-muted-foreground">
            Use o e-mail da compra e o código enviado após a confirmação do pagamento.
          </p>
        </div>
        {search.expired === "1" && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
            <div className="flex gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Seu acesso expirou</p>
                <p className="mt-1 text-amber-100/80">
                  Seu plano venceu. Para continuar usando a plataforma, entre em contato com o administrador
                  pelo WhatsApp para renovar. Apenas o admin pode liberar o acesso novamente.
                </p>
                <a
                  href={`https://wa.me/5511943152441?text=${encodeURIComponent(`Olá! Meu acesso ao DTFlexPRO expirou (${email || "meu e-mail"}) e quero renovar.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black hover:bg-emerald-400"
                >
                  Renovar pelo WhatsApp
                </a>
              </div>
            </div>
          </div>
        )}


        {conflict && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            <div className="flex gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Acesso já em uso em outro dispositivo</p>
                <p className="mt-1 text-red-200/80">{conflict}</p>
                <p className="mt-2 text-xs text-red-200/70">
                  Plano permite apenas <strong>1 dispositivo</strong>. Libere para usar aqui ou reative se foi revogado.
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                type="button"
                onClick={handleRelease}
                disabled={releasing || reactivating || loading}
                variant="destructive"
              >
                {releasing ? "Liberando..." : "Liberar p/ outro PC"}
              </Button>
              <Button
                type="button"
                onClick={handleReactivate}
                disabled={releasing || reactivating || loading}
                variant="default"
              >
                {reactivating ? "Liberando..." : "Liberar (revogado)"}
              </Button>
            </div>
          </div>
        )}

        {revoked && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
            <div className="flex gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Seu acesso foi revogado</p>
                <p className="mt-1 text-amber-100/80">{revoked}</p>
                <p className="mt-2 text-xs text-amber-100/70">
                  Ao liberar, o acesso será reativado para uso em <strong>1 dispositivo</strong>.
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={handleReactivate}
              disabled={reactivating || loading}
              className="mt-3 w-full"
            >
              {reactivating ? "Liberando..." : "Liberar acesso (1 dispositivo)"}
            </Button>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          method="post"
          action="/login"
          className="space-y-4"
          autoComplete="on"
        >
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Código de Acesso</Label>
            <div className="relative">
              <Input
                id="code"
                name="password"
                type={showCode ? "text" : "password"}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                required
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCode((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showCode ? "Ocultar código" : "Mostrar código"}
                tabIndex={-1}
              >
                {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              💾 Seu navegador pode salvar o código com segurança. Você permanecerá conectado
              mesmo após reiniciar o computador.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Validando..." : "Entrar na plataforma"}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          <Link to="/" className="text-foreground hover:text-primary">
            Voltar para a landing page
          </Link>
        </div>
      </Card>
    </main>
  );
}
