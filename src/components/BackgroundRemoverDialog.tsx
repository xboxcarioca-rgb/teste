import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, Wand2, Download, Sparkles, Copy, ClipboardPaste, Shirt, Image as ImageIcon, Sparkle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { removeBackground as imglyRemoveBackground, preload as imglyPreload } from "@imgly/background-removal";
import { useServerFn } from "@tanstack/react-start";
import { generateShirtMockups } from "@/lib/mockups.functions";
import { generateImageFromPrompt } from "@/lib/imagegen.functions";
import { cleanAlphaBlob } from "@/lib/clean-alpha";

type Props = { trigger: React.ReactNode };
type Mode = "remove" | "black" | "mockup" | "ai";

const SHIRT_COLORS = [
  "#000000", "#808080", "#1e3a8a", "#0f766e", "#dc2626",
  "#ea580c", "#f59e0b", "#65a30d", "#db2777", "#7c3aed", "#451a03",
];

export function BackgroundRemoverDialog({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("remove");
  const [progress, setProgress] = useState(0);
  const [blackThresh, setBlackThresh] = useState(22);



  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [processing, setProcessing] = useState(false);

  // Mockup state
  const [shirtColor, setShirtColor] = useState("#000000");
  const [mockups, setMockups] = useState<{ frontal: string; modelo: string; dobrado: string } | null>(null);

  // AI image gen state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiImage, setAiImage] = useState<string | null>(null);
  const [aiBlob, setAiBlob] = useState<Blob | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const genMockups = useServerFn(generateShirtMockups);
  const genAiImage = useServerFn(generateImageFromPrompt);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem.");
      return;
    }
    setOriginalFile(file);
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    setResultUrl(null);
    setResultBlob(null);
    setMockups(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handlePaste = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          const blob = await item.getType(type);
          handleFile(new File([blob], "colado.png", { type }));
          toast.success("Imagem colada.");
          return;
        }
      }
      toast.error("Nenhuma imagem na área de transferência.");
    } catch {
      toast.error("Permita acesso à área de transferência.");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPasteEv = (e: ClipboardEvent) => {
      const f = e.clipboardData?.files?.[0];
      if (f && f.type.startsWith("image/")) {
        e.preventDefault();
        handleFile(f);
      }
    };
    window.addEventListener("paste", onPasteEv);
    return () => window.removeEventListener("paste", onPasteEv);
  }, [open]);

  const getCanvasFromImg = () => {
    const img = imgRef.current;
    if (!img || !img.complete) return null;
    const w = img.naturalWidth, h = img.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return { canvas, ctx, w, h };
  };

  const finalize = async (canvas: HTMLCanvasElement) => {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    if (blob) {
      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
    }
  };
  // Pré-carrega o modelo de IA quando o diálogo abre, deixando a 1ª execução quase instantânea.
  useEffect(() => {
    if (!open) return;
    imglyPreload({ model: "isnet_quint8" }).catch(() => {});
  }, [open]);


  const removeBackground = useCallback(async () => {
    if (!originalUrl) return;
    setProcessing(true);
    setProgress(0);
    try {
      const rawBlob = await imglyRemoveBackground(originalUrl, {
        model: "isnet_quint8",
        output: { format: "image/png", quality: 0.85 },
        progress: (_k, c, t) => setProgress(Math.round((c / t) * 100)),
      });
      // Limpeza automática do canal alpha: zera pixels flutuantes / poeira.
      const cleaned = await cleanAlphaBlob(rawBlob, { alphaThreshold: 8, minClusterSize: 12 });
      setResultBlob(cleaned);
      setResultUrl(URL.createObjectURL(cleaned));
      toast.success("Fundo removido. PNG limpo, pronto para DTF.");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao remover fundo.");
    } finally {
      setProcessing(false);
    }
  }, [originalUrl]);

  const makeBlackBackground = useCallback(async () => {
    const ref = getCanvasFromImg();
    if (!ref) return;
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 20));
    const { canvas, ctx, w, h } = ref;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 255) {
        const k = a / 255;
        data[i] = Math.round(r * k);
        data[i + 1] = Math.round(g * k);
        data[i + 2] = Math.round(b * k);
        data[i + 3] = 255;
      }
      if (data[i] < blackThresh && data[i + 1] < blackThresh && data[i + 2] < blackThresh) {
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    await finalize(canvas);
    setProcessing(false);
  }, [blackThresh]);




  const runMockups = useCallback(async () => {
    if (!originalFile) return;
    setProcessing(true);
    setMockups(null);
    try {
      const buf = await originalFile.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      const res = await genMockups({
        data: { imageBase64: b64, imageMime: originalFile.type || "image/png", shirtColor },
      });
      setMockups(res);
      toast.success("Mockups gerados!");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Falha ao gerar mockups.");
    } finally {
      setProcessing(false);
    }
  }, [originalFile, shirtColor, genMockups]);

  const runAiImage = useCallback(async () => {
    if (!aiPrompt.trim()) {
      toast.error("Descreva a imagem.");
      return;
    }
    setProcessing(true);
    setAiImage(null);
    setAiBlob(null);
    try {
      const res = await genAiImage({ data: { prompt: aiPrompt.trim() } });
      setAiImage(res.dataUrl);
      // converte para blob para copiar
      const blob = await (await fetch(res.dataUrl)).blob();
      setAiBlob(blob);
      toast.success("Imagem gerada!");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Falha ao gerar imagem.");
    } finally {
      setProcessing(false);
    }
  }, [aiPrompt, genAiImage]);

  const useAiAsInput = () => {
    if (!aiBlob) return;
    const file = new File([aiBlob], "ia-gerada.png", { type: "image/png" });
    handleFile(file);
    setMode("remove");
    toast.success("Imagem carregada. Agora remova o fundo.");
  };

  const copyAi = async () => {
    if (!aiBlob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": aiBlob })]);
      toast.success("Copiado! Cole no halftone com Ctrl+V.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const save = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = mode === "remove" ? "sem-fundo.png" : "fundo-preto.png";
    a.click();
  };

  const copyResult = async () => {
    if (!resultBlob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": resultBlob })]);
      toast.success("Copiado! Cole no halftone com Ctrl+V.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const downloadUrl = (url: string, name: string) => {
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Preparar Arte para Halftone
          </DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setResultUrl(null); setResultBlob(null); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="remove" className="gap-2">
              <Wand2 className="h-4 w-4" /> Remover Fundo
            </TabsTrigger>
            <TabsTrigger value="black" className="gap-2">
              <Shirt className="h-4 w-4" /> Fundo Preto
            </TabsTrigger>
          </TabsList>

          <div className="mt-2 flex gap-2">
            <div className="flex-1 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <ImageIcon className="h-3 w-3" />
              <span className="line-through opacity-50">Gerar Mockup</span>
              <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Em manutenção</span>
            </div>
            <div className="flex-1 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <Sparkle className="h-3 w-3" />
              <span className="line-through opacity-50">Gerar por IA</span>
              <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Em manutenção</span>
            </div>
          </div>

          {/* Upload comum */}
          <div className="mt-4 flex gap-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-card/40 p-4 text-center hover:border-primary"
            >
              <Upload className="h-6 w-6 text-primary" />
              <p className="text-sm font-medium">Arraste, clique ou cole (Ctrl+V)</p>
              <p className="text-[11px] text-muted-foreground">PNG, JPG, WEBP</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
            <Button type="button" variant="outline" onClick={handlePaste} className="h-auto flex-col gap-1 px-3">
              <ClipboardPaste className="h-5 w-5" />
              <span className="text-[11px]">Colar</span>
            </Button>
          </div>

          {/* === REMOVER FUNDO === */}
          <TabsContent value="remove" className="mt-4 space-y-4">
            <div className="rounded-lg border border-border bg-card/40 p-4 space-y-2">
              <p className="text-sm font-semibold text-red-600">Removedor de fundo básico</p>
              <p className="text-[11px] text-muted-foreground">
                Modelo otimizado para velocidade máxima. Preserva cabelo, dedos e bordas. Primeira execução baixa o modelo (~25MB).
              </p>
              {processing && progress > 0 && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Processando... {progress}%</p>
                </div>
              )}
            </div>
            <Button
              onClick={removeBackground}
              disabled={!originalUrl || processing}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              <Wand2 className="h-4 w-4" />
              {processing ? "Processando..." : "Remover Fundo"}
            </Button>
            {renderPreview(originalUrl, resultUrl, imgRef, false)}
            <ResultActions resultUrl={resultUrl} resultBlob={resultBlob} onSave={save} onCopy={copyResult} />
          </TabsContent>

          {/* === FUNDO PRETO === */}
          <TabsContent value="black" className="mt-4 space-y-4">
            <div className="rounded-lg border border-border bg-card/40 p-4 space-y-3">
              <p className="text-sm font-semibold">Fundo preto absoluto (#000000)</p>
              <p className="text-[11px] text-muted-foreground">
                Ideal para camisa preta. Compõe sobre preto puro; pretos imperfeitos viram preto absoluto.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Limite de preto</span>
                  <span className="text-muted-foreground">{blackThresh}</span>
                </div>
                <Slider value={[blackThresh]} min={0} max={60} step={1} onValueChange={(v) => setBlackThresh(v[0])} />
              </div>
            </div>
            <Button
              onClick={makeBlackBackground}
              disabled={!originalUrl || processing}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
            >
              <Shirt className="h-4 w-4" />
              {processing ? "Processando..." : "Aplicar Fundo Preto"}
            </Button>
            {renderPreview(originalUrl, resultUrl, imgRef, true)}
            <ResultActions resultUrl={resultUrl} resultBlob={resultBlob} onSave={save} onCopy={copyResult} />
          </TabsContent>






          {/* === GERAR MOCKUP === */}
          <TabsContent value="mockup" className="mt-4 space-y-4">
            <div className="rounded-lg border border-border bg-card/40 p-4 space-y-3">
              <p className="text-sm font-semibold">Gerar 3 mockups realistas</p>
              <p className="text-[11px] text-muted-foreground">
                Envie a estampa PNG, escolha a cor da camisa e receba 3 mockups (frontal, em modelo e dobrado).
                A IA preserva 100% das cores e textos. Leva ~5-15s.
              </p>
              <div>
                <Label className="text-xs">Cor da camisa</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SHIRT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setShirtColor(c)}
                      className={`h-9 w-9 rounded-md border-2 transition ${shirtColor === c ? "border-primary scale-110" : "border-border"}`}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                  <Input
                    value={shirtColor}
                    onChange={(e) => setShirtColor(e.target.value)}
                    className="h-9 w-32"
                    placeholder="#000000"
                  />
                </div>
              </div>
            </div>
            <Button
              onClick={runMockups}
              disabled={!originalFile || processing}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              <ImageIcon className="h-4 w-4" />
              {processing ? "Gerando 3 mockups..." : "Gerar 3 Mockups"}
            </Button>

            {originalUrl && !mockups && (
              <div className="overflow-hidden rounded-md border border-border bg-[conic-gradient(#e5e5e5_0_25%,#fff_0_50%,#e5e5e5_0_75%,#fff_0)] bg-[length:16px_16px]">
                <img src={originalUrl} alt="Arte" className="h-48 w-full object-contain" />
              </div>
            )}

            {mockups && (
              <div className="grid gap-3 sm:grid-cols-3">
                {(["frontal", "modelo", "dobrado"] as const).map((k) => (
                  <div key={k} className="space-y-2">
                    <Label className="text-xs capitalize">{k === "modelo" ? "Em modelo" : k === "dobrado" ? "Dobrado" : "Frontal"}</Label>
                    <div className="overflow-hidden rounded-md border border-border bg-card">
                      <img src={mockups[k]} alt={k} className="h-56 w-full object-contain" />
                    </div>
                    <Button
                      onClick={() => downloadUrl(mockups[k], `mockup-${k}.png`)}
                      variant="outline"
                      className="w-full"
                      size="sm"
                    >
                      <Download className="h-3 w-3" /> Baixar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* === GERAR POR IA === */}
          <TabsContent value="ai" className="mt-4 space-y-4">
            <div className="rounded-lg border border-border bg-card/40 p-4 space-y-3">
              <p className="text-sm font-semibold">Gerar imagem por prompt (ilimitado)</p>
              <p className="text-[11px] text-muted-foreground">
                Descreva a arte que quer criar. A IA gera uma imagem em ~5-10s. Depois você pode remover o fundo, aplicar fundo preto ou enviar direto para o halftone.
              </p>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder='Ex: "caveira mexicana com flores, estilo tatuagem, traços pretos sólidos, fundo branco"'
                rows={3}
              />
            </div>
            <Button
              onClick={runAiImage}
              disabled={processing || !aiPrompt.trim()}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              <Sparkle className="h-4 w-4" />
              {processing ? "Gerando imagem..." : "Gerar Imagem"}
            </Button>

            {aiImage && (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-md border border-border bg-[conic-gradient(#e5e5e5_0_25%,#fff_0_50%,#e5e5e5_0_75%,#fff_0)] bg-[length:16px_16px]">
                  <img src={aiImage} alt="IA" className="h-72 w-full object-contain" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button onClick={() => downloadUrl(aiImage, "ia-gerada.png")} variant="outline">
                    <Download className="h-4 w-4" /> Salvar
                  </Button>
                  <Button onClick={copyAi} variant="outline" disabled={!aiBlob}>
                    <Copy className="h-4 w-4" /> Copiar p/ Halftone
                  </Button>
                  <Button onClick={useAiAsInput} variant="outline" disabled={!aiBlob}>
                    <Wand2 className="h-4 w-4" /> Remover Fundo
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function renderPreview(
  originalUrl: string | null,
  resultUrl: string | null,
  imgRef: React.RefObject<HTMLImageElement | null>,
  blackBg: boolean,
) {
  if (!originalUrl) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border bg-card/30 text-sm text-muted-foreground">
        Envie ou cole uma imagem para começar
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label className="text-xs">Original</Label>
        <div className="mt-1 overflow-hidden rounded-md border border-border bg-[conic-gradient(#e5e5e5_0_25%,#fff_0_50%,#e5e5e5_0_75%,#fff_0)] bg-[length:16px_16px]">
          <img ref={imgRef} src={originalUrl} alt="Original" crossOrigin="anonymous" className="h-56 w-full object-contain" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Resultado</Label>
        <div className={`mt-1 overflow-hidden rounded-md border border-border ${blackBg ? "bg-black" : "bg-[conic-gradient(#e5e5e5_0_25%,#fff_0_50%,#e5e5e5_0_75%,#fff_0)] bg-[length:16px_16px]"}`}>
          {resultUrl ? (
            <img src={resultUrl} alt="Resultado" className="h-56 w-full object-contain" />
          ) : (
            <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">Aguardando...</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultActions({
  resultUrl, resultBlob, onSave, onCopy,
}: {
  resultUrl: string | null; resultBlob: Blob | null; onSave: () => void; onCopy: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button onClick={onSave} disabled={!resultUrl} variant="outline">
        <Download className="h-4 w-4" /> Salvar
      </Button>
      <Button onClick={onCopy} disabled={!resultBlob} variant="outline">
        <Copy className="h-4 w-4" /> Copiar p/ Halftone
      </Button>
    </div>
  );
}
