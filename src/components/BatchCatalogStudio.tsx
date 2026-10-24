import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  FileText,
  ImagePlus,
  LoaderCircle,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Shirt,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { createCatalogMockup } from "@/lib/catalog-mockup";
import type { ShirtModel } from "@/components/landing/shirt-studio/ShirtMockup";
import { supabase } from "@/integrations/supabase/client";
import {
  completeCatalogProduct,
  createCatalogBatch,
  finishCatalogBatch,
  listCatalogTemplates,
  prepareCatalogProductUpload,
  saveCatalogTemplate,
} from "@/lib/catalog.functions";

type Status = "waiting" | "processing" | "done" | "error";
type BatchFile = { id: string; file: File; preview: string; status: Status; code?: string; error?: string; mockups?: number; pdfMockup?: Blob };
type Settings = {
  productType: string;
  colors: string[];
  fabric: string;
  modeling: string;
  sizes: string[];
  models: string[];
  position: string;
  printSize: number;
  brandName: string;
  watermarkText: string;
  logoName?: string;
  watermark: boolean;
  watermarkColor: string;
  watermarkOpacity: number;
  price: number;
  salePrice: number;
  wholesalePrice: number;
  category: string;
  prefix: string;
  sortBy: "upload" | "code" | "name" | "category" | "price";
};

const defaults: Settings = {
  productType: "Camiseta",
  colors: ["#111111"],
  fabric: "Algodão 30.1",
  modeling: "Tradicional",
  sizes: ["P", "M", "G", "GG"],
  models: ["Unissex"],
  position: "Centro",
  printSize: 28,
  brandName: "",
  watermarkText: "",
  watermark: true,
  watermarkColor: "#ffffff",
  watermarkOpacity: 24,
  price: 59.9,
  salePrice: 49.9,
  wholesalePrice: 39.9,
  category: "Camisetas",
  prefix: "CAT",
  sortBy: "upload",
};

const MODEL_OPTIONS = ["Masculino", "Feminino", "Unissex", "Plus Size", "Oversized", "Infantil", "Corpo inteiro"];
const SIZE_OPTIONS = ["PP", "P", "M", "G", "GG", "XG", "G1", "G2", "G3"];
const COLOR_OPTIONS = ["#111111", "#ffffff", "#b91c1c", "#1e3a8a", "#15803d", "#f59e0b", "#7c3aed", "#ec4899"];
const MODEL_MAP: Record<string, ShirtModel> = { Masculino: "careca", Feminino: "baby-look", Unissex: "careca", "Plus Size": "careca", Oversized: "careca", Infantil: "infantil", "Corpo inteiro": "manga-longa" };

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function BatchCatalogStudio({ onClose }: { onClose: () => void }) {
  const createBatch = useServerFn(createCatalogBatch);
  const prepareUpload = useServerFn(prepareCatalogProductUpload);
  const completeProduct = useServerFn(completeCatalogProduct);
  const finishBatch = useServerFn(finishCatalogBatch);
  const saveTemplate = useServerFn(saveCatalogTemplate);
  const readTemplates = useServerFn(listCatalogTemplates);
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const logoRef = useRef<HTMLInputElement | null>(null);
  const runningRef = useRef(false);
  const filesRef = useRef<BatchFile[]>([]);
  const pdfUrlRef = useRef<string | null>(null);
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [settings, setSettings] = useState<Settings>(defaults);
  const [logo, setLogo] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; settings: Settings }>>([]);
  const [templateName, setTemplateName] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfPreparing, setPdfPreparing] = useState(false);

  useEffect(() => {
    readTemplates().then((result: any) => setTemplates(result.templates ?? [])).catch(() => {});
  }, [readTemplates]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => () => {
    filesRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
  }, []);

  const complete = files.filter((item) => item.status === "done").length;
  const failed = files.filter((item) => item.status === "error").length;
  const mockups = files.reduce((total, item) => total + (item.mockups ?? 0), 0);
  const progress = files.length ? Math.round(((complete + failed) / files.length) * 100) : 0;
  const variationCount = settings.colors.length * settings.models.length;
  const finished = files.length >= 20 && !running && complete + failed === files.length;

  const addFiles = (incoming: FileList | File[]) => {
    if (runningRef.current) return;
    const pngs = Array.from(incoming).filter((file) => file.type === "image/png").slice(0, 100 - files.length);
    if (!pngs.length) return toast.error("Selecione arquivos PNG.");
    if (Array.from(incoming).length > pngs.length) toast.warning("Somente PNGs e até 100 arquivos foram adicionados.");
    setFiles((current) => [...current, ...pngs.map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), status: "waiting" as const }))]);
  };

  const toggleList = (key: "sizes" | "models", value: string) => setSettings((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }));
  const toggleColor = (color: string) => setSettings((current) => ({ ...current, colors: current.colors.includes(color) ? current.colors.filter((item) => item !== color) : [...current.colors, color] }));
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((current) => ({ ...current, [key]: value }));

  const processOne = async (item: BatchFile, order: number, id: string, start: number): Promise<BatchFile | null> => {
    const code = `${settings.prefix.toUpperCase()}-${String(start + order).padStart(3, "0")}`;
    setFiles((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "processing", code, error: undefined } : entry));
    try {
      const combinations = settings.models.flatMap((model) => settings.colors.map((color) => ({ model, color })));
      if (combinations.length > 24) throw new Error("Escolha no máximo 24 combinações de modelo e cor.");
      if (item.file.size > 20 * 1024 * 1024) throw new Error("PNG maior que 20 MB.");
      const artImage = await createImageBitmap(item.file);
      let blobs: Blob[];
      try {
        blobs = [];
        for (const combination of combinations) {
          blobs.push(await createCatalogMockup({ art: item.file, artImage, logo, model: MODEL_MAP[combination.model] ?? "careca", color: combination.color, brandName: settings.brandName, watermarkText: settings.watermarkText, watermark: settings.watermark, watermarkColor: settings.watermarkColor, watermarkOpacity: settings.watermarkOpacity, printSize: settings.printSize, position: settings.position as "Peito" | "Centro" | "Costas" }));
        }
      } finally {
        artImage.close();
      }
      const prepared = await prepareUpload({ data: { batchId: id, code, originalName: item.file.name, mockupCount: blobs.length } });
      const uploads = [supabase.storage.from("catalog-assets").uploadToSignedUrl(prepared.original.path, prepared.original.token, item.file, { contentType: "image/png" })];
      for (let index = 0; index < blobs.length; index += 1) {
        const target = prepared.mockups[index];
        if (!target) throw new Error("Destino de mockup inválido.");
        uploads.push(supabase.storage.from("catalog-assets").uploadToSignedUrl(target.path, target.token, blobs[index], { contentType: "image/jpeg" }));
      }
      const uploaded = await Promise.all(uploads);
      const failedUpload = uploaded.find((result) => result.error);
      if (failedUpload?.error) throw new Error("Falha ao enviar uma imagem do catálogo.");
      const result: any = await completeProduct({ data: { batchId: id, code, order, originalName: item.file.name, originalPath: prepared.original.path, mockupPaths: prepared.mockups.map((target) => target.path), settings: { ...settings, logoName: logo?.name } } });
      const completed: BatchFile = { ...item, status: "done", code: result.code, mockups: result.mockups, pdfMockup: blobs[0] };
      setFiles((current) => current.map((entry) => entry.id === item.id ? completed : entry));
      return completed;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível processar esta imagem.";
      setFiles((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "error", code, error: message } : entry));
      return null;
    }
  };

  const generate = async () => {
    if (runningRef.current) return;
    if (files.length < 20) return toast.error("Adicione pelo menos 20 PNGs.");
    if (!settings.colors.length || !settings.models.length || !settings.sizes.length) return toast.error("Escolha ao menos uma cor, modelo e tamanho.");
    if (variationCount > 24) return toast.error("Reduza para no máximo 24 variações por estampa.");
    runningRef.current = true;
    setRunning(true);
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    pdfUrlRef.current = null;
    setPdfUrl(null);
    setFiles((current) => current.map((item) => ({ ...item, status: "waiting", error: undefined, code: undefined, mockups: 0, pdfMockup: undefined })));
    try {
      const started: any = await createBatch({ data: { name: `${settings.brandName || "Catálogo"} ${new Date().toLocaleDateString("pt-BR")}`, total: files.length, settings: { ...settings, logoName: logo?.name } } });
      setBatchId(started.id);
      let successes = 0;
      let errors = 0;
      const completedProducts: BatchFile[] = [];
      const workFiles = settings.sortBy === "name"
        ? [...files].sort((a, b) => a.file.name.localeCompare(b.file.name, "pt-BR"))
        : files;
      for (let index = 0; index < workFiles.length && runningRef.current; index += 1) {
        let succeeded: BatchFile | null = null;
        for (let attempt = 0; attempt < 3 && !succeeded && runningRef.current; attempt += 1) {
          succeeded = await processOne(workFiles[index], index, started.id, started.start);
          if (!succeeded && attempt < 2) await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
        }
        if (succeeded) { successes += 1; completedProducts.push(succeeded); }
        else errors += 1;
      }
      if (!runningRef.current) {
        const interrupted = files.length - successes - errors;
        errors += interrupted;
        setFiles((current) => current.map((item) => item.status === "waiting" ? { ...item, status: "error", error: "Processamento interrompido." } : item));
      }
      await finishBatch({ data: { id: started.id, completed: successes, failed: errors } });
       if (completedProducts.length) {
         try {
           const readyUrl = await preparePdf(completedProducts, settings);
           if (readyUrl) {
             downloadPdf(readyUrl);
             toast.success(errors ? "PDF baixado; revise os arquivos com falha." : "Catálogo concluído e PDF baixado!");
           }
         } catch (error) {
           toast.error("O catálogo terminou, mas não foi possível preparar o PDF. Tente baixar novamente.");
         }
       } else {
         toast.error("Nenhuma estampa foi concluída. Confira os erros e tente novamente.");
       }
       if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("DTFLEXPRO", { body: "Seu catálogo foi concluído!" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar catálogo.");
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  };

  const retry = async (item: BatchFile) => {
    if (!batchId || runningRef.current) return;
    const index = files.findIndex((entry) => entry.id === item.id);
    const firstCode = Number(files.find((entry) => entry.code)?.code?.split("-").pop()) || 1;
    runningRef.current = true;
    setRunning(true);
    try {
      const succeeded = await processOne(item, index, batchId, firstCode);
      if (succeeded) {
        const updated = files.map((entry) => entry.id === item.id ? succeeded : entry);
        await finishBatch({ data: { id: batchId, completed: updated.filter((entry) => entry.status === "done").length, failed: updated.filter((entry) => entry.status === "error").length } });
        const readyUrl = await preparePdf(updated.filter((entry) => entry.status === "done"), settings);
        if (readyUrl) downloadPdf(readyUrl);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o PDF.");
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  };

  const preparePdf = async (items: BatchFile[], configuration: Settings) => {
    const products = items.filter((item) => item.status === "done" && item.code && item.pdfMockup);
    if (!products.length) return null;
    setPdfPreparing(true);
    try {
    const [{ jsPDF }, images] = await Promise.all([
      import("jspdf"),
      Promise.all(products.map((item) => item.pdfMockup?.arrayBuffer().then((buffer) => new Uint8Array(buffer)))),
    ]);
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const brand = configuration.brandName || "DTFLEXPRO Catálogo";
    const catalogName = `${configuration.brandName || "Catálogo"} ${new Date().toLocaleDateString("pt-BR")}`;
    pdf.setFillColor(11, 16, 28); pdf.rect(0, 0, 210, 297, "F"); pdf.setTextColor(255, 214, 10); pdf.setFontSize(28); pdf.text(brand, 105, 130, { align: "center" }); pdf.setTextColor(255, 255, 255); pdf.setFontSize(14); pdf.text(catalogName, 105, 145, { align: "center" });
    pdf.addPage(); pdf.setTextColor(20, 20, 20); pdf.setFontSize(20); pdf.text("Índice", 16, 20); pdf.setFontSize(9);
    products.forEach((product, index) => { const y = 32 + (index % 42) * 6; if (index && index % 42 === 0) { pdf.addPage(); pdf.text("Índice", 16, 20); } pdf.text(`${product.code}  |  ${product.file.name.replace(/\.[^.]+$/, "")}  |  ${money(configuration.price)}`, 16, y); });
    for (const [index, product] of products.entries()) {
      pdf.addPage(); pdf.setFontSize(18); pdf.text(product.code ?? "", 16, 18); pdf.setFontSize(13); pdf.text(product.file.name.replace(/\.[^.]+$/, ""), 16, 27); if (images[index]) pdf.addImage(images[index], "JPEG", 25, 36, 160, 160); pdf.setFontSize(11); pdf.text(`Preço: ${money(configuration.price)}`, 16, 210); pdf.text(`${configuration.productType} em ${configuration.fabric}. Tamanhos ${configuration.sizes.join(", ")}.`, 16, 220, { maxWidth: 178 });
    }
    pdf.addPage(); pdf.setFillColor(11, 16, 28); pdf.rect(0, 0, 210, 297, "F"); pdf.setTextColor(255, 214, 10); pdf.setFontSize(24); pdf.text(brand, 105, 140, { align: "center" });
    const nextUrl = URL.createObjectURL(pdf.output("blob"));
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    pdfUrlRef.current = nextUrl;
    setPdfUrl(nextUrl);
    return nextUrl;
    } finally {
      setPdfPreparing(false);
    }
  };

  const downloadPdf = (url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${settings.prefix.toLowerCase()}-catalogo.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const exportPdf = async () => {
    const readyUrl = pdfUrlRef.current ?? await preparePdf(files, settings);
    if (!readyUrl) return toast.error("Não há produtos prontos para o PDF.");
    downloadPdf(readyUrl);
  };

  const move = (index: number, direction: -1 | 1) => setFiles((current) => { const next = [...current]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; });

  return (
    <div className="fixed inset-0 z-[120] flex min-w-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex min-h-16 items-center gap-3 border-b border-border bg-card px-3 py-2 sm:px-5">
        <Button variant="outline" className="h-11 shrink-0 border-amber-400 text-amber-300" onClick={onClose}><ArrowLeft className="size-4" /> Voltar</Button>
        <div className="min-w-0"><h1 className="truncate text-base font-black sm:text-xl">Catálogo em Lote</h1><p className="hidden text-xs text-muted-foreground sm:block">20 a 100 PNGs · produtos, mockups e PDF</p></div>
        <div className="ml-auto rounded-md border border-border bg-background px-3 py-2 text-sm font-bold">{files.length} / 100</div>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
        <div className="mx-auto grid max-w-[1500px] min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <section className="min-w-0 space-y-5">
            <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }} className={`grid min-h-52 place-items-center rounded-lg border-2 border-dashed p-6 text-center transition ${dragging ? "border-primary bg-primary/10" : "border-border bg-card/60"}`}>
              <div><UploadCloud className="mx-auto mb-3 size-10 text-primary" /><h2 className="text-lg font-black">ADICIONAR ESTAMPAS EM LOTE</h2><p className="mt-1 text-sm text-muted-foreground">Arraste de 20 a 100 PNGs para esta área</p><input ref={pickerRef} type="file" accept="image/png" multiple className="hidden" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} /><Button className="mt-4 h-11" onClick={() => pickerRef.current?.click()}><ImagePlus className="size-4" /> Selecionar arquivos</Button></div>
            </div>

            {files.length > 0 && <div className="rounded-lg border border-border bg-card/70 p-3"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Estampas selecionadas</h2><Button variant="ghost" size="sm" disabled={running} onClick={() => { files.forEach((item) => URL.revokeObjectURL(item.preview)); setFiles([]); }}><Trash2 className="size-4" /> Limpar</Button></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{files.map((item, index) => <article key={item.id} draggable={!running} onDragStart={(event) => event.dataTransfer.setData("text/index", String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const from = Number(event.dataTransfer.getData("text/index")); setFiles((current) => { const next = [...current]; const [picked] = next.splice(from, 1); if (picked) next.splice(index, 0, picked); return next; }); }} className="relative overflow-hidden rounded-md border border-border bg-background"><img src={item.preview} alt={item.file.name} className="aspect-square w-full object-contain p-2" /><div className="border-t border-border p-2"><p className="truncate text-xs font-semibold">{item.code || item.file.name}</p><div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">{item.status === "done" && <Check className="size-3 text-emerald-400" />}{item.status === "processing" && <LoaderCircle className="size-3 animate-spin text-primary" />}{item.status === "error" && <X className="size-3 text-destructive" />}{item.status === "waiting" ? "Aguardando" : item.status === "processing" ? "Processando" : item.status === "done" ? "Concluído" : "Erro"}</div>{item.error && <p className="mt-1 text-[10px] text-destructive">{item.error}</p>}<div className="mt-2 flex gap-1"><Button variant="ghost" size="icon" className="size-7" disabled={running || index === 0} onClick={() => move(index, -1)}><ArrowUp className="size-3" /></Button><Button variant="ghost" size="icon" className="size-7" disabled={running || index === files.length - 1} onClick={() => move(index, 1)}><ArrowDown className="size-3" /></Button>{item.status === "error" && <Button variant="outline" size="sm" className="h-7 px-2" disabled={running} onClick={() => void retry(item)}><RefreshCw className="size-3" /> Tentar</Button>}</div></div></article>)}</div></div>}

            {(running || complete + failed > 0) && <div className="rounded-lg border border-border bg-card p-4"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase text-primary">Gerando catálogo</p><p className="text-2xl font-black">{complete + failed} / {files.length}</p></div><strong>{progress}% concluído</strong></div><Progress className="mt-3 h-3" value={progress} /><div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded-md bg-background p-3"><strong className="block text-lg">{complete}</strong>Produtos</div><div className="rounded-md bg-background p-3"><strong className="block text-lg">{mockups}</strong>Mockups</div><div className="rounded-md bg-background p-3"><strong className="block text-lg text-destructive">{failed}</strong>Falhas</div></div></div>}

            {finished && <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-5 text-center"><Check className="mx-auto size-10 text-emerald-400" /><h2 className="mt-2 text-xl font-black">CATÁLOGO GERADO COM SUCESSO</h2><p className="mt-1 text-sm text-muted-foreground">{complete} estampas · {complete} produtos · {complete} códigos · {mockups} mockups</p><Button className="mt-4 h-12 w-full max-w-sm text-base font-black" disabled={pdfPreparing || !pdfUrl} onClick={() => void exportPdf()}>{pdfPreparing ? <LoaderCircle className="size-5 animate-spin" /> : <FileText className="size-5" />} {pdfPreparing ? "PREPARANDO PDF..." : "BAIXAR CATÁLOGO EM PDF"}</Button><div><Button variant="outline" className="mt-3" onClick={() => { setFiles((current) => current.map((item) => ({ ...item, status: "waiting", code: undefined, error: undefined, mockups: 0, pdfMockup: undefined }))); setBatchId(null); }}><Plus className="size-4" /> Gerar outra variação</Button></div></div>}
          </section>

          <aside className="min-w-0 space-y-4 xl:sticky xl:top-0 xl:self-start">
            <ConfigSection title="Produto"><Field label="Tipo"><Input value={settings.productType} onChange={(e) => update("productType", e.target.value)} /></Field><Field label="Tecido"><Input value={settings.fabric} onChange={(e) => update("fabric", e.target.value)} /></Field><Field label="Modelagem"><Input value={settings.modeling} onChange={(e) => update("modeling", e.target.value)} /></Field><Field label="Posição"><select className="h-11 w-full rounded-md border border-input bg-background px-3" value={settings.position} onChange={(e) => update("position", e.target.value)}><option>Peito</option><option>Centro</option><option>Costas</option></select></Field><Field label={`Tamanho da estampa: ${settings.printSize} cm`}><Slider min={5} max={60} step={1} value={[settings.printSize]} onValueChange={([value]) => update("printSize", value)} /></Field><ChoiceGrid title="Tamanhos" values={SIZE_OPTIONS} selected={settings.sizes} toggle={(value) => toggleList("sizes", value)} /></ConfigSection>
            <ConfigSection title={`Variações (${variationCount})`}><ChoiceGrid title="Modelos" values={MODEL_OPTIONS} selected={settings.models} toggle={(value) => toggleList("models", value)} /><div><p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Cores da camiseta</p><div className="flex flex-wrap gap-2">{COLOR_OPTIONS.map((color) => <button key={color} type="button" aria-label={`Cor ${color}`} onClick={() => toggleColor(color)} className={`size-10 rounded-full border-2 ${settings.colors.includes(color) ? "border-primary ring-2 ring-primary/40" : "border-border"}`} style={{ backgroundColor: color }} />)}<input type="color" className="size-10 rounded-full border border-border bg-transparent" onChange={(e) => { if (!settings.colors.includes(e.target.value)) update("colors", [...settings.colors, e.target.value]); }} /></div></div></ConfigSection>
            <ConfigSection title="Marca"><Field label="Nome da marca"><Input value={settings.brandName} onChange={(e) => update("brandName", e.target.value)} placeholder="Nome que aparece no catálogo" /></Field><input ref={logoRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setLogo(file); update("logoName", file.name); } }} /><Button variant="outline" className="w-full" onClick={() => logoRef.current?.click()}><UploadCloud className="size-4" /> {logo ? logo.name : "Adicionar logo"}</Button><label className="flex items-center gap-2 text-sm"><Checkbox checked={settings.watermark} onCheckedChange={(checked) => update("watermark", checked === true)} /> Aplicar marca d'água</label>{settings.watermark && <Field label="Nome na marca d'água"><Input value={settings.watermarkText} maxLength={80} onChange={(e) => update("watermarkText", e.target.value)} placeholder="Digite o nome manualmente" /></Field>}<div className="grid grid-cols-[70px_1fr] gap-3"><input type="color" value={settings.watermarkColor} onChange={(e) => update("watermarkColor", e.target.value)} className="h-10 w-full rounded-md border border-border bg-transparent" /><Field label={`Opacidade ${settings.watermarkOpacity}%`}><Slider min={0} max={80} value={[settings.watermarkOpacity]} onValueChange={([value]) => update("watermarkOpacity", value)} /></Field></div></ConfigSection>
            <ConfigSection title="Comercial"><div className="grid grid-cols-3 gap-2"><Field label="Preço"><Input type="number" min="0" step="0.01" value={settings.price} onChange={(e) => update("price", Number(e.target.value))} /></Field><Field label="Promo"><Input type="number" min="0" step="0.01" value={settings.salePrice} onChange={(e) => update("salePrice", Number(e.target.value))} /></Field><Field label="Atacado"><Input type="number" min="0" step="0.01" value={settings.wholesalePrice} onChange={(e) => update("wholesalePrice", Number(e.target.value))} /></Field></div><Field label="Categoria"><Input value={settings.category} onChange={(e) => update("category", e.target.value)} placeholder="Crie ou escolha uma categoria" /></Field><div className="grid grid-cols-2 gap-2"><Field label="Prefixo"><Input value={settings.prefix} maxLength={16} onChange={(e) => update("prefix", e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())} /></Field><Field label="Ordenar por"><select className="h-11 w-full rounded-md border border-input bg-background px-3" value={settings.sortBy} onChange={(e) => update("sortBy", e.target.value as Settings["sortBy"])}><option value="upload">Upload</option><option value="code">Código</option><option value="name">Nome</option><option value="category">Categoria</option><option value="price">Preço</option></select></Field></div></ConfigSection>
            <ConfigSection title="Modelo salvo"><div className="flex gap-2"><Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Camiseta Algodão 30.1" /><Button size="icon" aria-label="Salvar configuração" disabled={!templateName.trim()} onClick={async () => { await saveTemplate({ data: { name: templateName.trim(), settings: { ...settings, logoName: logo?.name } } }); const result: any = await readTemplates(); setTemplates(result.templates ?? []); toast.success("Configuração salva."); }}><Save className="size-4" /></Button></div>{templates.length > 0 && <select className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3" defaultValue="" onChange={(e) => { const chosen = templates.find((item) => item.id === e.target.value); if (chosen) setSettings({ ...defaults, ...chosen.settings }); }}><option value="">Selecionar modelo</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</ConfigSection>
            {running ? <Button variant="destructive" className="h-14 w-full text-base font-black" onClick={() => { runningRef.current = false; toast.info("Interrompendo após o arquivo atual."); }}><X className="size-5" /> INTERROMPER FILA</Button> : <Button className="h-14 w-full text-base font-black" disabled={files.length < 20} onClick={() => void generate()}><Rocket className="size-5" /> GERAR CATÁLOGO COMPLETO</Button>}
            {files.length > 0 && files.length < 20 && <p className="text-center text-xs text-amber-300">Adicione mais {20 - files.length} PNGs para iniciar.</p>}
          </aside>
        </div>
      </main>
    </div>
  );
}

function ConfigSection({ title, children }: { title: string; children: ReactNode }) { return <section className="space-y-3 rounded-lg border border-border bg-card/80 p-4"><h2 className="flex items-center gap-2 font-black"><Shirt className="size-4 text-primary" />{title}</h2>{children}</section>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>; }
function ChoiceGrid({ title, values, selected, toggle }: { title: string; values: string[]; selected: string[]; toggle: (value: string) => void }) { return <div><p className="mb-2 text-xs font-bold uppercase text-muted-foreground">{title}</p><div className="flex flex-wrap gap-2">{values.map((value) => <Button key={value} type="button" size="sm" variant={selected.includes(value) ? "default" : "outline"} className="min-h-10" onClick={() => toggle(value)}>{value}</Button>)}</div></div>; }