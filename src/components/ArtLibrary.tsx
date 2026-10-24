import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  FileArchive,
  FileImage,
  FileText,
  Folder,
  Grid2X2,
  ImageOff,
  LoaderCircle,
  RefreshCw,
  Search,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { listArtLibrary } from "@/lib/drive-library.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { detectArtPaper, isHalftoneArt } from "@/lib/art-library-info";

type LibraryItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  isFolder: boolean;
  isShortcut: boolean;
  targetId?: string;
  targetMimeType?: string;
  imageMediaMetadata?: { width?: number; height?: number };
};
type Crumb = { id: string; name: string };
type Category = { key: string; label: string; items: LibraryItem[] };

const ROOT_ID = "171iAy67NlkfiofSZ4c1JuIZZMxj3kFCa";

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType === "application/pdf") return FileText;
  return FileArchive;
}

function formatDate(value?: string) {
  if (!value) return "Arquivo DTFLEXPRO";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}


function folderCategory(name: string) {
  const value = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/futebol|time|esporte|campeao|copa|jogador/.test(value)) return "sports";
  if (/natal|pascoa|mae|pai|namorado|carnaval|junina|ano novo|halloween/.test(value))
    return "dates";
  if (/profissao|professor|medic|enferm|advog|motorista|barbeiro|mecanico/.test(value))
    return "professions";
  if (/infantil|desenho|personagem|anime|heroi|princesa|gamer/.test(value)) return "characters";
  if (/frase|relig|fe|evangel|motiv|familia/.test(value)) return "themes";
  return "collections";
}

export default function ArtLibrary({
  onOpenHalftone,
  onUseInHalftone,
}: {
  onOpenHalftone: () => void;
  onUseInHalftone: (file: { url: string; name: string }) => void;
}) {
  const listLibrary = useServerFn(listArtLibrary);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: ROOT_ID, name: "Todas as artes" }]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const requestIdRef = useRef(0);
  const itemsRef = useRef<LibraryItem[]>([]);
  const path = useMemo(() => crumbs.map((crumb) => crumb.id), [crumbs]);
  const pathKey = path.join(",");

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const loadItems = useCallback(
    async (refresh = false) => {
      const requestId = ++requestIdRef.current;
      if (itemsRef.current.length === 0) setLoading(true);
      else setRefreshing(true);
      setError("");
      try {
        const result = await listLibrary({ data: { path, refresh } });
        if (requestId !== requestIdRef.current) return;
        setItems(result.files);
        setLastUpdated(new Date());
      } catch {
        if (requestId !== requestIdRef.current) return;
        setError(
          itemsRef.current.length === 0
            ? "Não foi possível carregar esta pasta agora."
            : "Não foi possível atualizar agora. O conteúdo anterior foi mantido.",
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [listLibrary, path],
  );

  useEffect(() => {
    void loadItems(false);
  }, [loadItems]);

  useEffect(() => {
    const intervalId = window.setInterval(() => void loadItems(true), 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadItems(true);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadItems]);

  const shuffledItems = useMemo(() => {
    const list = [...items];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }, [items]);

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return shuffledItems;
    return shuffledItems.filter((item) => item.name.toLocaleLowerCase("pt-BR").includes(normalized));
  }, [shuffledItems, query]);

  const categories = useMemo<Category[]>(() => {
    const groups: Category[] = [
      { key: "sports", label: "Esportes e times", items: [] },
      { key: "dates", label: "Datas comemorativas", items: [] },
      { key: "professions", label: "Profissões", items: [] },
      { key: "characters", label: "Infantil e personagens", items: [] },
      { key: "themes", label: "Frases e temas", items: [] },
      { key: "collections", label: "Outras coleções", items: [] },
      { key: "images", label: "Imagens", items: [] },
      { key: "pdfs", label: "Documentos PDF", items: [] },
      { key: "vectors", label: "Vetores", items: [] },
      { key: "others", label: "Outros arquivos", items: [] },
    ];
    for (const item of visibleItems) {
      if (item.isFolder)
        groups.find((group) => group.key === folderCategory(item.name))?.items.push(item);
      else if (item.mimeType.startsWith("image/") && item.mimeType !== "image/svg+xml")
        groups.find((group) => group.key === "images")?.items.push(item);
      else if (item.mimeType === "application/pdf")
        groups.find((group) => group.key === "pdfs")?.items.push(item);
      else if (
        item.mimeType === "image/svg+xml" ||
        /illustrator|postscript|eps|coreldraw/i.test(item.mimeType) ||
        /\.(ai|eps|svg|cdr)$/i.test(item.name)
      )
        groups.find((group) => group.key === "vectors")?.items.push(item);
      else groups.find((group) => group.key === "others")?.items.push(item);
    }
    return groups.filter((group) => group.items.length > 0);
  }, [visibleItems]);

  function openFolder(item: LibraryItem) {
    if (loading || refreshing) return;
    setQuery("");
    setCrumbs((current) => {
      if (current[current.length - 1]?.id === item.id) return current;
      return [...current, { id: item.id, name: item.name }];
    });
  }

  function goToCrumb(index: number) {
    if (loading || refreshing) return;
    setQuery("");
    setCrumbs((current) => current.slice(0, index + 1));
  }

  function renderItem(item: LibraryItem) {
    const Icon = item.isFolder ? Folder : fileIcon(item.mimeType);
    const folderNames = crumbs.map((crumb) => crumb.name);
    const halftone = !item.isFolder && isHalftoneArt(item.name, folderNames);
    const paper = !item.isFolder ? detectArtPaper(item, folderNames) : null;
    const version = item.modifiedTime ? new Date(item.modifiedTime).getTime() : "current";
    const imageSrc = item.isFolder
      ? `/api/drive-file?coverFolder=${encodeURIComponent(item.id)}&path=${encodeURIComponent(pathKey)}&v=${version}`
      : item.mimeType.startsWith("image/")
        ? `/api/drive-file?id=${encodeURIComponent(item.id)}&path=${encodeURIComponent(pathKey)}&v=${version}`
        : null;
    return (
      <article
        key={item.id}
        className="group min-w-0 overflow-hidden rounded-md border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md"
      >
        <button
          type="button"
          onClick={() => item.isFolder && openFolder(item)}
          disabled={!item.isFolder || loading || refreshing}
          className="relative block aspect-[4/3] w-full overflow-hidden bg-secondary text-left disabled:cursor-default"
        >
          <div className="absolute inset-0 grid place-items-center bg-secondary">
            <Icon className="size-12 text-muted-foreground/70" strokeWidth={1.5} />
          </div>
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={`Prévia de ${item.name}`}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          {imageSrc && (
            <div className="absolute inset-0 bg-gradient-to-t from-background/30 to-transparent" />
          )}
          <span className="absolute left-2 top-2 rounded-sm bg-background/90 px-2 py-1 text-[10px] font-bold uppercase text-foreground backdrop-blur">
            {item.isFolder
              ? "Coleção"
              : (item.mimeType.split("/").pop()?.toUpperCase() ?? "Arquivo")}
          </span>
        </button>
        <div className="p-3">
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5" title={item.name}>
            {item.name}
          </h3>
          {!item.isFolder && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
              {halftone && <span className="rounded-sm bg-secondary px-2 py-1 text-foreground">Halftone</span>}
              {paper ? (
                <span className="rounded-sm bg-secondary px-2 py-1 text-foreground" title={paper.source === "dimensions" ? "Identificado pelas dimensões a 300 DPI" : "Formato informado no nome do arquivo ou da pasta"}>
                  {paper.format}
                </span>
              ) : halftone ? <span className="text-muted-foreground">Formato não identificado</span> : null}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="truncate text-[11px] text-muted-foreground">
              {item.isFolder ? "Abrir pasta" : formatDate(item.modifiedTime)}
            </span>
            {item.isFolder ? (
              <Button
                size="icon"
                variant="ghost"
                className="size-11 sm:size-8"
                disabled={loading || refreshing}
                onClick={() => openFolder(item)}
                aria-label={`Abrir ${item.name}`}
              >
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                {!halftone && (item.mimeType.startsWith("image/") || item.mimeType === "application/pdf") && (
                  <Button
                    size="sm"
                    className="h-11 px-3 sm:h-8 sm:px-2"
                    onClick={() =>
                      onUseInHalftone({
                        url: `/api/drive-file?id=${encodeURIComponent(item.id)}&path=${encodeURIComponent(pathKey)}&download=1`,
                        name: item.name,
                      })
                    }
                  >
                    <WandSparkles className="size-3.5" />
                    Usar
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-11 px-2 sm:h-8" asChild>
                  <a
                    href={`/api/drive-file?id=${encodeURIComponent(item.id)}&path=${encodeURIComponent(pathKey)}&download=1`}
                    download={item.name}
                    aria-label={`Baixar ${item.name}`}
                    title={`Download de ${item.name}`}
                  >
                    <Download className="size-4" />
                    Download
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-x-hidden overflow-y-auto overscroll-contain bg-background pb-[env(safe-area-inset-bottom)] text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto grid min-h-16 max-w-[1500px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-black tracking-normal">DTFLEXPRO</p>
              <p className="truncate text-xs text-muted-foreground">Biblioteca de artes</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={onOpenHalftone} className="font-bold">
              <Grid2X2 className="size-4" />
              <span className="hidden sm:inline">Abrir Halftone</span>
              <span className="sm:hidden">Halftone</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] px-3 py-5 sm:px-6 sm:py-8">
        <section className="mb-5 border-b border-border pb-7">
          <p className="mb-2 text-xs font-bold uppercase text-primary">Coleções DTFLEXPRO</p>
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <h1 className="max-w-3xl text-2xl font-black leading-tight sm:text-4xl">
                Encontre a arte certa para sua próxima estampa
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Pastas e arquivos atualizados diretamente pelo acervo DTFLEXPRO.
              </p>
            </div>
            <div className="flex w-full items-center gap-2 lg:max-w-lg">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar nesta pasta"
                  className="h-11 bg-card pl-10"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="size-11 shrink-0"
                disabled={refreshing}
                onClick={() => void loadItems(true)}
                aria-label="Atualizar biblioteca"
                title="Atualizar biblioteca"
              >
                <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </section>

        <div
          className="mb-3 flex min-h-5 items-center justify-end text-xs text-muted-foreground"
          aria-live="polite"
        >
          {refreshing
            ? "Atualizando biblioteca…"
            : lastUpdated
              ? `Atualizada às ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : ""}
        </div>
        <nav
          aria-label="Caminho da biblioteca"
          className="mb-5 flex min-h-9 items-center gap-1 overflow-x-auto whitespace-nowrap pb-1 text-sm"
        >
          {crumbs.map((crumb, index) => (
            <div key={`${crumb.id}-${index}`} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="size-4 text-muted-foreground" />}
              <Button
                variant="ghost"
                size="sm"
                disabled={loading || refreshing}
                onClick={() => goToCrumb(index)}
                className={
                  index === crumbs.length - 1
                    ? "font-bold text-foreground"
                    : "text-muted-foreground"
                }
              >
                {crumb.name}
              </Button>
            </div>
          ))}
        </nav>

        {crumbs.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            className="mb-5"
            disabled={loading || refreshing}
            onClick={() => goToCrumb(crumbs.length - 2)}
          >
            <ArrowLeft className="size-4" /> Voltar
          </Button>
        )}

        {loading && items.length === 0 ? (
          <div className="grid min-h-64 place-items-center text-muted-foreground">
            <LoaderCircle className="size-8 animate-spin" />
          </div>
        ) : error && items.length === 0 ? (
          <div className="grid min-h-64 place-items-center border border-dashed border-border bg-card p-8 text-center">
            <div>
              <ImageOff className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="font-bold">{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => void loadItems(true)}>
                Tentar novamente
              </Button>
            </div>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="grid min-h-64 place-items-center border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
            Nenhum arquivo encontrado nesta pasta.
          </div>
        ) : (
          <div className="space-y-7">
            {error && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
                {error}
              </p>
            )}
            {categories.map((category) => (
              <section key={category.key} aria-labelledby={`category-${category.key}`}>
                <div className="mb-3 flex items-center gap-2 border-b border-border/60 pb-2">
                  <h2 id={`category-${category.key}`} className="text-lg font-black">
                    {category.label}
                  </h2>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-muted-foreground">
                    {category.items.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {category.items.map(renderItem)}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
