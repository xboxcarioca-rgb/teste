import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Bell, Check, Copy, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { decidirPedido, listarPedidos } from "@/lib/access.functions";

interface Pedido {
  id: string;
  email: string;
  user_agent: string | null;
  ip: string | null;
  requested_at: string;
  expires_at: string;
  clienteExistente: {
    status: string;
    expires_at: string;
    plan_code: string | null;
  } | null;
}

const INTERVALO_MS = 5000;

/** Traduz o user-agent em algo legível: "Chrome / Windows". */
function navegadorLegivel(ua: string | null): string {
  if (!ua) return "Dispositivo desconhecido";
  const navegador =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) && !/Chrome/.test(ua) ? "Safari"
    : /Firefox\//.test(ua) ? "Firefox"
    : "Navegador";

  const sistema =
    /Windows/.test(ua) ? "Windows"
    : /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Android/.test(ua) ? "Android"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "";

  return sistema ? `${navegador} / ${sistema}` : navegador;
}

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seg = Math.max(0, Math.floor(diff / 1000));
  if (seg < 60) return `há ${seg} segundos`;
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${min} minuto${min > 1 ? "s" : ""}`;
  const h = Math.floor(min / 60);
  return `há ${h} hora${h > 1 ? "s" : ""}`;
}

function dataCurta(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso));
}

export function PedidosDeAcesso() {
  const listar = useServerFn(listarPedidos);
  const decidir = useServerFn(decidirPedido);

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [tabelaAusente, setTabelaAusente] = useState(false);
  const [erroBanco, setErroBanco] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Pedido em edição (abre o seletor de plano)
  const [editando, setEditando] = useState<string | null>(null);
  const [plano, setPlano] = useState<"mensal" | "anual" | "vitalicia" | "custom">("mensal");
  const [dias, setDias] = useState("30");
  const [dispositivos, setDispositivos] = useState("1");
  const [processando, setProcessando] = useState<string | null>(null);

  // Código gerado após liberar
  const [liberado, setLiberado] = useState<{ email: string; code: string; expiresAt: string } | null>(null);

  const carregar = useCallback(async () => {
    try {
      const resultado = await listar();
      setPedidos((resultado.requests ?? []) as Pedido[]);
      setTabelaAusente(Boolean(resultado.tabelaAusente));
      setErroBanco(resultado.erro ?? null);
    } catch {
      /* painel continua funcionando mesmo se a listagem falhar */
    } finally {
      setCarregando(false);
    }
  }, [listar]);

  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(), INTERVALO_MS);
    return () => clearInterval(t);
  }, [carregar]);

  const total = pedidos.length;

  const diasDoPlano = useMemo(() => {
    if (plano === "anual") return 365;
    if (plano === "vitalicia") return 36500;
    if (plano === "custom") return Number(dias) || 30;
    return 30;
  }, [plano, dias]);

  async function liberar(pedido: Pedido) {
    try {
      setProcessando(pedido.id);
      const resultado = await decidir({
        data: {
          requestId: pedido.id,
          action: "approve",
          planCode: plano === "custom" ? "mensal" : plano,
          durationDays: diasDoPlano,
          deviceLimit: Number(dispositivos) || 1,
        },
      });
      if (resultado.denied) return;
      setLiberado({
        email: resultado.email!,
        code: resultado.accessCode!,
        expiresAt: resultado.expiresAt!,
      });
      setEditando(null);
      toast.success(`Acesso liberado para ${resultado.email}`);
      await carregar();
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : String(erro);
      toast.error(`Não foi possível liberar: ${msg}`);
      console.error("[admin] decidirPedido", erro);
    } finally {
      setProcessando(null);
    }
  }

  async function recusar(pedido: Pedido) {
    if (!confirm(`Recusar o pedido de ${pedido.email}?`)) return;
    try {
      setProcessando(pedido.id);
      await decidir({ data: { requestId: pedido.id, action: "deny" } });
      toast.success("Pedido recusado");
      setEditando(null);
      await carregar();
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : String(erro);
      toast.error(`Não foi possível recusar: ${msg}`);
    } finally {
      setProcessando(null);
    }
  }

  function copiarCodigo(codigo: string) {
    navigator.clipboard
      .writeText(codigo)
      .then(() => toast.success("Código copiado"))
      .catch(() => toast.error("Não foi possível copiar"));
  }

  return (
    <Card className="rounded-lg border-amber-400/30 bg-amber-400/5 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-medium text-foreground">
          <Bell className={`h-5 w-5 ${total > 0 ? "text-amber-400" : "text-muted-foreground"}`} />
          Pedidos de acesso
          {total > 0 && (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-black">
              {total}
            </span>
          )}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => void carregar()} disabled={carregando}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {tabelaAusente && (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">A tabela de pedidos ainda não existe no banco</p>
              <p className="mt-1 text-amber-100/80">
                Rode a migração <code>supabase/migrations/20261024190000_access_requests.sql</code>{" "}
                no SQL Editor do Supabase. {erroBanco ? `Detalhe: ${erroBanco}` : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {liberado && (
        <div className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
          <p className="text-sm font-semibold text-emerald-100">
            Acesso liberado para {liberado.email}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded bg-black/30 px-3 py-1.5 font-mono text-lg tracking-widest text-emerald-200">
              {liberado.code}
            </code>
            <Button size="sm" variant="outline" onClick={() => copiarCodigo(liberado.code)}>
              <Copy className="mr-1 h-4 w-4" />
              Copiar
            </Button>
            <span className="text-xs text-emerald-200/70">
              válido até {dataCurta(liberado.expiresAt)}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setLiberado(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-emerald-200/60">
            O cliente entra sozinho assim que a página dele atualizar. O código também foi
            enviado por e-mail (se o RESEND_API_KEY estiver configurado).
          </p>
        </div>
      )}

      {total === 0 && !tabelaAusente && (
        <p className="text-sm text-muted-foreground">
          Nenhum pedido aguardando. Quando um cliente informar o e-mail na tela de entrada, o
          pedido aparece aqui em até 5 segundos.
        </p>
      )}

      <div className="space-y-3">
        {pedidos.map((pedido) => {
          const aberto = editando === pedido.id;
          const ocupado = processando === pedido.id;
          const cliente = pedido.clienteExistente;

          return (
            <div key={pedido.id} className="rounded-md border border-border bg-card/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{pedido.email}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {navegadorLegivel(pedido.user_agent)} · {pedido.ip ?? "IP desconhecido"} ·{" "}
                    {tempoRelativo(pedido.requested_at)}
                  </p>
                  <p className="mt-1 text-xs">
                    {cliente ? (
                      <span className="text-emerald-300">
                        ● Cliente existente · {cliente.plan_code ?? "sem plano"} · vence{" "}
                        {dataCurta(cliente.expires_at)}
                        {cliente.status !== "active" ? ` · status ${cliente.status}` : ""}
                      </span>
                    ) : (
                      <span className="text-sky-300">◆ E-mail novo (sem cadastro)</span>
                    )}
                  </p>
                </div>

                {!aberto && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setEditando(pedido.id)} disabled={ocupado}>
                      <Check className="mr-1 h-4 w-4" />
                      Liberar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void recusar(pedido)}
                      disabled={ocupado}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Recusar
                    </Button>
                  </div>
                )}
              </div>

              {aberto && (
                <div className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-4 md:items-end">
                  <div className="space-y-1">
                    <Label htmlFor={`plano-${pedido.id}`}>Plano</Label>
                    <select
                      id={`plano-${pedido.id}`}
                      value={plano}
                      onChange={(e) => setPlano(e.target.value as typeof plano)}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="mensal">Mensal (30 dias)</option>
                      <option value="anual">Anual (365 dias)</option>
                      <option value="vitalicia">Vitalícia</option>
                      <option value="custom">Personalizado</option>
                    </select>
                  </div>

                  {plano === "custom" && (
                    <div className="space-y-1">
                      <Label htmlFor={`dias-${pedido.id}`}>Dias</Label>
                      <Input
                        id={`dias-${pedido.id}`}
                        type="number"
                        min={1}
                        value={dias}
                        onChange={(e) => setDias(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label htmlFor={`disp-${pedido.id}`}>Dispositivos</Label>
                    <Input
                      id={`disp-${pedido.id}`}
                      type="number"
                      min={1}
                      max={20}
                      value={dispositivos}
                      onChange={(e) => setDispositivos(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void liberar(pedido)} disabled={ocupado}>
                      {ocupado ? "Liberando..." : "Confirmar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditando(null)}
                      disabled={ocupado}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
