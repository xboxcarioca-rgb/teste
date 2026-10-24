import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createFileRoute, redirect, ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  LogOut,
  Calculator,
  Scissors,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Shirt,
  LayoutGrid,
  Library,
  BriefcaseBusiness,
  Images,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { getAccessSession, pingAccessSession, logoutAccessSession } from "@/lib/access.functions";
import { DTFCalculatorDialog } from "@/components/DTFCalculatorDialog";
import { Button } from "@/components/ui/button";

const ShirtStudioCanvas = lazy(() => import("@/components/landing/shirt-studio/ShirtStudioCanvas"));
const DTFGangSheetStudio = lazy(() => import("@/components/DTFGangSheetStudio"));
const ArtLibrary = lazy(() => import("@/components/ArtLibrary"));
const DTFBusinessManager = lazy(() => import("@/components/DTFBusinessManager"));
const BatchCatalogStudio = lazy(() => import("@/components/BatchCatalogStudio"));

function AppError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Acesso indisponível</h1>
        <p className="mt-2 text-muted-foreground">
          Recarregue a página para abrir a ferramenta novamente.
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "DTFLEXPRO Halftone Engine" },
      {
        name: "description",
        content:
          "Ferramenta profissional DTFLEXPRO Halftone Engine para retículas DTF — Rosette CMYK e Round Clean.",
      },
      { property: "og:title", content: "DTFLEXPRO | Biblioteca e Halftone" },
      {
        property: "og:description",
        content: "Biblioteca de artes e ferramentas profissionais DTFLEXPRO para impressão DTF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const session = await getAccessSession();
    if (!session?.authenticated) {
      const expired = (session as any)?.expired ? "1" : "";
      const email = session?.email ?? "";
      throw redirect({ to: "/login", search: { code: "", email, expired } });
    }
  },

  errorComponent: AppError,
  notFoundComponent: AppError,
  component: AppPage,
});

function formatExpiry(iso: string | null): {
  label: string;
  tone: "ok" | "warn" | "danger";
  daysLeft: number | null;
} {
  if (!iso) return { label: "Acesso vitalício", tone: "ok", daysLeft: null };
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { label: "Acesso expirado", tone: "danger", daysLeft: 0 };
  const days = Math.floor(ms / 86_400_000);
  // Vitalício = expira muito longe (>10 anos)
  if (days > 3650) return { label: "Acesso vitalício", tone: "ok", daysLeft: null };
  const date = new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const tone: "ok" | "warn" | "danger" = days <= 3 ? "danger" : days <= 7 ? "warn" : "ok";
  const restante =
    days === 0 ? "expira hoje" : days === 1 ? "1 dia restante" : `${days} dias restantes`;
  return { label: `Expira em ${date} · ${restante}`, tone, daysLeft: days };
}

const ADMIN_WHATSAPP = "5511943152441";

function AppPage() {
  const ping = useServerFn(pingAccessSession);
  const readSession = useServerFn(getAccessSession);
  const logout = useServerFn(logoutAccessSession);
  const [expiry, setExpiry] = useState<{
    email: string | null;
    expiresAt: string | null;
    isTrial: boolean;
  } | null>(null);
  const [showRemover, setShowRemover] = useState(false);
  const [showStudio, setShowStudio] = useState(false);
  const [showGang, setShowGang] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showManagement, setShowManagement] = useState(false);
  const [showBatchCatalog, setShowBatchCatalog] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  function useLibraryArt(file: { url: string; name: string }) {
    setShowLibrary(false);
    iframeRef.current?.contentWindow?.postMessage(
      { type: "DTFLEXPRO_IMPORT_ART", url: file.url, name: file.name },
      window.location.origin,
    );
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {}
    window.location.href = "/login";
  }

  // Heartbeat — marca o usuário como online no painel admin
  useEffect(() => {
    ping().catch(() => {});
    const id = setInterval(() => {
      ping().catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, [ping]);

  // Buscar dados da sessão (e-mail + expiração) para mostrar no topo
  useEffect(() => {
    readSession()
      .then((s) => {
        const isTrial = Boolean(s.isTrial);
        setExpiry({ email: s.email ?? null, expiresAt: s.expiresAt ?? null, isTrial });
        if (!isTrial) setShowLibrary(true);
      })
      .catch(() => {});
  }, [readSession]);

  // Esconde os botões flutuantes enquanto o modal de recorte da ferramenta está aberto
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const doc = iframeRef.current?.contentDocument;
        setCropOpen(!!doc?.querySelector("#dtf-upcrop-stage"));
      } catch {}
    }, 600);
    return () => clearInterval(id);
  }, []);

  // Proteção anti-print: bloqueia PrintScreen, contexto, atalhos de captura
  // e esconde a tela quando o usuário tenta imprimir.
  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-dtflex-antiprint", "true");
    styleEl.textContent = `
      @media print {
        html, body { display: none !important; visibility: hidden !important; background: #000 !important; }
      }
      body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
      iframe[title="DTFLEXPRO Halftone Engine"] { -webkit-user-select: none; user-select: none; }
    `;
    document.head.appendChild(styleEl);

    const blockContext = (e: MouseEvent) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      const k = e.key;
      // PrintScreen
      if (k === "PrintScreen") {
        try {
          navigator.clipboard.writeText("");
        } catch {}
        e.preventDefault();
        alert("Captura de tela bloqueada nesta ferramenta.");
        return;
      }
      // Ctrl/Cmd+P (print), Ctrl/Cmd+S (save), Ctrl+Shift+S (screenshot Firefox)
      if ((e.ctrlKey || e.metaKey) && (k === "p" || k === "P" || k === "s" || k === "S")) {
        e.preventDefault();
        return;
      }
      // Ctrl+Shift+I/J/C (devtools), F12
      if (
        k === "F12" ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "I", "j", "J", "c", "C"].includes(k))
      ) {
        e.preventDefault();
        return;
      }
    };
    const beforePrint = () => {
      document.body.style.visibility = "hidden";
    };
    const afterPrint = () => {
      document.body.style.visibility = "";
    };

    document.addEventListener("contextmenu", blockContext);
    document.addEventListener("keydown", blockKeys, true);
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);

    return () => {
      document.removeEventListener("contextmenu", blockContext);
      document.removeEventListener("keydown", blockKeys, true);
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
      styleEl.remove();
    };
  }, []);

  const exp = expiry ? formatExpiry(expiry.expiresAt) : null;
  const toneBg =
    exp?.tone === "danger"
      ? "bg-red-600/95 text-white"
      : exp?.tone === "warn"
        ? "bg-amber-500/95 text-black"
        : "bg-emerald-600/95 text-white";

  const showRenewBanner = exp ? exp.tone === "warn" || exp.tone === "danger" : false;
  const renewMsg = encodeURIComponent(
    `Olá! Sou ${expiry?.email ?? ""} e quero renovar meu acesso ao DTFlexPRO. ${exp?.label ?? ""}`,
  );
  const topOffset = (exp ? 28 : 0) + (showRenewBanner ? 36 : 0);

  return (
    <>
      {exp && (
        <div
          className={`fixed left-0 right-0 top-0 z-50 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 py-1.5 text-xs font-medium shadow sm:px-4 ${toneBg}`}
        >
          <span className="truncate">
            {expiry?.email ? `${expiry.email} · ` : ""}
            {exp.label}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="flex shrink-0 items-center gap-1 rounded-md bg-black/30 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide hover:bg-black/50"
          >
            <LogOut className="h-3 w-3" />
            Sair
          </button>
        </div>
      )}
      {showRenewBanner && (
        <div
          className="fixed left-0 right-0 z-50 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 bg-amber-500 px-2 py-1.5 text-xs font-semibold text-black shadow sm:px-4"
          style={{ top: 28 }}
        >
          <span className="min-w-0 truncate">
            ⚠️ Seu acesso está{" "}
            {exp?.tone === "danger" ? "expirado/quase expirando" : "perto de expirar"}. Entre em
            contato com o administrador para renovar.
          </span>
          <a
            href={`https://wa.me/${ADMIN_WHATSAPP}?text=${renewMsg}`}
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-1 rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-bold uppercase text-white hover:bg-black sm:text-[11px]"
          >
            Renovar pelo WhatsApp
          </a>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src="/dtflex-tool/index.html?v=dpi300-text-v74"
        title="DTFLEXPRO Halftone Engine"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          top: topOffset,
          width: "100vw",
          height: `calc(100dvh - ${topOffset}px)`,
          border: "none",
          background: "#0a0c10",
        }}
      />
      {/* Ferramentas auxiliares: recolhíveis e no canto inferior esquerdo,
          escondidas enquanto o modal de recorte estiver aberto. */}
      {!cropOpen && (
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(.5rem,env(safe-area-inset-left))] z-50 flex max-w-[calc(100vw-1rem-env(safe-area-inset-left)-env(safe-area-inset-right))] flex-col items-start gap-2 sm:left-4 sm:max-w-none">
          {toolsOpen && (
            <div className="flex max-h-[min(62dvh,430px)] max-w-full flex-col items-stretch gap-2 overflow-y-auto overscroll-contain pr-1">
              <Button
                className="h-11 justify-start px-3 text-xs font-semibold shadow-lg bg-[oklch(0.58_0.25_27)] hover:bg-[oklch(0.52_0.25_27)] text-white sm:h-10"
                onClick={() => setShowRemover(true)}
              >
                <Scissors className="h-4 w-4" />
                Removedor de fundos
              </Button>
              <Button
                className="h-11 justify-start px-3 text-xs font-semibold shadow-lg bg-[oklch(0.6_0.16_150)] hover:bg-[oklch(0.53_0.16_150)] text-white sm:h-10"
                onClick={() => setShowStudio(true)}
              >
                <Shirt className="h-4 w-4" />
                Crie seu mockup
              </Button>
              <Button
                className="h-11 justify-start px-3 text-xs font-semibold shadow-lg bg-[oklch(0.55_0.18_260)] hover:bg-[oklch(0.48_0.18_260)] text-white sm:h-10"
                onClick={() => setShowGang(true)}
              >
                <LayoutGrid className="h-4 w-4" />
                Montagem DTF
              </Button>
              <Button
                className="h-11 justify-start px-3 text-xs font-semibold shadow-lg sm:h-10"
                onClick={() => setShowLibrary(true)}
              >
                <Library className="h-4 w-4" />
                Biblioteca de artes
              </Button>
              <Button
                variant="outline"
                className="h-11 justify-start px-3 text-xs font-semibold shadow-lg sm:h-10"
                onClick={() => setShowManagement(true)}
              >
                <BriefcaseBusiness className="h-4 w-4" />
                Gestão DTF
              </Button>
              <Button
                className="h-11 justify-start bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-lg sm:h-10"
                onClick={() => setShowBatchCatalog(true)}
              >
                <Images className="h-4 w-4" />
                Catálogo em lote
              </Button>
              <DTFCalculatorDialog
                trigger={
                  <Button variant="secondary" className="h-11 justify-start px-3 text-xs font-semibold shadow-lg sm:h-10">
                    <Calculator className="h-4 w-4" />
                    Calculadora DTF
                  </Button>
                }
              />
            </div>
          )}
          <Button
            variant="secondary"
            className="h-11 px-3 text-xs font-semibold shadow-lg sm:h-9"
            onClick={() => {
              if (expiry?.isTrial) {
                setToolsOpen(false);
                toast.info("Somente no plano PRO", {
                  description: "As ferramentas ficam disponíveis após a ativação do plano.",
                });
                return;
              }
              setToolsOpen((v) => !v);
            }}
          >
            {expiry?.isTrial ? (
              <Lock className="h-4 w-4" />
            ) : toolsOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
            Ferramentas
            {expiry?.isTrial && <span className="ml-1 text-[10px] uppercase">PRO</span>}
          </Button>
        </div>
      )}

      {showGang && (
        <ClientOnly fallback={null}>
          <Suspense fallback={null}>
            <DTFGangSheetStudio onClose={() => setShowGang(false)} />
          </Suspense>
        </ClientOnly>
      )}

      {showLibrary && (
        <ClientOnly fallback={null}>
          <Suspense
            fallback={
              <div className="fixed inset-0 z-[100] grid place-items-center bg-background text-muted-foreground">
                Carregando biblioteca…
              </div>
            }
          >
            <ArtLibrary
              onOpenHalftone={() => setShowLibrary(false)}
              onUseInHalftone={useLibraryArt}
            />
          </Suspense>
        </ClientOnly>
      )}

      {showManagement && (
        <ClientOnly fallback={null}>
          <Suspense
            fallback={
              <div className="fixed inset-0 z-[110] grid place-items-center bg-background text-muted-foreground">
                Carregando gestão…
              </div>
            }
          >
            <DTFBusinessManager
              onClose={() => setShowManagement(false)}
              accountEmail={expiry?.email ?? "conta"}
            />
          </Suspense>
        </ClientOnly>
      )}

      {showBatchCatalog && (
        <ClientOnly fallback={null}>
          <Suspense
            fallback={
              <div className="fixed inset-0 z-[120] grid place-items-center bg-background text-muted-foreground">
                Carregando catálogo em lote…
              </div>
            }
          >
            <BatchCatalogStudio onClose={() => setShowBatchCatalog(false)} />
          </Suspense>
        </ClientOnly>
      )}

      {/* Overlay do Removedor de Fundos */}
      {showRemover && (
        <ExternalToolOverlay
          title="Removedor de fundos"
          src="https://www.photoroom.com/pt-pt/tools/background-remover"
          offsetTop={88}
          onClose={() => setShowRemover(false)}
        />
      )}

      {/* Estúdio de mockup (sem marca d'água) */}
      {showStudio && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-b px-2 py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-4">
            <Button
              variant="outline"
              size="sm"
              className="h-11 gap-1 font-semibold sm:h-9"
              onClick={() => setShowStudio(false)}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para ferramenta
            </Button>
            <span className="min-w-0 truncate text-right text-sm text-muted-foreground sm:text-center">Crie seu mockup</span>
            <div className="hidden w-20 sm:block" />
          </div>
          <div className="flex-1 overflow-auto overscroll-contain p-2 pb-[max(.5rem,env(safe-area-inset-bottom))] sm:p-4">
            <ClientOnly
              fallback={<div className="h-[560px] animate-pulse rounded-3xl bg-card/50" />}
            >
              <Suspense
                fallback={<div className="h-[560px] animate-pulse rounded-3xl bg-card/50" />}
              >
                <ShirtStudioCanvas watermark={false} />
              </Suspense>
            </ClientOnly>
          </div>
        </div>
      )}
    </>
  );
}

function ExternalToolOverlay({
  title,
  src,
  offsetTop,
  onClose,
}: {
  title: string;
  src: string;
  offsetTop: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex min-w-0 flex-col overflow-hidden bg-white">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-b bg-white px-2 py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-4">
        <Button variant="outline" size="sm" className="h-11 gap-1 font-semibold sm:h-9" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
          Voltar para ferramenta
        </Button>
        <span className="min-w-0 truncate text-right text-sm text-muted-foreground sm:text-center">{title}</span>
        <div className="hidden w-20 sm:block" />
      </div>
      <div className="relative flex-1 w-full overflow-hidden bg-white">
        <iframe
          src={src}
          title={title}
          style={{
            position: "absolute",
            left: 0,
            top: -offsetTop,
            width: "100%",
            height: `calc(100% + ${offsetTop}px)`,
            border: "none",
          }}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
        />
      </div>
    </div>
  );
}
