import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, LogOut, MessageCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import logo from "@/assets/dtflexpro-logo.png.asset.json";
import {
  getAffiliateDashboard,
  loginAffiliate,
  logoutAffiliate,
  signupAffiliate,
  submitAffiliateSale,
  updateAffiliateProfile,
} from "@/lib/affiliate.functions";

export const Route = createFileRoute("/afiliado")({
  head: () => ({
    meta: [
      { title: "DTFLEXPRO | Programa de Afiliados" },
      {
        name: "description",
        content:
          "Cadastre-se como afiliado DTFLEXPRO, gere seu link de divulgação e ganhe R$ 40 por venda do plano anual.",
      },
    ],
  }),
  component: AfiliadoPage,
});

type Dashboard = Awaited<ReturnType<typeof getAffiliateDashboard>>;

function AfiliadoPage() {
  const fetchDashboard = useServerFn(getAffiliateDashboard);
  const doLogin = useServerFn(loginAffiliate);
  const doSignup = useServerFn(signupAffiliate);
  const doLogout = useServerFn(logoutAffiliate);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Dashboard | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");

  async function load() {
    try {
      const d = await fetchDashboard();
      setData(d);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </main>
    );
  }

  if (!data?.authenticated) {
    return (
      <AuthForm
        mode={mode}
        onToggle={() => setMode(mode === "login" ? "signup" : "login")}
        onSubmit={async (payload) => {
          if (mode === "login") {
            await doLogin({ data: payload as any });
          } else {
            await doSignup({ data: payload as any });
          }
          await load();
        }}
      />
    );
  }

  return <Dashboard data={data} reload={load} onLogout={async () => { await doLogout(); await load(); }} />;
}

function AuthForm({
  mode,
  onToggle,
  onSubmit,
}: {
  mode: "login" | "signup";
  onToggle: () => void;
  onSubmit: (data: any) => Promise<void>;
}) {
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("dtflexpro-aff-email") || "";
  });
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [fullName, setFullName] = useState("");
  const [preferredSlug, setPreferredSlug] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md rounded-lg bg-card/70 p-6 backdrop-blur">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src={logo.url} alt="DTFlexPRO" className="h-12 w-auto" />
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Programa de Afiliados</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {mode === "login" ? "Entrar" : "Cadastrar como afiliado"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Indique o DTFlexPRO e ganhe <strong className="text-foreground">R$ 40</strong> por venda do plano anual.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setBusy(true);
              if (mode === "signup") {
                if (password.length < 6) {
                  toast.error("Senha precisa ter ao menos 6 caracteres");
                  return;
                }
                await onSubmit({ email, password, fullName, preferredSlug, pixKey, whatsapp });
                toast.success("Cadastro criado!");
              } else {
                await onSubmit({ email, password });
                toast.success("Bem-vindo de volta!");
              }
              if (typeof window !== "undefined") {
                if (remember) localStorage.setItem("dtflexpro-aff-email", email);
                else localStorage.removeItem("dtflexpro-aff-email");
              }
            } catch (err: any) {
              const msg = err?.message || "Erro";
              if (mode === "signup" && /já existe/i.test(msg)) {
                toast.info("E-mail já cadastrado. Faça login com sua senha.");
                onToggle();
              } else {
                toast.error(msg);
              }
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fname">Nome completo</Label>
                <Input id="fname" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Nome do link (opcional)</Label>
                <Input
                  id="slug"
                  placeholder="ex: joao"
                  value={preferredSlug}
                  onChange={(e) => setPreferredSlug(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Seu link será dtflexpro.com/<strong>{preferredSlug || "seunome"}</strong>
                </p>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border accent-primary"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Lembrar de mim neste navegador
          </label>
          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="pix">Chave PIX (para receber)</Label>
                <Input id="pix" value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CPF, e-mail, celular ou chave aleatória" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa">WhatsApp</Label>
                <Input id="wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar cadastro"}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <button type="button" onClick={onToggle} className="text-muted-foreground hover:text-foreground">
            {mode === "login" ? "Não tem cadastro? Criar conta" : "Já tenho conta — entrar"}
          </button>
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            Voltar
          </Link>
        </div>
      </Card>
    </main>
  );
}

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function Dashboard({
  data,
  reload,
  onLogout,
}: {
  data: Extract<Dashboard, { authenticated: true }>;
  reload: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const submitSale = useServerFn(submitAffiliateSale);
  const updateProfile = useServerFn(updateAffiliateProfile);

  const link = `https://dtflexpro.com/${data.affiliate.slug}`;

  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = useState("");
  const [pixProofNote, setPixProofNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSubmitted, setLastSubmitted] = useState<{ email: string } | null>(null);

  const [pixKey, setPixKey] = useState(data.affiliate.pix_key ?? "");
  const [whatsapp, setWhatsapp] = useState(data.affiliate.whatsapp ?? "");

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logo.url} alt="DTFlexPRO" className="h-10 w-auto" />
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Painel do afiliado</p>
              <h1 className="text-2xl font-semibold">Olá, {data.affiliate.full_name.split(" ")[0]}</h1>
              <p className="text-xs text-muted-foreground">Cadastrado em {fmtDate(data.affiliate.created_at)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reload}>
              Atualizar
            </Button>
            <Button variant="ghost" onClick={onLogout}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <Stat title="Vendas registradas" value={String(data.metrics.totalSales)} />
          <Stat title="Ativadas" value={String(data.metrics.activated)} />
          <Stat title="A receber" value={fmtBRL(data.metrics.commissionPendingCents)} />
          <Stat title="Pago" value={fmtBRL(data.metrics.commissionPaidCents)} />
        </section>

        <Card className="rounded-lg bg-card/50 p-5">
          <h2 className="mb-2 text-lg font-medium">Seu link de divulgação</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Compartilhe esse link. Ele leva o cliente para a landing page do DTFlexPRO marcado com seu nome.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm">
              {link}
            </code>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  toast.success("Link copiado!");
                } catch {
                  window.prompt("Copie:", link);
                }
              }}
            >
              <Copy className="h-4 w-4" /> Copiar
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Você só pode vender o <strong>Plano Anual (R$ 147)</strong>. Comissão fixa de{" "}
            <strong>{fmtBRL(data.affiliate.commission_cents)}</strong> por venda ativada.
          </p>
        </Card>

        <Card className="rounded-lg border-primary/30 bg-primary/5 p-5">
          <h2 className="mb-2 text-lg font-medium flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" /> Contato do administrador
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Dúvidas, ativação de venda, pagamento de comissão ou suporte? Fale direto com o administrador da plataforma.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-[oklch(0.62_0.19_150)] text-white hover:bg-[oklch(0.56_0.19_150)]">
              <a
                href="https://wa.me/5511943152441?text=Ol%C3%A1%2C%20sou%20afiliado%20DTFlexPRO%20e%20preciso%20de%20suporte."
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp: (11) 94315-2441
              </a>
            </Button>
          </div>
        </Card>

        <Card className="rounded-lg bg-card/50 p-5">
          <h2 className="mb-2 text-lg font-medium">Registrar uma venda</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Após o cliente fazer o PIX, registre aqui. O administrador receberá a notificação para liberar o acesso.
          </p>
          {lastSubmitted && (
            <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <p className="font-semibold">✅ Venda registrada!</p>
              <p className="mt-1">
                Envie o comprovante do PIX e confirme o e-mail da compra (<strong>{lastSubmitted.email}</strong>) para o administrador via WhatsApp.
                Assim que o acesso for liberado, aparece aqui como <em>ativada</em>.
              </p>
            </div>
          )}
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setBusy(true);
                await submitSale({
                  data: {
                    customerEmail,
                    customerName: customerName || undefined,
                    customerWhatsapp: customerWhatsapp || undefined,
                    pixProofNote: pixProofNote || undefined,
                  },
                });
                toast.success("Venda registrada!");
                setLastSubmitted({ email: customerEmail });
                setCustomerEmail(""); setCustomerName(""); setCustomerWhatsapp(""); setPixProofNote("");
                await reload();
              } catch (err: any) {
                toast.error(err?.message || "Erro ao registrar");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="space-y-2">
              <Label>E-mail do cliente *</Label>
              <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Nome do cliente</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp do cliente</Label>
              <Input value={customerWhatsapp} onChange={(e) => setCustomerWhatsapp(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observação / comprovante PIX</Label>
              <Input value={pixProofNote} onChange={(e) => setPixProofNote(e.target.value)} placeholder="ID/horário do PIX" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Enviando…" : "Registrar venda do Plano Anual"}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="rounded-lg bg-card/50 p-5">
          <h2 className="mb-1 text-lg font-medium">Minhas vendas em aberto</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Mostra apenas vendas pendentes ou ativadas aguardando pagamento. Quando o administrador confirmar o PIX, a venda sai daqui.
          </p>
          {(() => { const openSales = data.sales.filter((s: any) => s.status !== "paid" && s.status !== "cancelled"); return openSales.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda em aberto.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Registrada em</TableHead>
                    <TableHead>Expira em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openSales.map((s: any) => {
                    const expiresIso = s.activated_at
                      ? new Date(new Date(s.activated_at).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
                      : null;
                    return (
                    <TableRow key={s.id}>
                      <TableCell>{s.customer_name || "-"}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{s.customer_email}</TableCell>
                      <TableCell>
                        <StatusBadge status={s.status} />
                      </TableCell>
                      <TableCell>{fmtBRL(s.commission_cents)}</TableCell>
                      <TableCell className="text-xs">{fmtDate(s.created_at)}</TableCell>
                      <TableCell className="text-xs">{expiresIso ? fmtDate(expiresIso) : "—"}</TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ); })()}
        </Card>

        <Card className="rounded-lg bg-card/50 p-5">
          <h2 className="mb-1 text-lg font-medium">Clientes ativados</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Vendas que já foram liberadas pelo administrador, com data de registro e expiração do acesso.
          </p>
          {(() => {
            const activatedSales = data.sales.filter((s: any) => s.status === "activated" || s.status === "paid");
            return activatedSales.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cliente ativado ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Registrada em</TableHead>
                      <TableHead>Acesso expira em</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activatedSales.map((s: any) => {
                      const expiresIso = s.activated_at
                        ? new Date(new Date(s.activated_at).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
                        : null;
                      return (
                        <TableRow key={s.id}>
                          <TableCell>{s.customer_name || "—"}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{s.customer_email}</TableCell>
                          <TableCell className="text-xs">{fmtDate(s.created_at)}</TableCell>
                          <TableCell className="text-xs">{expiresIso ? fmtDate(expiresIso) : "—"}</TableCell>
                          <TableCell>
                            <StatusBadge status={s.status} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })()}
        </Card>

        <Card className="rounded-lg bg-card/50 p-5">
          <h2 className="mb-3 text-lg font-medium flex items-center gap-2"><Wallet className="h-5 w-5" /> Dados para pagamento</h2>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await updateProfile({ data: { pixKey, whatsapp } });
                toast.success("Dados atualizados");
                await reload();
              } catch {
                toast.error("Falha ao salvar");
              }
            }}
          >
            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" variant="outline">Salvar</Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <Card className="rounded-lg bg-card/50 p-5">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Aguardando ativação", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    activated: { label: "Ativada", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    paid: { label: "Paga ✓", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
    cancelled: { label: "Cancelada", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  };
  const v = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${v.cls}`}>{v.label}</span>;
}
