import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Upload, ClipboardPaste, Download, Wand2, ZoomIn, ZoomOut, Copy } from "lucide-react";
import { removeBackground as imglyRemoveBackground, preload as imglyPreload } from "@imgly/background-removal";
import { refineMatte, REFINE_PRESETS, type RefineOptions } from "@/lib/matte-refine";

type Level = "rapido" | "profissional" | "ultra";

const MODELS: Record<Level, "isnet_quint8" | "isnet_fp16" | "isnet"> = {
  rapido: "isnet_quint8",
  profissional: "isnet_fp16",
  ultra: "isnet",
};

const ASSET_PATH = "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/";

const LEVEL_INFO: Record<Level, string> = {
  rapido: "Maior velocidade de processamento.",
  profissional: "Melhor equilíbrio entre velocidade e qualidade.",
  ultra: "Máxima precisão, preserva cabelos, fios e detalhes finos.",
};

export function SmartCutoutStudio({ onClose }: { onClose: () => void }) {
  const [level, setLevel] = useState<Level>("profissional");
  const [opts, setOpts] = useState<RefineOptions>(REFINE_PRESETS.profissional);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [outBlob, setOutBlob] = useState<Blob | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [split, setSplit] = useState(50);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    imglyPreload({ model: MODELS[level], publicPath: ASSET_PATH, device: "cpu" }).catch(() => {});
  }, [level]);

  const pickLevel = (l: Level) => {
    setLevel(l);
    setOpts(REFINE_PRESETS[l]);
  };

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Envie um arquivo de imagem.");
    setSrcUrl(URL.createObjectURL(file));
    setOutUrl(null);
    setOutBlob(null);
    setZoom(100);
    const im = new Image();
    im.onload = () => setDims({ w: im.naturalWidth, h: im.naturalHeight });
    im.src = URL.createObjectURL(file);
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = e.clipboardData?.files?.[0];
      if (f?.type.startsWith("image/")) { e.preventDefault(); loadFile(f); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadFile]);

  const pasteBtn = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const t = it.types.find((x) => x.startsWith("image/"));
        if (t) { loadFile(new File([await it.getType(t)], "colado.png", { type: t })); return; }
      }
      toast.error("Nenhuma imagem na área de transferência.");
    } catch { toast.error("Permita acesso à área de transferência."); }
  };

  const run = useCallback(async () => {
    if (!srcUrl) return;
    setBusy(true);
    setProgress(0);
    try {
      const cfg = (model: (typeof MODELS)[Level]) => ({
        model,
        publicPath: ASSET_PATH,
        device: "cpu" as const,
        output: { format: "image/png" as const, quality: 1 },
        progress: (_k: string, c: number, t: number) => setProgress(Math.round((c / t) * 100)),
      });
      let raw: Blob;
      try {
        raw = await imglyRemoveBackground(srcUrl, cfg(MODELS[level]));
      } catch (err) {
        console.warn("Fallback para modelo rápido:", err);
        raw = await imglyRemoveBackground(srcUrl, cfg("isnet_quint8"));
      }
      // Recompõe na resolução original e aplica refinamento de borda.
      const bmp = await createImageBitmap(raw);
      const cv = document.createElement("canvas");
      cv.width = bmp.width; cv.height = bmp.height;
      const ctx = cv.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0);
      const id = ctx.getImageData(0, 0, cv.width, cv.height);
      ctx.putImageData(refineMatte(id, opts), 0, 0);
      const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, "image/png"));
      if (!blob) throw new Error("Falha ao gerar PNG.");
      setOutBlob(blob);
      setOutUrl(URL.createObjectURL(blob));
      setDims({ w: cv.width, h: cv.height });
      toast.success("Recorte pronto — PNG 32 bits com alpha real.");
    } catch (e) {
      console.error(e);
      toast.error("Falha no rastreamento. Verifique a conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  }, [srcUrl, level, opts]);

  const download = () => {
    if (!outUrl) return;
    const a = document.createElement("a");
    a.href = outUrl; a.download = "recorte-transparente.png"; a.click();
  };

  const copy = async () => {
    if (!outBlob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": outBlob })]);
      toast.success("Copiado! Cole no halftone com Ctrl+V.");
    } catch { toast.error("Não foi possível copiar."); }
  };

  const toggle = (k: keyof RefineOptions) => (v: boolean) => setOpts((o) => ({ ...o, [k]: v }));

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
        <Button variant="outline" size="sm" className="gap-1 font-semibold" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" /> Voltar para ferramenta
        </Button>
        <span className="text-sm font-semibold">Rastreamento Inteligente — Recorte com IA</span>
        <div className="w-40" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row">
        {/* Painel */}
        <div className="w-full shrink-0 space-y-4 lg:w-80">
          <div className="rounded-lg border bg-card/40 p-3">
            <Label className="text-xs font-semibold">Modo de Rastreamento Inteligente</Label>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {(["rapido", "profissional", "ultra"] as Level[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => pickLevel(l)}
                  className={`rounded-md border px-2 py-1.5 text-[11px] font-semibold capitalize transition ${
                    level === l ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {l === "rapido" ? "Rápido" : l}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{LEVEL_INFO[level]}</p>
          </div>

          <div className="rounded-lg border bg-card/40 p-3 space-y-2">
            <Label className="text-xs font-semibold">Recursos</Label>
            {([
              ["preserveText", "Preservar textos e logotipos do objeto"],
              ["removeBackgroundObjects", "Remover textos e objetos do fundo"],
              ["detectMultiple", "Detectar múltiplos objetos"],
              ["decontaminate", "Corrigir halos e franjas de cor"],
            ] as Array<[keyof RefineOptions, string]>).map(([k, label]) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <span className="text-[11px] leading-tight">{label}</span>
                <Switch checked={Boolean(opts[k])} onCheckedChange={toggle(k)} />
              </div>
            ))}
            <div className="pt-1">
              <div className="flex justify-between text-[11px]"><span>Anti-halo (contração)</span><span>{opts.antiHalo.toFixed(1)}px</span></div>
              <Slider value={[opts.antiHalo]} min={0} max={3} step={0.2} onValueChange={(v) => setOpts((o) => ({ ...o, antiHalo: v[0] }))} />
            </div>
            <div>
              <div className="flex justify-between text-[11px]"><span>Suavizar contorno</span><span>{opts.feather.toFixed(1)}px</span></div>
              <Slider value={[opts.feather]} min={0} max={4} step={0.2} onValueChange={(v) => setOpts((o) => ({ ...o, feather: v[0] }))} />
            </div>
            <div>
              <div className="flex justify-between text-[11px]"><span>Nitidez da borda</span><span>{opts.edgeContrast.toFixed(2)}</span></div>
              <Slider value={[opts.edgeContrast]} min={0.6} max={2.5} step={0.05} onValueChange={(v) => setOpts((o) => ({ ...o, edgeContrast: v[0] }))} />
            </div>
          </div>

          <div className="flex gap-2">
            <div
              onClick={() => fileRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f); }}
              onDragOver={(e) => e.preventDefault()}
              className="flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-3 text-center hover:border-primary"
            >
              <Upload className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium">Arraste, clique ou cole (Ctrl+V)</span>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
            </div>
            <Button variant="outline" className="h-auto flex-col gap-1 px-3" onClick={pasteBtn}>
              <ClipboardPaste className="h-4 w-4" /><span className="text-[10px]">Colar</span>
            </Button>
          </div>

          <Button onClick={run} disabled={!srcUrl || busy} className="w-full font-bold">
            <Wand2 className="h-4 w-4" />
            {busy ? `Rastreando... ${progress}%` : "Remover fundo"}
          </Button>
          {busy && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={!outUrl} onClick={download}><Download className="h-4 w-4" /> PNG</Button>
            <Button variant="outline" disabled={!outBlob} onClick={copy}><Copy className="h-4 w-4" /> Copiar</Button>
          </div>
          {dims && (
            <p className="text-[11px] text-muted-foreground">
              Resolução preservada: {dims.w} × {dims.h}px · PNG 32 bits · alpha real
            </p>
          )}
        </div>

        {/* Visualização */}
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card/40 px-3 py-2">
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.max(10, z - 25))}><ZoomOut className="h-4 w-4" /></Button>
            <span className="w-14 text-center text-xs font-semibold">{zoom}%</span>
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.min(800, z + 25))}><ZoomIn className="h-4 w-4" /></Button>
            <div className="w-40"><Slider value={[zoom]} min={10} max={800} step={5} onValueChange={(v) => setZoom(v[0])} /></div>
            {outUrl && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Antes / Depois</span>
                <div className="w-40"><Slider value={[split]} min={0} max={100} step={1} onValueChange={(v) => setSplit(v[0])} /></div>
              </div>
            )}
          </div>

          <div className="relative min-h-[300px] flex-1 overflow-auto rounded-lg border bg-[conic-gradient(#e5e5e5_0_25%,#fff_0_50%,#e5e5e5_0_75%,#fff_0)] bg-[length:16px_16px]">
            {!srcUrl ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Envie uma imagem para começar
              </div>
            ) : (
              <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative" style={{ width: `${zoom}%` }}>
                  <img src={srcUrl} alt="Original" className="block w-full" style={{ imageRendering: zoom > 150 ? "pixelated" : "auto" }} />
                  {outUrl && (
                    <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
                      <img src={outUrl} alt="Recorte" className="block w-full bg-[conic-gradient(#e5e5e5_0_25%,#fff_0_50%,#e5e5e5_0_75%,#fff_0)] bg-[length:16px_16px]"
                        style={{ imageRendering: zoom > 150 ? "pixelated" : "auto" }} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
