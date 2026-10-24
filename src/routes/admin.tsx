import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  activateTrialAsPaid,
  deleteAccess,
  generateManualAccessCode,
  getAdminDashboardData,
  getAdminSession,
  logoutAdminSession,
  regenerateAccessCode,
  setAccessExpiry,

  registerProvisionalAccess,
  resetActiveSession,
  revokeAccess,
  sendDeviceWarning,
  updateDeviceLimit,
  verifyAdminPassword,
} from "@/lib/access.functions";

import {
  activateAffiliateSale,
  deleteAffiliateSale,
  getAffiliateAdminData,
  markAffiliateSalePaid,
} from "@/lib/affiliate.functions";
import logo from "@/assets/dtflexpro-logo.png.asset.json";
import { HalftoneOrdersAdmin } from "@/components/admin/HalftoneOrdersAdmin";
import { ChevronDown, ChevronRight, Users, MessageCircle, AlertTriangle } from "lucide-react";

interface MonthlyMetric {
  month: string;
  mensal: number;
  anual: number;
  total: number;
}

interface DashboardPayload {
  codes: Array<{
    id: string;
    email: string;
    phone?: string | null;
    access_code: string;
    status: string;
    expires_at: string;
    created_at: string;
    plan_code: string | null;
    device_limit: number | null;
    is_trial?: boolean | null;
    trial_device_fp?: string | null;
    active_session_token: string | null;
    active_session_started_at: string | null;
    active_session_ip: string | null;
    active_session_user_agent: string | null;
    last_activity_at: string | null;
    affiliate_sale?: {
      id: string;
      affiliate_id: string;
      customer_email: string;
      status: string;
      commission_cents: number;
      affiliates?: { full_name: string; slug: string } | null;
    } | null;
  }>;
  payments: Array<{
    id: string;
    email: string;
    stripe_session_id: string;
    amount: number;
    status: string;
    created_at: string;
  }>;
  logs: Array<{
    id: string;
    event_type: string;
    ip: string | null;
    user_agent: string | null;
    success: boolean;
    created_at: string;
  }>;
  deviceAttempts: Array<{
    id: string;
    email: string;
    ip: string;
    user_agent: string;
    created_at: string;
  }>;
  metrics: {
    totalCodes: number;
    activeCodes: number;
    uniqueClients: number;
    monthly: MonthlyMetric[];
  };
}

const EMPTY: DashboardPayload = {
  codes: [],
  payments: [],
  logs: [],
  deviceAttempts: [],
  metrics: { totalCodes: 0, activeCodes: 0, uniqueClients: 0, monthly: [] },
};

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "DTFLEXPRO | Painel admin" },
      { name: "description", content: "Painel administrativo protegido da DTFLEXPRO." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const verifyPassword = useServerFn(verifyAdminPassword);
  const readSession = useServerFn(getAdminSession);
  const readDashboard = useServerFn(getAdminDashboardData);
  const revoke = useServerFn(revokeAccess);
  const removeAccount = useServerFn(deleteAccess);
  const setDevices = useServerFn(updateDeviceLimit);
  const resetSession = useServerFn(resetActiveSession);
  const warnDevice = useServerFn(sendDeviceWarning);
  const generateManualCode = useServerFn(generateManualAccessCode);
  const regenerateCode = useServerFn(regenerateAccessCode);
  const saveExpiry = useServerFn(setAccessExpiry);
  const [expiryEmail, setExpiryEmail] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [expiryPlan, setExpiryPlan] = useState<"mensal" | "anual" | "teste">("mensal");


  const registerProvisional = useServerFn(registerProvisionalAccess);
  const logout = useServerFn(logoutAdminSession);

  const [password, setPassword] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualPlan, setManualPlan] = useState<"mensal" | "anual" | "vitalicia">("mensal");
  const [manualDays, setManualDays] = useState<string>("");
  const [manualDevices, setManualDevices] = useState<string>("1");
  const [provEmail, setProvEmail] = useState("");
  const [provPlan, setProvPlan] = useState<"mensal" | "anual" | "vitalicia">("mensal");
  const [provDevices, setProvDevices] = useState<string>("1");

  const [provLoading, setProvLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardPayload>(EMPTY);
  const [tab, setTab] = useState<"geral" | "afiliados" | "halftone" | "testes">("geral");
  const activateTrial = useServerFn(activateTrialAsPaid);

  async function loadDashboard() {
    try {
      const data = await readDashboard();
      setDashboard(data as DashboardPayload);
      return true;
    } catch {
      toast.error("Não foi possível carregar os dados do painel agora.");
      return false;
    }
  }

  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    (async () => {
      try {
        const session = await readSession();
        if (!active) return;
        setAuthenticated(Boolean(session.authenticated));
        if (session.authenticated) {
          await loadDashboard();
          interval = setInterval(() => {
            loadDashboard();
          }, 10_000);
        }
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, []);

  const maxMonthly = useMemo(
    () => Math.max(1, ...dashboard.metrics.monthly.map((m) => m.total)),
    [dashboard.metrics.monthly],
  );

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="text-sm text-muted-foreground">Carregando painel...</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <Card className="w-full max-w-md rounded-lg bg-card/70 p-6 backdrop-blur">
          <div className="mb-6 space-y-2 text-center">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Admin DTFLEXPRO</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Entrar no painel</h1>
            <p className="text-sm text-muted-foreground">Acesso restrito ao dono da ferramenta.</p>
          </div>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                setLoading(true);
                const result = await verifyPassword({ data: { password } });
                if (!result.ok) {
                  toast.error("Credenciais inválidas");
                  return;
                }
                setAuthenticated(true);
                setPassword("");
                await loadDashboard();
              } catch {
                toast.error("Credenciais inválidas");
              } finally {
                setLoading(false);
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="admin-password">Senha master</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Validando..." : "Entrar"}
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

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src={logo.url} alt="DTFlexPRO" className="h-16 w-auto md:h-20" />
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Painel do proprietário</p>
              <h1 className="text-3xl font-semibold tracking-tight">Administração DTFLEXPRO</h1>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => loadDashboard()}>
              Atualizar dados
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await logout();
                setAuthenticated(false);
              }}
            >
              Sair
            </Button>
          </div>
        </header>

        <nav className="flex gap-2 border-b border-border">
          <button
            type="button"
            onClick={() => setTab("geral")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "geral"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Geral
          </button>
          <button
            type="button"
            onClick={() => setTab("halftone")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "halftone"
                ? "border-[oklch(0.86_0.18_92)] text-[oklch(0.86_0.18_92)]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Pedidos Halftone
          </button>
          <button
            type="button"
            onClick={() => setTab("testes")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "testes"
                ? "border-emerald-400 text-emerald-300"
                : "border-transparent text-muted-foreground hover:text-emerald-200"
            }`}
          >
            Testes 7 dias ({dashboard.codes.filter((c) => c.is_trial).length})
          </button>
          <button
            type="button"
            onClick={() => setTab("afiliados")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "afiliados"
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-muted-foreground hover:text-amber-200"
            }`}
          >
            Afiliados
          </button>
        </nav>

        {tab === "halftone" && <HalftoneOrdersAdmin />}

        {tab === "testes" && (
          <TrialSignupsSection
            codes={dashboard.codes.filter((c) => c.is_trial)}
            onActivate={async (item, planCode) => {
              try {
                await activateTrial({ data: { accessId: item.id, planCode } });
                toast.success(`Plano ${planCode} ativado para ${item.email}`);
                await loadDashboard();
              } catch {
                toast.error("Não foi possível ativar o plano");
              }
            }}
            onDelete={async (item) => {
              if (!confirm(`Excluir o teste de ${item.email}?`)) return;
              try {
                await removeAccount({ data: { accessId: item.id } });
                toast.success("Teste excluído");
                await loadDashboard();
              } catch {
                toast.error("Não foi possível excluir");
              }
            }}
          />
        )}

        {tab === "geral" && (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <StatCard title="Clientes únicos" value={String(dashboard.metrics.uniqueClients)} />
              <StatCard title="Códigos ativos" value={String(dashboard.metrics.activeCodes)} />
              <StatCard title="Códigos emitidos" value={String(dashboard.metrics.totalCodes)} />
              <StatCard title="Eventos de segurança" value={String(dashboard.logs.length)} />
            </section>

            <DataCard title="Vendas por mês (últimos 12 meses)">
              <div className="flex items-end gap-2 overflow-x-auto pb-2">
                {dashboard.metrics.monthly.map((m) => {
                  const heightPct = (m.total / maxMonthly) * 100;
                  return (
                    <div key={m.month} className="flex min-w-[44px] flex-col items-center gap-1">
                      <div className="flex h-32 w-full items-end justify-center">
                        <div
                          className="w-6 rounded-t bg-primary/80"
                          style={{ height: `${Math.max(4, heightPct)}%` }}
                          title={`${m.total} (${m.mensal} mensal · ${m.anual} anual)`}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">{m.month.slice(5)}</span>
                      <span className="font-mono text-[10px] text-foreground">{m.total}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Total de códigos liberados (vendas) por mês — passe o mouse para ver mensal vs anual.
              </p>
            </DataCard>
          </>
        )}

        {tab === "afiliados" && <AffiliateAdminSection forceOpen />}
        {tab === "geral" && (
        <>

        <ExpiringMonthlySection
          codes={dashboard.codes}
          onRenew={async (item) => {
            try {
              const result = await generateManualCode({
                data: {
                  email: item.email,
                  planCode: (item.plan_code as "mensal" | "anual") ?? "mensal",
                  deviceLimit: item.device_limit ?? 1,
                },
              });
              toast.success(`Renovado! Novo código ${result.accessCode} enviado para ${result.email}.`);
              await loadDashboard();
            } catch {
              toast.error("Falha ao renovar acesso.");
            }
          }}
          onDelete={async (item) => {
            if (!confirm(`Excluir a conta de ${item.email}? Ele não conseguirá mais entrar e verá a mensagem para renovar com o admin.`)) return;
            try {
              await removeAccount({ data: { accessId: item.id } });
              toast.success(`Conta ${item.email} encerrada. Ao tentar entrar, verá o convite de renovação.`);
              await loadDashboard();
            } catch {
              toast.error("Falha ao excluir conta.");
            }
          }}
        />


        <DataCard title="Definir data de validade manual (entrada do plano)">
          <p className="mb-3 text-xs text-muted-foreground">
            Escolha o cliente, o plano e a data exata em que o acesso deve expirar. O software desktop e o painel passam a respeitar essa data imediatamente.
          </p>
          <form
            className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_1fr_auto] md:items-end"
            onSubmit={async (event) => {
              event.preventDefault();
              const target = dashboard?.codes.find((c) => c.email === expiryEmail.trim().toLowerCase());
              if (!target) {
                toast.error("Cliente não encontrado com esse e-mail.");
                return;
              }
              if (!expiryDate) {
                toast.error("Informe a data de validade.");
                return;
              }
              try {
                await saveExpiry({
                  data: {
                    accessId: target.id,
                    expiresAt: expiryDate,
                    planCode: expiryPlan,
                  },
                });
                toast.success(`Validade de ${target.email} definida para ${expiryDate}.`);
                setExpiryEmail("");
                setExpiryDate("");
                await loadDashboard();
              } catch {
                toast.error("Falha ao definir a data de validade.");
              }
            }}
          >
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">E-mail do cliente</label>
              <Input
                list="admin-client-emails"
                value={expiryEmail}
                onChange={(e) => setExpiryEmail(e.target.value)}
                placeholder="cliente@email.com"
              />
              <datalist id="admin-client-emails">
                {(dashboard?.codes ?? []).map((c) => (
                  <option key={c.id} value={c.email} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Plano</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={expiryPlan}
                onChange={(e) => setExpiryPlan(e.target.value as "mensal" | "anual" | "teste")}
              >
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
                <option value="teste">Teste</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Expira em</label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
            <Button type="submit">Salvar data</Button>
          </form>
        </DataCard>

        <DataCard title="Registrar compra (envia senha provisória ao cliente)">

          <p className="mb-3 text-xs text-muted-foreground">
            Use ao receber o comprovante do Nubank no WhatsApp. O cliente recebe um e-mail de boas-vindas com uma senha provisória (válida por 7 dias e ligada a 1 dispositivo). Depois que ele acessar, libere a senha definitiva no formulário abaixo.
          </p>
          <form
            className="grid gap-3 md:grid-cols-[1.4fr_1fr_0.8fr_auto] md:items-end"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                setProvLoading(true);
                const result = await registerProvisional({
                  data: {
                    email: provEmail,
                    planCode: provPlan,
                    deviceLimit: Number(provDevices) || 1,
                  },
                });
                toast.success(`Senha provisória ${result.provisionalPassword} enviada para ${result.email}.`);
                setProvEmail("");
                await loadDashboard();
              } catch {
                toast.error("Não foi possível registrar a compra.");
              } finally {
                setProvLoading(false);
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="prov-email">E-mail do cliente</Label>
              <Input
                id="prov-email"
                type="email"
                value={provEmail}
                onChange={(e) => setProvEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prov-plan">Plano comprado</Label>
              <select
                id="prov-plan"
                value={provPlan}
                onChange={(e) => setProvPlan(e.target.value as "mensal" | "anual" | "vitalicia")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="mensal">Mensal (R$ 47)</option>
                <option value="anual">Anual (R$ 147)</option>
                <option value="vitalicia">Vitalícia (master, nunca expira)</option>
              </select>

            </div>
            <div className="space-y-2">
              <Label htmlFor="prov-devices">Dispositivos</Label>
              <Input
                id="prov-devices"
                type="number"
                min={1}
                max={1000}
                value={provDevices}
                onChange={(e) => setProvDevices(e.target.value)}
              />


            </div>
            <Button type="submit" disabled={provLoading}>
              {provLoading ? "Enviando..." : "Enviar senha provisória"}
            </Button>
          </form>
        </DataCard>

        <DataCard title="Liberar senha definitiva (conforme o plano)">
          <form
            className="grid gap-3 md:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_auto] md:items-end"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                setManualLoading(true);
                const result = await generateManualCode({
                  data: {
                    email: manualEmail,
                    planCode: manualPlan,
                    durationDays: manualDays ? Number(manualDays) : undefined,
                    deviceLimit: Number(manualDevices) || 1,
                  },
                });
                toast.success(`Código ${result.accessCode} enviado para ${result.email}.`);
                setManualEmail("");
                setManualDays("");
                await loadDashboard();
              } catch {
                toast.error("Não foi possível gerar o código manual.");
              } finally {
                setManualLoading(false);
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="manual-email">E-mail do cliente</Label>
              <Input
                id="manual-email"
                type="email"
                value={manualEmail}
                onChange={(event) => setManualEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-plan">Plano</Label>
              <select
                id="manual-plan"
                value={manualPlan}
                onChange={(e) => setManualPlan(e.target.value as "mensal" | "anual" | "vitalicia")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="mensal">Mensal (R$ 47 · 30 dias)</option>
                <option value="anual">Anual (R$ 147 · 365 dias)</option>
                <option value="vitalicia">Vitalícia (master · nunca expira)</option>
              </select>

            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-days">Dias (opcional)</Label>
              <Input
                id="manual-days"
                type="number"
                min={1}
                placeholder="Auto"
                value={manualDays}
                onChange={(event) => setManualDays(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-devices">Dispositivos</Label>
              <Input
                id="manual-devices"
                type="number"
                min={1}
                max={1000}
                value={manualDevices}
                onChange={(event) => setManualDevices(event.target.value)}
              />

            </div>
            <Button type="submit" disabled={manualLoading}>
              {manualLoading ? "Gerando..." : "Gerar e enviar"}
            </Button>
          </form>
        </DataCard>

        <DataCard title="Contas e códigos">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead>Disp.</TableHead>
                  <TableHead>Online</TableHead>
                  <TableHead>Sessão</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.codes.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-[180px] truncate">{item.email}</TableCell>
                    <TableCell className="font-mono">{item.access_code}</TableCell>
                    <TableCell>{item.plan_code ?? "-"}</TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>{formatDate(item.expires_at)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        defaultValue={item.device_limit ?? 1}
                        className="h-8 w-20"

                        onBlur={async (e) => {
                          const v = Number(e.target.value);
                          if (!v || v === (item.device_limit ?? 1)) return;
                          try {
                            await setDevices({ data: { accessId: item.id, deviceLimit: v } });
                            toast.success("Limite de dispositivos atualizado.");
                            await loadDashboard();
                          } catch {
                            toast.error("Falha ao atualizar limite.");
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const last = item.last_activity_at ? new Date(item.last_activity_at).getTime() : 0;
                        const online = last > 0 && Date.now() - last < 90_000;
                        return online ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                            offline
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {item.active_session_token ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium text-amber-500">em uso</span>
                          {item.active_session_ip && (
                            <span className="text-[10px] text-muted-foreground" title={item.active_session_user_agent ?? ""}>
                              IP: {item.active_session_ip}
                            </span>
                          )}
                          {item.active_session_user_agent && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[180px]" title={item.active_session_user_agent}>
                              {item.active_session_user_agent.slice(0, 28)}…
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">livre</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.affiliate_sale ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Afiliado: {item.affiliate_sale.affiliates?.full_name || item.affiliate_sale.customer_email}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Direta</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            const msg = buildClientMessage(item);
                            try {
                              await navigator.clipboard.writeText(msg);
                              toast.success("Mensagem copiada! Cole no WhatsApp do cliente.");
                            } catch {
                              window.prompt("Copie a mensagem abaixo:", msg);
                            }
                          }}
                        >
                          Copiar msg
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="font-semibold"
                          disabled={!item.active_session_token}
                          onClick={async () => {
                            try {
                              await resetSession({ data: { accessId: item.id } });
                              toast.success("Sessão liberada — cliente pode entrar em outro computador.");
                              await loadDashboard();
                            } catch {
                              toast.error("Falha ao liberar sessão.");
                            }
                          }}
                        >
                          Liberar p/ outro computador
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                          onClick={async () => {
                            const customMessage = window.prompt(
                              "Mensagem adicional (opcional) na advertência ao cliente:",
                              "",
                            );
                            if (customMessage === null) return;
                            try {
                              await warnDevice({
                                data: {
                                  accessId: item.id,
                                  kind: "warning",
                                  customMessage: customMessage || undefined,
                                },
                              });
                              toast.success("Advertência enviada por e-mail ao cliente.");
                            } catch {
                              toast.error("Falha ao enviar advertência.");
                            }
                          }}
                        >
                          Advertir
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={async () => {
                            const current = item.device_limit ?? 1;
                            try {
                              await setDevices({
                                data: { accessId: item.id, deviceLimit: current + 1 },
                              });
                              await warnDevice({
                                data: { accessId: item.id, kind: "add" },
                              });
                              toast.success(`Dispositivo adicionado (limite: ${current + 1}). Cliente avisado.`);
                              await loadDashboard();
                            } catch {
                              toast.error("Falha ao adicionar dispositivo.");
                            }
                          }}
                        >
                          + Dispositivo
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await warnDevice({ data: { accessId: item.id, kind: "allow" } });
                              toast.success("Acesso liberado e validade renovada para o cliente.");
                              await loadDashboard();
                            } catch {
                              toast.error("Falha ao notificar.");
                            }
                          }}
                        >
                          Permitir
                        </Button>


                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            if (!confirm(`Gerar um NOVO código para ${item.email}? O código atual deixará de funcionar.`)) return;
                            try {
                              const r = await regenerateCode({ data: { accessId: item.id } });
                              toast.success(`Novo código: ${r.accessCode}`);
                              await loadDashboard();
                            } catch {
                              toast.error("Falha ao atualizar código.");
                            }
                          }}
                        >
                          Atualizar código
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={item.status === "revoked"}
                          onClick={async () => {
                            try {
                              await revoke({ data: { accessId: item.id } });
                              toast.success("Acesso revogado.");
                              await loadDashboard();
                            } catch {
                              toast.error("Falha ao revogar.");
                            }
                          }}
                        >
                          Revogar
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            if (!confirm(`Excluir conta ${item.email}? Essa ação é permanente.`)) return;
                            try {
                              await removeAccount({ data: { accessId: item.id } });
                              toast.success("Conta excluída.");
                              await loadDashboard();
                            } catch {
                              toast.error("Falha ao excluir.");
                            }
                          }}
                        >
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DataCard>

        <DataCard title="Tentativas de acesso em outro dispositivo (bloqueadas)">
          {dashboard.deviceAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma tentativa registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail da conta</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Quando</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.deviceAttempts.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-[200px] truncate">{a.email}</TableCell>
                      <TableCell className="font-mono text-xs">{a.ip}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-xs">{a.user_agent}</TableCell>
                      <TableCell>{formatDate(a.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DataCard>

        <DataCard title="Últimos 50 registros de segurança">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.logs.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.event_type}</TableCell>
                    <TableCell>{item.ip ?? "-"}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{item.user_agent ?? "-"}</TableCell>
                    <TableCell>{item.success ? "Sucesso" : "Falha"}</TableCell>
                    <TableCell>{formatDate(item.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DataCard>
        </>
        )}
      </div>
    </main>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="rounded-lg bg-card/50 p-5">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
    </Card>
  );
}

function DataCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-lg bg-card/50 p-5">
      <h2 className="mb-4 text-lg font-medium text-foreground">{title}</h2>
      {children}
    </Card>
  );
}

function AffiliateDataCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-lg border-2 border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-card/50 p-5 shadow-[0_0_30px_-5px_rgba(245,158,11,0.15)]">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
        <h2 className="text-lg font-semibold text-amber-300">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildClientMessage(item: {
  email: string;
  access_code: string;
  expires_at: string;
  plan_code: string | null;
}) {
  const plano =
    item.plan_code === "anual"
      ? "Plano Anual"
      : item.plan_code === "vitalicia"
        ? "Plano Vitalício (nunca expira)"
        : "Plano Mensal";
  const isLifetime = item.plan_code === "vitalicia";
  const validade = isLifetime
    ? "Vitalício — acesso permanente"
    : `Válido até: ${formatDate(item.expires_at)}`;
  const loginUrl = `https://dtflexpro.com/login?email=${encodeURIComponent(
    item.email,
  )}&code=${encodeURIComponent(item.access_code)}`;

  return [
    "🚀 *Seu acesso ao DTFlexPRO está liberado!*",
    "",
    `📦 ${plano}`,
    `📧 E-mail: ${item.email}`,
    `🔑 Código de acesso: *${item.access_code}*`,
    `⏰ ${validade}`,
    "",
    "👉 Entre direto pelo link (já vem com seu código preenchido):",
    loginUrl,
    "",
    "💡 *Você não precisa clicar sempre no link.* Basta abrir o site *dtflexpro.com* e entrar na *Área do Cliente* — seu acesso fica salvo neste navegador.",
    "",
    "⚠️ Importante: o acesso é vinculado a *1 dispositivo*. Se precisar trocar, fale com a gente por aqui.",
    "",
    "Equipe DTFlexPRO 💛",
  ].join("\n");
}

const PLAN_CHECKOUT = {
  mensal: { price: "R$ 47", cadence: "30 dias", url: "https://nubank.com.br/cobranca/c4gqtgTcme3a2dkq" },
  anual: { price: "R$ 147", cadence: "365 dias", url: "https://nubank.com.br/cobranca/ZA14QIfuv63a2dkq" },
} as const;

function buildBillingMessage(item: {
  email: string;
  access_code: string;
  expires_at: string;
  plan_code: string | null;
}) {
  const expiresAt = new Date(item.expires_at);
  const now = Date.now();
  const diffDays = Math.ceil((expiresAt.getTime() - now) / 86400000);
  const status =
    diffDays < 0
      ? `*venceu há ${Math.abs(diffDays)} dia(s)*`
      : diffDays === 0
        ? "*vence hoje*"
        : `*vence em ${diffDays} dia(s)*`;
  const planKey: "mensal" | "anual" = item.plan_code === "anual" ? "anual" : "mensal";
  const plan = PLAN_CHECKOUT[planKey];
  const planLabel = planKey === "anual" ? "Plano Anual" : "Plano Mensal";
  return [
    "Olá! 👋 Aqui é da *DTFlexPRO*.",
    "",
    `Sua assinatura ${planLabel} (${item.email}) ${status}.`,
    `📅 Vencimento: ${formatDate(item.expires_at)}`,
    "",
    `💳 Para renovar e manter o acesso ativo, é só pagar *${plan.price}* pelo link abaixo:`,
    plan.url,
    "",
    `Assim que confirmar, libero seu acesso por mais ${plan.cadence}. 🚀`,
    "",
    "Qualquer dúvida, é só responder aqui.",
    "Equipe DTFlexPRO 💛",
  ].join("\n");
}

function ExpiringMonthlySection({
  codes,
  onRenew,
  onDelete,
}: {
  codes: DashboardPayload["codes"];
  onRenew: (item: DashboardPayload["codes"][number]) => Promise<void>;
  onDelete: (item: DashboardPayload["codes"][number]) => Promise<void>;
}) {
  const now = Date.now();
  const items = codes
    .filter((c) => (c.plan_code === "mensal" || c.plan_code === "anual") && c.status !== "revoked" && c.status !== "deleted")
    .map((c) => {
      const exp = new Date(c.expires_at).getTime();
      const days = Math.ceil((exp - now) / 86400000);
      return { ...c, days };
    })
    .filter((c) => c.days <= 7 && c.days >= -30)
    .sort((a, b) => a.days - b.days);

  const expired = items.filter((i) => i.days < 0).length;
  const today = items.filter((i) => i.days === 0).length;
  const soon = items.filter((i) => i.days > 0).length;

  return (
    <DataCard
      title={`Assinaturas a vencer / vencidas (${items.length})`}
    >
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-md bg-destructive/15 px-3 py-1 font-semibold text-destructive">
          Vencidas: {expired}
        </span>
        <span className="rounded-md bg-amber-500/20 px-3 py-1 font-semibold text-amber-300">
          Vencem hoje: {today}
        </span>
        <span className="rounded-md bg-amber-500/10 px-3 py-1 font-semibold text-amber-200">
          Próximos 7 dias: {soon}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma assinatura próxima do vencimento. 🎉
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isExpired = item.days < 0;
            const isUrgent = item.days <= 0;
            const msg = buildBillingMessage(item);
            const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
            const planLabel = item.plan_code === "anual" ? "Anual" : "Mensal";
            return (
              <div
                key={item.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                  isExpired
                    ? "border-destructive/60 bg-destructive/10"
                    : isUrgent
                      ? "border-amber-400/60 bg-amber-500/10"
                      : "border-amber-300/40 bg-amber-500/5"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isExpired && (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <span className="truncate font-semibold text-foreground">
                      {item.email}
                    </span>
                    <span className="rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {planLabel}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.access_code}
                    </span>
                  </div>
                  <p
                    className={`mt-1 text-xs font-semibold ${
                      isExpired
                        ? "text-destructive"
                        : isUrgent
                          ? "text-amber-300"
                          : "text-amber-200"
                    }`}
                  >
                    {isExpired
                      ? `Venceu há ${Math.abs(item.days)} dia(s)`
                      : item.days === 0
                        ? "Vence hoje"
                        : `Vence em ${item.days} dia(s)`}{" "}
                    · {formatDate(item.expires_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(msg);
                        toast.success("Mensagem de cobrança copiada!");
                      } catch {
                        window.prompt("Copie a mensagem:", msg);
                      }
                    }}
                  >
                    Copiar cobrança
                  </Button>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[oklch(0.62_0.19_150)] px-3 text-xs font-semibold text-white hover:bg-[oklch(0.56_0.19_150)]"
                    title="Enviar cobrança via WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Cobrar no WhatsApp
                  </a>
                  <Button
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-500"
                    onClick={async () => {
                      if (!confirm(`Renovar manualmente o acesso de ${item.email} (${planLabel})? Será gerado um novo código e enviado por e-mail.`)) return;
                      await onRenew(item);
                    }}
                  >
                    Renovar
                  </Button>
                  {isExpired && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDelete(item)}
                      title="Encerrar conta — ao tentar entrar, verá o convite para renovar"
                    >
                      Excluir conta
                    </Button>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      )}
    </DataCard>
  );
}

function AffiliateAdminSection({ forceOpen = false }: { forceOpen?: boolean }) {
  const fetchData = useServerFn(getAffiliateAdminData);
  const activate = useServerFn(activateAffiliateSale);
  const markPaid = useServerFn(markAffiliateSalePaid);
  const removeSale = useServerFn(deleteAffiliateSale);
  const [data, setData] = useState<{ affiliates: any[]; sales: any[] } | null>(null);

  async function load() {
    try {
      const d = await fetchData();
      setData(d as any);
    } catch {
      /* admin não logado ainda */
    }
  }
  useEffect(() => { load(); }, []);

  const [openState, setOpenState] = useState(false);
  const open = forceOpen || openState;

  if (!data) return null;
  const pendingSales = data.sales.filter((s) => s.status === "pending");
  const activatedSales = data.sales.filter((s) => s.status === "activated" || s.status === "paid");
  const paidSales = data.sales.filter((s) => s.status === "paid");
  const awaitingPay = data.sales.filter((s) => s.status === "activated");
  const totalAwaitingCents = awaitingPay.reduce((sum, s) => sum + (s.commission_cents ?? 0), 0);
  const totalPaidCents = paidSales.reduce((sum, s) => sum + (s.commission_cents ?? 0), 0);
  const totalSalesValueCents = activatedSales.length * 14700; // anual R$ 147

  return (
    <Card className="rounded-lg border-2 border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-card/50 p-0 shadow-[0_0_30px_-5px_rgba(245,158,11,0.15)] overflow-hidden">
      <button
        type="button"
        onClick={() => !forceOpen && setOpenState((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 hover:bg-amber-500/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {!forceOpen && (open ? <ChevronDown className="h-5 w-5 text-amber-300" /> : <ChevronRight className="h-5 w-5 text-amber-300" />)}
          <Users className="h-5 w-5 text-amber-300" />
          <span className="text-lg font-semibold text-amber-300">Afiliados</span>
          <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
            {data.affiliates.length} cadastrados
          </span>
        </div>
        <div className="hidden md:flex items-center gap-4 text-xs">
          <div className="text-right">
            <div className="text-muted-foreground">Vendido (ativadas)</div>
            <div className="font-mono font-bold text-amber-200">{(totalSalesValueCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground">A pagar PIX</div>
            <div className="font-mono font-bold text-sky-300">{(totalAwaitingCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground">Já pago</div>
            <div className="font-mono font-bold text-emerald-300">{(totalPaidCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
          </div>
          {pendingSales.length > 0 && (
            <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-[11px] font-bold text-red-300 animate-pulse">
              {pendingSales.length} aguardando ativação
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-amber-500/20 bg-background/40 p-4">

      <AffiliateDataCard title={`Vendas de afiliados — pendentes de ativação (${pendingSales.length})`}>
        {pendingSales.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma venda pendente.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-amber-500/20 hover:bg-transparent">
                  <TableHead className="text-amber-200">Afiliado</TableHead>
                  <TableHead className="text-amber-200">Cliente</TableHead>
                  <TableHead className="text-amber-200">E-mail</TableHead>
                  <TableHead className="text-amber-200">WhatsApp</TableHead>
                  <TableHead className="text-amber-200">PIX (obs)</TableHead>
                  <TableHead className="text-amber-200">Registrada</TableHead>
                  <TableHead className="text-right text-amber-200">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingSales.map((s) => (
                  <TableRow key={s.id} className="bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/10">
                    <TableCell className="text-xs">
                      <div className="inline-flex items-center gap-2">
                        <span className="font-bold text-amber-300">{s.affiliates?.full_name}</span>
                        <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">AFILIADO</span>
                      </div>
                      <div className="text-muted-foreground">@{s.affiliates?.slug}</div>
                    </TableCell>
                    <TableCell>{s.customer_name || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{s.customer_email}</TableCell>
                    <TableCell className="text-xs">{s.customer_whatsapp || "-"}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs">{s.pix_proof_note || "-"}</TableCell>
                    <TableCell className="text-xs">{formatDate(s.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-500 text-white"
                          onClick={async () => {
                            try {
                              const r: any = await activate({ data: { saleId: s.id } });
                              if (r.accessCode) {
                                toast.success(`Acesso liberado: ${r.accessCode} → ${r.email}`);
                              } else {
                                toast.success("Já estava ativada.");
                              }
                              await load();
                            } catch {
                              toast.error("Falha ao ativar.");
                            }
                          }}
                        >
                          Ativar (Plano Anual)
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            if (!confirm("Excluir venda?")) return;
                            try {
                              await removeSale({ data: { saleId: s.id } });
                              toast.success("Removida.");
                              await load();
                            } catch {
                              toast.error("Falha.");
                            }
                          }}
                        >
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AffiliateDataCard>

      <AffiliateDataCard title={`Vendas de afiliados — ativadas / pagas (${activatedSales.length})`}>
        {activatedSales.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-amber-500/20 hover:bg-transparent">
                  <TableHead className="text-amber-200">Afiliado</TableHead>
                  <TableHead className="text-amber-200">Cliente</TableHead>
                  <TableHead className="text-amber-200">Comissão</TableHead>
                  <TableHead className="text-amber-200">Status</TableHead>
                  <TableHead className="text-amber-200">Ativada</TableHead>
                  <TableHead className="text-right text-amber-200">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activatedSales.map((s) => (
                  <TableRow key={s.id} className="bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/10">
                    <TableCell className="text-xs">
                      <div className="inline-flex items-center gap-2">
                        <span className="font-bold text-amber-300">{s.affiliates?.full_name}</span>
                        <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">AFILIADO</span>
                      </div>
                      <div className="text-muted-foreground">PIX: {s.affiliates?.pix_key || "não informado"}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{s.customer_name || s.customer_email}</div>
                      <div className="text-muted-foreground">{s.customer_email}</div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {((s.commission_cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.status === "paid" ? "bg-emerald-500/20 text-emerald-300" : "bg-sky-500/20 text-sky-300"}`}>
                        {s.status === "paid" ? "PAGA" : "Aguardando pagar PIX"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{s.activated_at ? formatDate(s.activated_at) : "-"}</TableCell>
                    <TableCell className="text-right">
                      {s.status !== "paid" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
                          onClick={async () => {
                            try {
                              await markPaid({ data: { saleId: s.id } });
                              toast.success("Marcada como paga.");
                              await load();
                            } catch {
                              toast.error("Falha.");
                            }
                          }}
                        >
                          Marcar PIX pago
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AffiliateDataCard>

      <AffiliateDataCard title={`Afiliados cadastrados (${data.affiliates.length})`}>
        {data.affiliates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum afiliado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-amber-500/20 hover:bg-transparent">
                  <TableHead className="text-amber-200">Afiliado</TableHead>
                  <TableHead className="text-amber-200">Contato</TableHead>
                  <TableHead className="text-amber-200">PIX</TableHead>
                  <TableHead className="text-amber-200 text-right">Vendas ativadas</TableHead>
                  <TableHead className="text-amber-200 text-right">Em aberto</TableHead>
                  <TableHead className="text-amber-200 text-right">Já pago</TableHead>
                  <TableHead className="text-amber-200 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.affiliates.map((a) => {
                  const mySales = data.sales.filter((s) => s.affiliate_id === a.id);
                  const myOpen = mySales.filter((s) => s.status === "activated");
                  const myPaid = mySales.filter((s) => s.status === "paid");
                  const myActivated = mySales.filter((s) => s.status === "activated" || s.status === "paid");
                  const openCents = myOpen.reduce((sum, s) => sum + (s.commission_cents ?? 0), 0);
                  const paidCents = myPaid.reduce((sum, s) => sum + (s.commission_cents ?? 0), 0);
                  return (
                  <TableRow key={a.id} className="bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/10">
                    <TableCell>
                      <div className="font-bold text-amber-300">{a.full_name}</div>
                      <div className="font-mono text-xs text-muted-foreground">/{a.slug}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{a.email}</div>
                      <div className="text-muted-foreground">{a.whatsapp || "-"}</div>
                    </TableCell>
                    <TableCell className="text-xs">{a.pix_key || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-amber-200">{myActivated.length}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono font-bold ${openCents > 0 ? "text-sky-300" : "text-muted-foreground"}`}>
                        {(openCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-300">
                      {(paidCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        disabled={myOpen.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
                        onClick={async () => {
                          if (!confirm(`Dar baixa em ${myOpen.length} comissão(ões) de ${a.full_name} — total ${(openCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}?`)) return;
                          try {
                            await Promise.all(myOpen.map((s) => markPaid({ data: { saleId: s.id } })));
                            toast.success(`Baixa registrada em ${myOpen.length} comissão(ões).`);
                            await load();
                          } catch {
                            toast.error("Falha ao dar baixa.");
                          }
                        }}
                      >
                        Dar baixa ({myOpen.length})
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </AffiliateDataCard>
        </div>
      )}
    </Card>
  );
}


function TrialSignupsSection({
  codes,
  onActivate,
  onDelete,
}: {
  codes: DashboardPayload["codes"];
  onActivate: (item: DashboardPayload["codes"][number], planCode: "mensal" | "anual") => Promise<void>;
  onDelete: (item: DashboardPayload["codes"][number]) => Promise<void>;
}) {
  const now = Date.now();
  const sorted = [...codes].sort(
    (a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime(),
  );

  if (sorted.length === 0) {
    return (
      <Card className="rounded-lg bg-card/70 p-6 backdrop-blur">
        <p className="text-sm text-muted-foreground">Nenhum cadastro de teste ainda.</p>
      </Card>
    );
  }

  function daysLeft(expiresAt: string) {
    return Math.ceil((new Date(expiresAt).getTime() - now) / (24 * 60 * 60 * 1000));
  }

  const allEmails = sorted.map((c) => c.email).join("\n");

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast.success(label);
    }
  }

  return (
    <Card data-allow-copy className="rounded-lg bg-card/70 p-6 backdrop-blur select-text">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Cadastros de teste (7 dias)</h2>
          <p className="text-sm text-muted-foreground">
            Total: {sorted.length}. Ative manualmente o plano mensal ou anual quando o cliente pagar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => copyText(allEmails, `${sorted.length} e-mails copiados`)}
          >
            Copiar todos os e-mails
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copyText(sorted.map((c) => c.email).join(", "), "E-mails copiados (separados por vírgula)")}
          >
            Copiar separados por vírgula
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              copyText(
                ["email,whatsapp,codigo,criado,expira"]
                  .concat(
                    sorted.map((c) =>
                      [
                        c.email,
                        c.phone ?? "",
                        c.access_code,
                        new Date(c.created_at).toLocaleDateString("pt-BR"),
                        new Date(c.expires_at).toLocaleDateString("pt-BR"),
                      ].join(","),
                    ),
                  )
                  .join("\n"),
                "Lista completa copiada (CSV)",
              )
            }
          >
            Copiar lista (CSV)
          </Button>
        </div>
      </div>
      <textarea
        readOnly
        value={allEmails}
        onFocus={(e) => e.currentTarget.select()}
        className="mb-4 h-24 w-full rounded-md border border-border/60 bg-background/60 p-2 font-mono text-xs text-foreground"
      />

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead>Expira em</TableHead>
              <TableHead>IP / Dispositivo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((item) => {
              const days = daysLeft(item.expires_at);
              const expired = days <= 0;
              const phone = (item.phone ?? "").replace(/\D/g, "");
              const waNumber = phone.length >= 10 ? (phone.startsWith("55") ? phone : `55${phone}`) : "";
              const waMsg = encodeURIComponent(
                `Olá! Aqui é da DTFLEXPRO 👋 Vi seu teste grátis (${item.email}). Posso liberar seu plano completo? Mensal R$47 ou Anual R$47/mês. Me avisa qual quer!`,
              );
              return (
                <TableRow key={item.id} className={expired ? "bg-red-500/5" : ""}>
                  <TableCell className="font-mono text-xs">
                    <button
                      type="button"
                      title="Copiar e-mail"
                      className="text-left underline decoration-dotted underline-offset-2 hover:text-primary"
                      onClick={() => copyText(item.email, "E-mail copiado")}
                    >
                      {item.email}
                    </button>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.phone ?? "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{item.access_code}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {expired ? (
                      <span className="rounded bg-red-500/20 px-2 py-0.5 font-semibold text-red-300">
                        Expirado
                      </span>
                    ) : (
                      <span className={`rounded px-2 py-0.5 font-semibold ${days <= 2 ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                        {days} dia{days === 1 ? "" : "s"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-[10px] text-muted-foreground max-w-[200px] truncate">
                    {item.active_session_ip ?? "-"}
                    <br />
                    {(item.active_session_user_agent ?? "").slice(0, 40)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {waNumber && (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-7 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                        >
                          <a
                            href={`https://wa.me/${waNumber}?text=${waMsg}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="h-3 w-3" />
                            WhatsApp
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="h-7 bg-emerald-500 text-black hover:bg-emerald-400"
                        onClick={() => onActivate(item, "mensal")}
                      >
                        Ativar mensal
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 bg-amber-400 text-black hover:bg-amber-300"
                        onClick={() => onActivate(item, "anual")}
                      >
                        Ativar anual
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7"
                        onClick={() => onDelete(item)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
