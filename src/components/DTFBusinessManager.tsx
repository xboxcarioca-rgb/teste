import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Download,
  FileBarChart,
  Gauge,
  Menu,
  PackagePlus,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Section =
  | "dashboard"
  | "production"
  | "orders"
  | "customers"
  | "inventory"
  | "financial"
  | "taxes"
  | "reports"
  | "settings"
  | "users";
type Status = "Recebido" | "Aguardando" | "Em produção" | "Conferência" | "Pronto" | "Entregue";
type Customer = { id: string; name: string; company: string; phone: string; email: string };
type Order = {
  id: string;
  number: string;
  customer: string;
  product: string;
  total: number;
  meters: number;
  status: Status;
  due: string;
};
type StockItem = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  minimum: number;
  cost: number;
};
type Transaction = {
  id: string;
  description: string;
  category: string;
  type: "Entrada" | "Saída";
  amount: number;
  date: string;
};
type Tax = { id: string; name: string; rate: number; active: boolean };
type TeamUser = { id: string; name: string; email: string; role: string; active: boolean };
type SettingsData = {
  company: string;
  cnpj: string;
  phone: string;
  filmCost: number;
  inkCost: number;
  hourlyRate: number;
  margin: number;
};
type Store = {
  customers: Customer[];
  orders: Order[];
  inventory: StockItem[];
  transactions: Transaction[];
  taxes: Tax[];
  users: TeamUser[];
  settings: SettingsData;
};

const emptyStore: Store = {
  customers: [],
  orders: [],
  inventory: [],
  transactions: [],
  taxes: [],
  users: [],
  settings: {
    company: "",
    cnpj: "",
    phone: "",
    filmCost: 0,
    inkCost: 0,
    hourlyRate: 0,
    margin: 0,
  },
};

const nav = [
  ["dashboard", "Visão geral", Gauge],
  ["production", "Produção", Printer],
  ["orders", "Pedidos", ShoppingBag],
  ["customers", "Clientes", Users],
  ["inventory", "Estoque", Boxes],
  ["financial", "Financeiro", WalletCards],
  ["taxes", "Impostos", ReceiptText],
  ["reports", "Relatórios", FileBarChart],
  ["settings", "Configurações", Settings],
  ["users", "Usuários", ShieldCheck],
] as const;

const statusTone: Record<Status, string> = {
  Recebido: "bg-sky-500/15 text-sky-300",
  Aguardando: "bg-amber-500/15 text-amber-300",
  "Em produção": "bg-violet-500/15 text-violet-300",
  Conferência: "bg-cyan-500/15 text-cyan-300",
  Pronto: "bg-emerald-500/15 text-emerald-300",
  Entregue: "bg-teal-500/15 text-teal-300",
};
const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function storageKey(email: string) {
  return `dtflexpro-management-v2:${email.trim().toLowerCase()}`;
}

function readStore(email: string): Store {
  if (typeof window === "undefined") return emptyStore;
  try {
    const value = window.localStorage.getItem(storageKey(email));
    return value ? (JSON.parse(value) as Store) : emptyStore;
  } catch {
    return emptyStore;
  }
}

export default function DTFBusinessManager({
  onClose,
  accountEmail,
}: {
  onClose: () => void;
  accountEmail: string;
}) {
  const [store, setStore] = useState<Store>(emptyStore);
  const [section, setSection] = useState<Section>("dashboard");
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStore(readStore(accountEmail));
    setReady(true);
  }, [accountEmail]);
  useEffect(() => {
    if (ready) window.localStorage.setItem(storageKey(accountEmail), JSON.stringify(store));
  }, [accountEmail, ready, store]);

  const metrics = useMemo(() => {
    const revenue = store.transactions
      .filter((item) => item.type === "Entrada")
      .reduce((sum, item) => sum + item.amount, 0);
    const costs = store.transactions
      .filter((item) => item.type === "Saída")
      .reduce((sum, item) => sum + item.amount, 0);
    const taxRate = store.taxes
      .filter((item) => item.active)
      .reduce((sum, item) => sum + item.rate, 0);
    const taxes = (revenue * taxRate) / 100;
    return {
      revenue,
      costs,
      taxes,
      profit: revenue - costs - taxes,
      meters: store.orders.reduce((sum, item) => sum + item.meters, 0),
      low: store.inventory.filter((item) => item.stock <= item.minimum).length,
    };
  }, [store]);

  const setData = <K extends keyof Store>(key: K, value: Store[K]) =>
    setStore((current) => ({ ...current, [key]: value }));
  const activeLabel = nav.find(([id]) => id === section)?.[1] ?? "Gestão DTF";

  return (
    <div className="fixed inset-0 z-[110] flex min-w-0 overflow-hidden bg-background pb-[env(safe-area-inset-bottom)] text-foreground">
      {menuOpen && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-20 bg-background/80 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[min(18rem,88vw)] flex-col border-r border-border bg-card transition-transform lg:static lg:w-64 lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-border px-4">
          <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <Printer className="size-5" />
          </div>
          <div>
            <p className="font-black">DTFLEXPRO</p>
            <p className="text-xs text-muted-foreground">Gestão de produção</p>
            <p className="max-w-40 truncate text-[10px] text-amber-400">{accountEmail}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden"
            onClick={() => setMenuOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Áreas da gestão">
          {nav.map(([id, label, Icon]) => (
            <Button
              key={id}
              variant={section === id ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => {
                setSection(id);
                setMenuOpen(false);
                setFormOpen(false);
              }}
            >
              <Icon className="size-4" />
              {label}
              {id === "inventory" && metrics.low > 0 && (
                <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-[10px] text-destructive-foreground">
                  {metrics.low}
                </span>
              )}
            </Button>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <div className="rounded-md bg-secondary p-3">
            <p className="text-xs text-muted-foreground">Metros produzidos</p>
            <p className="mt-1 text-xl font-black">{metrics.meters.toFixed(1)} m</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="grid min-h-16 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background/95 px-2 py-2 backdrop-blur sm:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0">
            <p className="truncate font-bold">{activeLabel}</p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Controle operacional DTF em tempo real
            </p>
          </div>
          <div className="relative ml-auto hidden w-64 md:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar registros"
              className="pl-9"
            />
          </div>
          <Button className="h-11 shrink-0 bg-amber-400 px-3 text-black hover:bg-amber-300 sm:h-9" onClick={onClose}>
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Voltar para ferramenta</span>
            <span className="sm:hidden">Voltar</span>
          </Button>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3 sm:p-6">
          {section === "dashboard" && (
            <Dashboard store={store} metrics={metrics} onSection={setSection} />
          )}
          {section === "production" && (
            <Production
              orders={store.orders}
              setOrders={(orders) => setData("orders", orders)}
              search={search}
            />
          )}
          {section === "orders" && (
            <Orders
              orders={store.orders}
              customers={store.customers}
              search={search}
              formOpen={formOpen}
              setFormOpen={setFormOpen}
              setOrders={(orders) => setData("orders", orders)}
            />
          )}
          {section === "customers" && (
            <Customers
              customers={store.customers}
              orders={store.orders}
              search={search}
              formOpen={formOpen}
              setFormOpen={setFormOpen}
              setCustomers={(customers) => setData("customers", customers)}
            />
          )}
          {section === "inventory" && (
            <Inventory
              items={store.inventory}
              search={search}
              formOpen={formOpen}
              setFormOpen={setFormOpen}
              setItems={(inventory) => setData("inventory", inventory)}
            />
          )}
          {section === "financial" && (
            <Financial
              items={store.transactions}
              metrics={metrics}
              formOpen={formOpen}
              setFormOpen={setFormOpen}
              setItems={(transactions) => setData("transactions", transactions)}
            />
          )}
          {section === "taxes" && (
            <Taxes
              taxes={store.taxes}
              revenue={metrics.revenue}
              setTaxes={(taxes) => setData("taxes", taxes)}
            />
          )}
          {section === "reports" && <Reports store={store} metrics={metrics} />}
          {section === "settings" && (
            <SettingsPanel
              value={store.settings}
              setValue={(settings) => setData("settings", settings)}
              reset={() => setStore(emptyStore)}
            />
          )}
          {section === "users" && (
            <Team users={store.users} setUsers={(users) => setData("users", users)} />
          )}
        </main>
      </div>
    </div>
  );
}

function PageTitle({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 border-b border-border pb-5 sm:flex-row sm:items-end">
      <div>
        <h1 className="text-xl font-black sm:text-2xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      </div>
      {action}
    </div>
  );
}
function Stat({
  label,
  value,
  icon: Icon,
  tone = "text-primary",
}: {
  label: string;
  value: string;
  icon: typeof Gauge;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
        <Icon className={`size-5 ${tone}`} />
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  );
}
function Badge({ status }: { status: Status }) {
  return (
    <span className={`rounded-sm px-2 py-1 text-xs font-bold ${statusTone[status]}`}>{status}</span>
  );
}

function Dashboard({
  store,
  metrics,
  onSection,
}: {
  store: Store;
  metrics: ReturnType<typeof useMetrics>;
  onSection: (s: Section) => void;
}) {
  const max = Math.max(...store.orders.map((o) => o.total), 1);
  return (
    <>
      <PageTitle
        title="Painel de controle DTF"
        text="Produção, faturamento, custos e estoque em uma visão objetiva."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Faturamento"
          value={money(metrics.revenue)}
          icon={ArrowUpRight}
          tone="text-emerald-400"
        />
        <Stat
          label="Custos totais"
          value={money(metrics.costs)}
          icon={ArrowDownRight}
          tone="text-red-400"
        />
        <Stat
          label="Lucro líquido"
          value={money(metrics.profit)}
          icon={WalletCards}
          tone="text-sky-400"
        />
        <Stat
          label="Metros impressos"
          value={`${metrics.meters.toFixed(1)} m`}
          icon={Printer}
          tone="text-violet-400"
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-md border border-border bg-card p-4">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-black">Pedidos recentes</h2>
            <Button variant="ghost" size="sm" onClick={() => onSection("orders")}>
              Ver todos
            </Button>
          </div>
          <div className="space-y-3">
            {store.orders.slice(0, 5).map((order) => (
              <div
                key={order.id}
                className="grid grid-cols-[1fr_auto] gap-3 border-b border-border pb-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {order.number} · {order.customer}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{order.product}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{money(order.total)}</p>
                  <Badge status={order.status} />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-md border border-border bg-card p-4">
          <h2 className="mb-5 font-black">Valor por pedido</h2>
          <div className="space-y-4">
            {store.orders.slice(0, 5).map((order) => (
              <div key={order.id}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{order.number}</span>
                  <span>{money(order.total)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(5, (order.total / max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
function useMetrics() {
  return { revenue: 0, costs: 0, taxes: 0, profit: 0, meters: 0, low: 0 };
}

function Production({
  orders,
  setOrders,
  search,
}: {
  orders: Order[];
  setOrders: (v: Order[]) => void;
  search: string;
}) {
  const statuses: Status[] = [
    "Recebido",
    "Aguardando",
    "Em produção",
    "Conferência",
    "Pronto",
    "Entregue",
  ];
  const filtered = orders.filter((o) =>
    `${o.number} ${o.customer} ${o.product}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        title="Controle de produção"
        text="Acompanhe a fila e avance cada trabalho até a entrega."
      />
      <div className="grid gap-3">
        {filtered.map((order) => (
          <article key={order.id} className="rounded-md border border-border bg-card p-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <p className="font-black">
                  {order.number} · {order.customer}
                </p>
                <p className="text-sm text-muted-foreground">
                  {order.product} · {order.meters} m · entrega {order.due}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge status={order.status} />
                <select
                  aria-label={`Status de ${order.number}`}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={order.status}
                  onChange={(e) =>
                    setOrders(
                      orders.map((x) =>
                        x.id === order.id ? { ...x, status: e.target.value as Status } : x,
                      ),
                    )
                  }
                >
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function Orders({
  orders,
  customers,
  search,
  formOpen,
  setFormOpen,
  setOrders,
}: {
  orders: Order[];
  customers: Customer[];
  search: string;
  formOpen: boolean;
  setFormOpen: (v: boolean) => void;
  setOrders: (v: Order[]) => void;
}) {
  const [customer, setCustomer] = useState(customers[0]?.company ?? "Cliente balcão");
  const [product, setProduct] = useState("Impressão DTF metro linear");
  const [total, setTotal] = useState("100");
  const [meters, setMeters] = useState("1");
  const filtered = orders.filter((o) =>
    `${o.number} ${o.customer} ${o.product}`.toLowerCase().includes(search.toLowerCase()),
  );
  const save = () => {
    const next = orders.length + 101;
    setOrders([
      {
        id: makeId(),
        number: `PED-2026-${next}`,
        customer,
        product,
        total: Number(total),
        meters: Number(meters),
        status: "Recebido",
        due: new Date().toISOString().slice(0, 10),
      },
      ...orders,
    ]);
    setFormOpen(false);
  };
  return (
    <>
      <PageTitle
        title="Pedidos"
        text="Cadastre vendas, valores e prazos de entrega."
        action={
          <Button onClick={() => setFormOpen(!formOpen)}>
            <Plus className="size-4" />
            Novo pedido
          </Button>
        }
      />
      {formOpen && (
        <FormGrid>
          <label>
            Cliente
            <select
              className="field"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            >
              {customers.map((c) => (
                <option key={c.id}>{c.company}</option>
              ))}
            </select>
          </label>
          <label>
            Produto
            <Input value={product} onChange={(e) => setProduct(e.target.value)} />
          </label>
          <label>
            Valor
            <Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} />
          </label>
          <label>
            Metros
            <Input type="number" value={meters} onChange={(e) => setMeters(e.target.value)} />
          </label>
          <Button onClick={save}>Salvar pedido</Button>
        </FormGrid>
      )}
      <DataTable
        headers={["Pedido", "Cliente", "Produto", "Metros", "Valor", "Status", ""]}
        rows={filtered.map((o) => [
          o.number,
          o.customer,
          o.product,
          `${o.meters} m`,
          money(o.total),
          <Badge status={o.status} />,
          <Button
            key="delete"
            variant="ghost"
            size="icon"
            aria-label="Excluir pedido"
            onClick={() => setOrders(orders.filter((x) => x.id !== o.id))}
          >
            <Trash2 className="size-4" />
          </Button>,
        ])}
      />
    </>
  );
}

function Customers({
  customers,
  orders,
  search,
  formOpen,
  setFormOpen,
  setCustomers,
}: {
  customers: Customer[];
  orders: Order[];
  search: string;
  formOpen: boolean;
  setFormOpen: (v: boolean) => void;
  setCustomers: (v: Customer[]) => void;
}) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const filtered = customers.filter((c) =>
    `${c.name} ${c.company} ${c.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  const save = () => {
    if (!name) return;
    setCustomers([{ id: makeId(), name, company: company || name, phone, email }, ...customers]);
    setFormOpen(false);
    setName("");
  };
  return (
    <>
      <PageTitle
        title="Clientes"
        text="Relacionamento, histórico de compras e contato rápido."
        action={
          <Button onClick={() => setFormOpen(!formOpen)}>
            <Plus className="size-4" />
            Novo cliente
          </Button>
        }
      />
      {formOpen && (
        <FormGrid>
          <label>
            Nome
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Empresa
            <Input value={company} onChange={(e) => setCompany(e.target.value)} />
          </label>
          <label>
            WhatsApp
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label>
            E-mail
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <Button onClick={save}>Salvar cliente</Button>
        </FormGrid>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => {
          const purchases = orders.filter((o) => o.customer === c.company);
          const spent = purchases.reduce((sum, o) => sum + o.total, 0);
          return (
            <article key={c.id} className="rounded-md border border-border bg-card p-4">
              <div className="flex justify-between gap-3">
                <div>
                  <h2 className="font-black">{c.name}</h2>
                  <p className="text-sm text-primary">{c.company}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCustomers(customers.filter((x) => x.id !== c.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="my-4 grid grid-cols-2 gap-2 rounded-md bg-secondary p-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Compras</p>
                  <b>{purchases.length}</b>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <b>{money(spent)}</b>
                </div>
              </div>
              <p className="truncate text-xs text-muted-foreground">{c.email || "Sem e-mail"}</p>
              {c.phone && (
                <a
                  className="mt-3 inline-block text-sm font-bold text-emerald-400"
                  href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir WhatsApp
                </a>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

function Inventory({
  items,
  search,
  formOpen,
  setFormOpen,
  setItems,
}: {
  items: StockItem[];
  search: string;
  formOpen: boolean;
  setFormOpen: (v: boolean) => void;
  setItems: (v: StockItem[]) => void;
}) {
  const [name, setName] = useState("");
  const [stock, setStock] = useState("0");
  const [minimum, setMinimum] = useState("0");
  const [cost, setCost] = useState("0");
  const filtered = items.filter((i) =>
    `${i.name} ${i.code} ${i.category}`.toLowerCase().includes(search.toLowerCase()),
  );
  const save = () => {
    if (!name) return;
    setItems([
      {
        id: makeId(),
        code: `INS-${items.length + 1}`,
        name,
        category: "Insumos",
        unit: "un",
        stock: Number(stock),
        minimum: Number(minimum),
        cost: Number(cost),
      },
      ...items,
    ]);
    setFormOpen(false);
  };
  return (
    <>
      <PageTitle
        title="Materiais e estoque"
        text="Controle de insumos com alertas de estoque mínimo."
        action={
          <Button onClick={() => setFormOpen(!formOpen)}>
            <PackagePlus className="size-4" />
            Novo insumo
          </Button>
        }
      />
      {formOpen && (
        <FormGrid>
          <label>
            Material
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Estoque
            <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
          </label>
          <label>
            Mínimo
            <Input type="number" value={minimum} onChange={(e) => setMinimum(e.target.value)} />
          </label>
          <label>
            Custo unitário
            <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
          </label>
          <Button onClick={save}>Salvar insumo</Button>
        </FormGrid>
      )}
      <DataTable
        headers={["Código", "Material", "Categoria", "Estoque", "Mínimo", "Valor estocado", ""]}
        rows={filtered.map((i) => [
          i.code,
          i.name,
          i.category,
          <span className={i.stock <= i.minimum ? "font-bold text-red-400" : ""}>
            {i.stock} {i.unit}
          </span>,
          `${i.minimum} ${i.unit}`,
          money(i.stock * i.cost),
          <div key="actions" className="flex">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setItems(items.map((x) => (x.id === i.id ? { ...x, stock: x.stock + 10 } : x)))
              }
            >
              +10
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setItems(items.filter((x) => x.id !== i.id))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>,
        ])}
      />
    </>
  );
}

function Financial({
  items,
  metrics,
  formOpen,
  setFormOpen,
  setItems,
}: {
  items: Transaction[];
  metrics: ReturnType<typeof useMetrics>;
  formOpen: boolean;
  setFormOpen: (v: boolean) => void;
  setItems: (v: Transaction[]) => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");
  const [type, setType] = useState<"Entrada" | "Saída">("Entrada");
  const save = () => {
    if (!description || !Number(amount)) return;
    setItems([
      {
        id: makeId(),
        description,
        category: type === "Entrada" ? "Vendas" : "Despesas",
        type,
        amount: Number(amount),
        date: new Date().toISOString().slice(0, 10),
      },
      ...items,
    ]);
    setFormOpen(false);
  };
  return (
    <>
      <PageTitle
        title="Financeiro"
        text="Entradas, despesas e resultado líquido da operação."
        action={
          <Button onClick={() => setFormOpen(!formOpen)}>
            <Plus className="size-4" />
            Nova movimentação
          </Button>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat
          label="Entradas"
          value={money(metrics.revenue)}
          icon={ArrowUpRight}
          tone="text-emerald-400"
        />
        <Stat
          label="Saídas"
          value={money(metrics.costs)}
          icon={ArrowDownRight}
          tone="text-red-400"
        />
        <Stat
          label="Resultado"
          value={money(metrics.profit)}
          icon={WalletCards}
          tone="text-sky-400"
        />
      </div>
      {formOpen && (
        <FormGrid>
          <label>
            Tipo
            <select
              className="field"
              value={type}
              onChange={(e) => setType(e.target.value as "Entrada" | "Saída")}
            >
              <option>Entrada</option>
              <option>Saída</option>
            </select>
          </label>
          <label>
            Descrição
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            Valor
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <Button onClick={save}>Salvar</Button>
        </FormGrid>
      )}
      <DataTable
        headers={["Data", "Descrição", "Categoria", "Tipo", "Valor", ""]}
        rows={items.map((t) => [
          t.date,
          t.description,
          t.category,
          <span className={t.type === "Entrada" ? "text-emerald-400" : "text-red-400"}>
            {t.type}
          </span>,
          money(t.amount),
          <Button
            key="delete"
            variant="ghost"
            size="icon"
            onClick={() => setItems(items.filter((x) => x.id !== t.id))}
          >
            <Trash2 className="size-4" />
          </Button>,
        ])}
      />
    </>
  );
}

function Taxes({
  taxes,
  revenue,
  setTaxes,
}: {
  taxes: Tax[];
  revenue: number;
  setTaxes: (v: Tax[]) => void;
}) {
  return (
    <>
      <PageTitle title="Impostos" text="Configure as alíquotas e acompanhe o impacto estimado." />
      <div className="mb-5 rounded-md border border-border bg-card p-5">
        <p className="text-xs font-bold uppercase text-muted-foreground">Projeção tributária</p>
        <p className="mt-2 text-3xl font-black">
          {money((revenue * taxes.filter((t) => t.active).reduce((s, t) => s + t.rate, 0)) / 100)}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {taxes.map((t) => (
          <article
            key={t.id}
            className="flex items-center gap-4 rounded-md border border-border bg-card p-4"
          >
            <div className="grid size-12 place-items-center rounded-md bg-secondary text-lg font-black">
              {t.rate}%
            </div>
            <div className="flex-1">
              <p className="font-bold">{t.name}</p>
              <p className="text-xs text-muted-foreground">
                Impacto: {money((revenue * t.rate) / 100)}
              </p>
            </div>
            <Button
              variant={t.active ? "secondary" : "outline"}
              size="sm"
              onClick={() =>
                setTaxes(taxes.map((x) => (x.id === t.id ? { ...x, active: !x.active } : x)))
              }
            >
              {t.active ? "Ativo" : "Inativo"}
            </Button>
          </article>
        ))}
      </div>
    </>
  );
}

function Reports({ store, metrics }: { store: Store; metrics: ReturnType<typeof useMetrics> }) {
  const exportCsv = () => {
    const rows = [
      ["Pedido", "Cliente", "Produto", "Valor", "Status"],
      ...store.orders.map((o) => [o.number, o.customer, o.product, String(o.total), o.status]),
    ];
    const blob = new Blob(
      [
        "\ufeff" +
          rows.map((r) => r.map((v) => `"${v.replaceAll('"', '""')}"`).join(";")).join("\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "relatorio-dtflexpro.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <PageTitle title="Relatórios" text="Consolide produção, vendas, estoque e resultado." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pedidos" value={String(store.orders.length)} icon={ClipboardList} />
        <Stat label="Clientes" value={String(store.customers.length)} icon={Users} />
        <Stat label="Faturamento" value={money(metrics.revenue)} icon={BarChart3} />
        <Stat label="Lucro" value={money(metrics.profit)} icon={WalletCards} />
      </div>
      <div className="mt-5 rounded-md border border-border bg-card p-5">
        <h2 className="font-black">Relatório consolidado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Baixe os pedidos atuais para abrir no Excel ou imprima esta página.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={exportCsv}>
            <Download className="size-4" />
            Exportar CSV
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" />
            Imprimir relatório
          </Button>
        </div>
      </div>
    </>
  );
}

function SettingsPanel({
  value,
  setValue,
  reset,
}: {
  value: SettingsData;
  setValue: (v: SettingsData) => void;
  reset: () => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <>
      <PageTitle title="Configurações" text="Dados da empresa e parâmetros padrão de custo." />
      <div className="grid max-w-4xl gap-5 lg:grid-cols-2">
        <FormGrid>
          <label>
            Empresa
            <Input
              value={draft.company}
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
            />
          </label>
          <label>
            CNPJ
            <Input
              value={draft.cnpj}
              onChange={(e) => setDraft({ ...draft, cnpj: e.target.value })}
            />
          </label>
          <label>
            WhatsApp
            <Input
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          </label>
        </FormGrid>
        <FormGrid>
          <label>
            Custo filme / metro
            <Input
              type="number"
              value={draft.filmCost}
              onChange={(e) => setDraft({ ...draft, filmCost: Number(e.target.value) })}
            />
          </label>
          <label>
            Custo tinta / m²
            <Input
              type="number"
              value={draft.inkCost}
              onChange={(e) => setDraft({ ...draft, inkCost: Number(e.target.value) })}
            />
          </label>
          <label>
            Margem padrão (%)
            <Input
              type="number"
              value={draft.margin}
              onChange={(e) => setDraft({ ...draft, margin: Number(e.target.value) })}
            />
          </label>
        </FormGrid>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => setValue(draft)}>
          <CheckCircle2 className="size-4" />
          Salvar configurações
        </Button>
        <Button variant="outline" onClick={reset}>
          Zerar informações
        </Button>
      </div>
    </>
  );
}
function Team({ users, setUsers }: { users: TeamUser[]; setUsers: (v: TeamUser[]) => void }) {
  return (
    <>
      <PageTitle title="Usuários" text="Perfis da equipe e níveis de acesso." />
      <div className="grid gap-3 md:grid-cols-2">
        {users.map((u) => (
          <article
            key={u.id}
            className="flex items-center gap-3 rounded-md border border-border bg-card p-4"
          >
            <div className="grid size-10 place-items-center rounded-full bg-primary text-sm font-black text-primary-foreground">
              {u.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{u.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {u.email} · {u.role}
              </p>
            </div>
            <Button
              variant={u.active ? "secondary" : "outline"}
              size="sm"
              onClick={() =>
                setUsers(users.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)))
              }
            >
              {u.active ? "Ativo" : "Inativo"}
            </Button>
          </article>
        ))}
      </div>
    </>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-2 [&_label]:space-y-1 [&_label]:text-xs [&_label]:font-bold [&_.field]:h-9 [&_.field]:w-full [&_.field]:rounded-md [&_.field]:border [&_.field]:border-input [&_.field]:bg-background [&_.field]:px-3 [&_.field]:text-sm">
      {children}
    </div>
  );
}
function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-secondary text-xs uppercase text-muted-foreground">
          <tr>
            {headers.map((h, i) => (
              <th key={`${h}-${i}`} className="px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
