import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2,
  Download,
  Loader2,
  MessageCircle,
  RefreshCw,
  Trash2,
  Eye,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  deleteHalftoneOrder,
  getHalftoneImageUrl,
  listHalftoneOrders,
  markHalftoneOrderDelivered,
  markHalftoneOrderPaidManual,
} from "@/lib/halftone-orders.functions";

type Order = {
  id: string;
  order_code: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  notes: string | null;
  amount: number;
  payment_status: "pending" | "paid" | "failed";
  delivery_status: "aguardando_pagamento" | "aguardando_envio" | "enviado";
  image_path: string;
  infinitepay_transaction_id: string | null;
  paid_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "aguardando_envio", label: "A enviar" },
  { key: "aguardando_pagamento", label: "Aguardando pgto" },
  { key: "enviado", label: "Enviados" },
] as const;

function statusBadge(o: Order) {
  if (o.delivery_status === "enviado")
    return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">Enviado</span>;
  if (o.delivery_status === "aguardando_envio")
    return <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Pago — A enviar</span>;
  return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Aguardando pgto</span>;
}

function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

export function HalftoneOrdersAdmin() {
  const listFn = useServerFn(listHalftoneOrders);
  const urlFn = useServerFn(getHalftoneImageUrl);
  const deliveredFn = useServerFn(markHalftoneOrderDelivered);
  const paidFn = useServerFn(markHalftoneOrderPaidManual);
  const deleteFn = useServerFn(deleteHalftoneOrder);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("todos");
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFn();
      setOrders((res.orders ?? []) as Order[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    if (filter === "todos") return orders;
    return orders.filter((o) => o.delivery_status === filter);
  }, [orders, filter]);

  const stats = useMemo(() => {
    const aguardando = orders.filter((o) => o.delivery_status === "aguardando_envio").length;
    const enviados = orders.filter((o) => o.delivery_status === "enviado").length;
    const pendentes = orders.filter((o) => o.delivery_status === "aguardando_pagamento").length;
    return { aguardando, enviados, pendentes };
  }, [orders]);

  async function handleDownload(o: Order) {
    setBusyId(o.id);
    try {
      const { url } = await urlFn({ data: { id: o.id } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkPaid(o: Order) {
    if (!confirm(`Confirmar pagamento manual do pedido ${o.order_code}?`)) return;
    setBusyId(o.id);
    try {
      await paidFn({ data: { id: o.id } });
      toast.success("Marcado como pago");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelivered(o: Order) {
    setBusyId(o.id);
    try {
      await deliveredFn({ data: { id: o.id } });
      toast.success("Pedido marcado como enviado");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(o: Order) {
    if (!confirm(`Excluir pedido ${o.order_code}? Esta ação não pode ser desfeita.`)) return;
    setBusyId(o.id);
    try {
      await deleteFn({ data: { id: o.id } });
      toast.success("Pedido excluído");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="rounded-lg bg-card/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="rounded-md bg-amber-500/15 px-3 py-1 font-semibold text-amber-300">
              A enviar: {stats.aguardando}
            </span>
            <span className="rounded-md bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-400">
              Enviados: {stats.enviados}
            </span>
            <span className="rounded-md bg-muted px-3 py-1 font-semibold text-muted-foreground">
              Aguardando pgto: {stats.pendentes}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden rounded-lg bg-card/50">
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {loading ? "Carregando..." : "Nenhum pedido encontrado."}
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((o) => (
              <div key={o.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.5fr_2fr_auto] md:items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-foreground">{o.order_code}</span>
                    {statusBadge(o)}
                  </div>
                  <p className="text-sm font-semibold text-foreground">{o.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.customer_phone} · {o.customer_email}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(o.created_at).toLocaleString("pt-BR")}
                  </p>
                  {o.notes && (
                    <p className="mt-1 rounded-md bg-background/60 p-2 text-xs italic text-muted-foreground">
                      “{o.notes}”
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(o)}
                    disabled={busyId === o.id}
                  >
                    <Eye className="h-4 w-4" /> Ver imagem
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(o)}
                    disabled={busyId === o.id}
                  >
                    <Download className="h-4 w-4" /> Baixar
                  </Button>
                  <a
                    href={waLink(
                      o.customer_phone,
                      `Olá ${o.customer_name.split(" ")[0]}! Sou da DTFLEXPRO. Seu pedido ${o.order_code} está pronto, vou te enviar agora.`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1 rounded-md bg-[oklch(0.62_0.19_150)] px-3 text-xs font-semibold text-white hover:bg-[oklch(0.56_0.19_150)]"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  {o.payment_status !== "paid" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleMarkPaid(o)}
                      disabled={busyId === o.id}
                    >
                      Marcar como pago
                    </Button>
                  )}
                  {o.delivery_status !== "enviado" && o.payment_status === "paid" && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-500"
                      onClick={() => handleDelivered(o)}
                      disabled={busyId === o.id}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Marcar enviado
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(o)}
                    disabled={busyId === o.id}
                    title="Excluir pedido"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
