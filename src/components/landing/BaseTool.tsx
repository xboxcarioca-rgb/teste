import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CheckCircle2,
  Download,
  Expand,
  FileImage,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  UploadCloud,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import afterImage from "@/assets/halftone-after-demo.png";
import beforeImage from "@/assets/shark-before.jpg";

/**
 * Ferramenta Base — a landing page É a ferramenta.
 *
 * Embute o Halftone Engine existente (public/dtflex-tool) direto na página
 * inicial, sem alterar o bundle nem o patch de 300 DPI (ver mem/index.md).
 * Arquivos escolhidos/arrastados na landing são encaminhados para a
 * ferramenta pelo mesmo protocolo já usado pela Biblioteca em /app
 * (postMessage DTFLEXPRO_IMPORT_ART, mesma origem).
 *
 * A plataforma completa (Biblioteca do Drive, Gestão DTF, Catálogo em
 * Lote, Montagem e Mockups) continua em /app, atrás do login por código.
 */

const TOOL_SRC = "/dtflex-tool/index.html?v=dpi300-text-v74";
const TOOL_TITLE = "DTFLEXPRO Halftone Engine";
const MAX_FILE_SIZE_MB = 60;
const FILE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/bmp,application/pdf,.pdf,.psd";
const ACCEPTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".pdf", ".psd"];

const OUTPUT_BADGES = [
  "A2 · A3 · A4",
  "300 DPI real (pHYs)",
  "PNG transparente",
  "Rosette CMYK e Round Clean",
  "Tecido preto, branco ou colorido",
] as const;

const FLOW = [
  {
    icon: UploadCloud,
    title: "Envie sua arte",
    description: "Arraste, selecione ou use o upload da própria ferramenta.",
  },
  {
    icon: SlidersHorizontal,
    title: "Ajuste tecido e retícula",
    description: "Formato, enquadramento, densidade e cor do tecido.",
  },
  {
    icon: Download,
    title: "Exporte em 300 DPI",
    description: "PNG final no tamanho físico certo, pronto para o DTF.",
  },
] as const;

type PendingImport = { url: string; name: string };

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith("image/") ||
    file.type === "application/pdf" ||
    ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))
  );
}

export function BaseTool() {
  const [started, setStarted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [status, setStatus] = useState("Ferramenta base pronta para abrir aqui mesmo.");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const frameWrapRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Libera a URL temporária da arte ao desmontar.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === frameWrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Encaminha a arte escolhida na landing para dentro da ferramenta assim
  // que o campo de upload dela existir (mesma origem, como em /app).
  useEffect(() => {
    if (!started || !pending) return;
    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      const frame = iframeRef.current;
      const win = frame?.contentWindow;
      if (!win) return;
      let hasUploadInput = false;
      try {
        hasUploadInput = !!frame.contentDocument?.querySelector('input[type="file"]');
      } catch {
        hasUploadInput = loaded;
      }
      if (hasUploadInput) {
        win.postMessage(
          { type: "DTFLEXPRO_IMPORT_ART", url: pending.url, name: pending.name },
          window.location.origin,
        );
        setStatus(`Arte enviada para a ferramenta: ${pending.name}`);
        setPending(null);
        window.clearInterval(interval);
        return;
      }
      if (attempts > 80) {
        setStatus(
          "A ferramenta abriu, mas a área de upload dela ainda não apareceu. Abra o upload dentro dela ou recarregue a ferramenta.",
        );
        window.clearInterval(interval);
      }
    }, 300);
    return () => window.clearInterval(interval);
  }, [started, pending, loaded, frameKey]);

  function scrollToFrame() {
    requestAnimationFrame(() => {
      frameWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openPicker() {
    fileInputRef.current?.click();
  }

  function startEmpty() {
    setStarted(true);
    setLoaded(false);
    setStatus("Carregando a ferramenta base…");
    scrollToFrame();
  }

  function prepareFile(file: File | null | undefined) {
    if (!file) return;
    if (!isAcceptedFile(file)) {
      toast.error("Formato não suportado", {
        description: "Envie PNG, JPEG, WEBP, PDF ou PSD para começar.",
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error("Arquivo muito grande para enviar pela capa", {
        description: `Limite de ${MAX_FILE_SIZE_MB} MB aqui. Abra a ferramenta e use o upload interno dela.`,
      });
      startEmpty();
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPending({ url, name: file.name });
    setStarted(true);
    setStatus(`Preparando sua arte: ${file.name}`);
    scrollToFrame();
  }

  function reloadTool() {
    setPending(null);
    setLoaded(false);
    setFrameKey((key) => key + 1);
    setStarted(true);
    setStatus("Recarregando a ferramenta base…");
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await frameWrapRef.current?.requestFullscreen();
      }
    } catch {
      toast.error("Tela cheia não disponível neste navegador.");
    }
  }

  return (
    <section
      id="ferramenta"
      className="relative scroll-mt-20 overflow-hidden border-b border-border/60"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[26rem] bg-[var(--gradient-hero)] opacity-90" />
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-6 grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4 animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/60 bg-primary/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-primary shadow-[var(--shadow-glow)]">
              <Wand2 className="h-4 w-4" />
              Ferramenta base · Halftone DTF
            </span>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl">
              Envie a arte. Ajuste a retícula.{" "}
              <span className="bg-gradient-to-r from-[oklch(0.70_0.27_27)] via-[oklch(0.62_0.27_27)] to-[oklch(0.70_0.27_27)] bg-clip-text text-transparent">
                Exporte em 300 DPI.
              </span>
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
              A página inicial agora é a ferramenta base do DTFLEXPRO: o Halftone Engine roda aqui
              mesmo, direto no navegador, sem instalar nada e sem sair desta tela.
            </p>
            <div className="flex flex-wrap gap-2">
              {OUTPUT_BADGES.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand" />
                  {badge}
                </span>
              ))}
            </div>
          </div>

          <ol className="grid gap-3 rounded-lg border border-border/70 bg-card/55 p-4 backdrop-blur">
            {FLOW.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-brand/30 bg-brand-muted text-brand">
                  <step.icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    {index + 1}. {step.title}
                  </span>
                  <span className="block text-sm leading-6 text-muted-foreground">
                    {step.description}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_ACCEPT}
          className="sr-only"
          aria-label="Enviar arte para a ferramenta base"
          onChange={(event) => {
            prepareFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <div
          ref={frameWrapRef}
          className="flex flex-col overflow-hidden rounded-xl border border-primary/40 bg-[#0a0c10] shadow-[var(--shadow-panel)]"
        >
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/60 bg-card/80 px-3 py-2.5 backdrop-blur sm:px-4">
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${started && loaded ? "bg-emerald-400" : "bg-amber-400"}`}
                aria-hidden="true"
              />
              <span className="truncate text-sm font-semibold text-foreground">
                DTFLEXPRO Halftone Engine
                <span className="hidden font-normal text-muted-foreground sm:inline">
                  {" "}
                  — Ferramenta Base
                </span>
              </span>
            </span>
            <span
              aria-live="polite"
              className="order-3 w-full truncate text-xs text-muted-foreground sm:order-2 sm:w-auto sm:flex-1"
            >
              {status}
            </span>
            <span className="order-2 ml-auto flex shrink-0 flex-wrap items-center gap-1.5 sm:order-3 sm:ml-0">
              <Button type="button" size="sm" onClick={openPicker}>
                <FileImage className="h-4 w-4" />
                Enviar arte
              </Button>
              {started && (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={reloadTool}>
                    <RefreshCw className="h-4 w-4" />
                    <span className="hidden md:inline">Recarregar</span>
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={toggleFullscreen}>
                    <Expand className="h-4 w-4" />
                    <span className="hidden md:inline">Tela cheia</span>
                  </Button>
                </>
              )}
              <Button asChild size="sm" variant="secondary">
                <Link to="/app">
                  Plataforma completa
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </span>
          </div>

          <div
            className={`relative bg-[#0a0c10] ${
              isFullscreen
                ? "min-h-0 flex-1"
                : started
                  ? "h-[clamp(600px,84dvh,940px)]"
                  : "min-h-[540px]"
            }`}
          >
            {started ? (
              <>
                {!loaded && (
                  <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0a0c10] text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-brand" />
                    <p className="text-sm text-muted-foreground">Carregando o Halftone Engine…</p>
                  </div>
                )}
                <iframe
                  key={frameKey}
                  ref={iframeRef}
                  src={TOOL_SRC}
                  title={TOOL_TITLE}
                  className="absolute inset-0 h-full w-full border-0 bg-[#0a0c10]"
                  allow="clipboard-read; clipboard-write; fullscreen"
                  allowFullScreen
                  onLoad={() => {
                    setLoaded(true);
                    if (!pending) setStatus("Ferramenta base aberta. Envie sua arte para começar.");
                  }}
                />
              </>
            ) : (
              <div className="grid h-full gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={openPicker}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                      prepareFile(event.dataTransfer.files?.[0]);
                    }}
                    className={`flex min-h-72 flex-1 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      dragActive
                        ? "border-brand bg-brand-muted text-foreground"
                        : "border-border/80 bg-card/50 text-foreground hover:border-brand/60 hover:bg-card/70"
                    }`}
                  >
                    <UploadCloud className="h-12 w-12 text-brand" />
                    <span className="text-xl font-semibold">
                      Arraste sua arte ou clique para enviar
                    </span>
                    <span className="max-w-md text-sm leading-6 text-muted-foreground">
                      PNG, JPEG, WEBP, PDF ou PSD até {MAX_FILE_SIZE_MB} MB. A ferramenta abre aqui
                      mesmo já com a sua arte carregada.
                    </span>
                    <span className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                      <FileImage className="h-4 w-4" />
                      Enviar imagem e começar
                    </span>
                  </button>
                  <Button type="button" variant="outline" size="lg" onClick={startEmpty}>
                    Abrir a ferramenta vazia
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>

                <figure className="grid grid-cols-2 gap-3">
                  <span className="relative block overflow-hidden rounded-lg border border-border/70">
                    <img
                      src={beforeImage}
                      alt="Arte original antes do halftone"
                      className="h-56 w-full object-cover sm:h-72 lg:h-full lg:min-h-80"
                      loading="lazy"
                    />
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">
                      Arte original
                    </span>
                  </span>
                  <span className="relative block overflow-hidden rounded-lg border border-brand/50">
                    <img
                      src={afterImage}
                      alt="Arte com halftone aplicado, pronta para exportar"
                      className="h-56 w-full object-cover sm:h-72 lg:h-full lg:min-h-80"
                      loading="lazy"
                    />
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">
                      Halftone pronto · 300 DPI
                    </span>
                  </span>
                </figure>
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 max-w-4xl text-sm leading-6 text-muted-foreground">
          Esta é a{" "}
          <strong className="font-semibold text-foreground">
            ferramenta base aberta na página inicial
          </strong>
          . Biblioteca de Artes no Google Drive, Gestão DTF, Catálogo em Lote, Montagem DTF e
          Estúdio de Mockups continuam na{" "}
          <Link to="/app" className="font-semibold text-brand underline-offset-4 hover:underline">
            plataforma completa
          </Link>
          , com seu acesso por e-mail e código.
        </p>
      </div>
    </section>
  );
}
