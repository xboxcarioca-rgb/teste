import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Upload, Download, Wand2 } from "lucide-react";
import { toast } from "sonner";

type Props = { trigger: React.ReactNode };

// Unsharp mask + upscale via canvas — leve, sem servidor
function enhance(src: HTMLImageElement, scale: number, sharpen: number, saturation: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const W = Math.round(src.naturalWidth * scale);
    const H = Math.round(src.naturalHeight * scale);
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return reject(new Error("canvas"));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // saturation via filter
    ctx.filter = `saturate(${100 + saturation}%)`;
    ctx.drawImage(src, 0, 0, W, H);
    ctx.filter = "none";

    if (sharpen > 0) {
      const img = ctx.getImageData(0, 0, W, H);
      const out = new Uint8ClampedArray(img.data);
      const k = sharpen / 100; // 0..1
      const w = W;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = (y * w + x) * 4;
          for (let ch = 0; ch < 3; ch++) {
            const p = img.data[i + ch];
            const n =
              img.data[i - 4 + ch] + img.data[i + 4 + ch] +
              img.data[i - w * 4 + ch] + img.data[i + w * 4 + ch];
            const avg = n / 4;
            const v = p + (p - avg) * (k * 2);
            out[i + ch] = v < 0 ? 0 : v > 255 ? 255 : v;
          }
        }
      }
      ctx.putImageData(new ImageData(out, W, H), 0, 0);
    }
    c.toBlob((b) => b ? resolve(b) : reject(new Error("blob")), "image/png");
  });
}

export function ImageEnhancerDialog({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [origUrl, setOrigUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [scale, setScale] = useState(2);
  const [sharpen, setSharpen] = useState(35);
  const [saturation, setSaturation] = useState(10);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function load(f: File) {
    if (!f.type.startsWith("image/")) { toast.error("Envie uma imagem"); return; }
    const url = URL.createObjectURL(f);
    setOrigUrl(url); setResultUrl(null); setResultBlob(null);
  }

  async function run() {
    if (!origUrl) return;
    setBusy(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = origUrl;
      await new Promise((r, j) => { img.onload = r; img.onerror = j; });
      const blob = await enhance(img, scale, sharpen, saturation);
      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
      toast.success("Imagem aprimorada!");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao aprimorar");
    } finally { setBusy(false); }
  }

  function download() {
    if (!resultBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(resultBlob);
    a.download = `aprimorada_${Date.now()}.png`;
    a.click();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5" /> Melhoria de Imagem</DialogTitle>
          <DialogDescription>Aumente a resolução, nitidez e cor antes do halftone.</DialogDescription>
        </DialogHeader>

        {!origUrl && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary"
          >
            <Upload className="h-6 w-6" />
            <span>Clique ou arraste uma imagem</span>
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />

        {origUrl && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Original</Label>
              <img src={origUrl} alt="" className="w-full rounded border bg-checker" />
            </div>
            <div>
              <Label className="text-xs">Resultado</Label>
              {resultUrl ? (
                <img src={resultUrl} alt="" className="w-full rounded border" />
              ) : (
                <div className="flex h-40 items-center justify-center rounded border text-xs text-muted-foreground">Aprimore para ver</div>
              )}
            </div>
          </div>
        )}

        {origUrl && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Escala: {scale}x</Label>
              <Slider value={[scale]} min={1} max={4} step={1} onValueChange={([v]) => setScale(v)} />
            </div>
            <div>
              <Label className="text-xs">Nitidez: {sharpen}%</Label>
              <Slider value={[sharpen]} min={0} max={100} step={5} onValueChange={([v]) => setSharpen(v)} />
            </div>
            <div>
              <Label className="text-xs">Saturação: +{saturation}%</Label>
              <Slider value={[saturation]} min={0} max={80} step={5} onValueChange={([v]) => setSaturation(v)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={run} disabled={busy} className="flex-1">
                <Wand2 className="h-4 w-4" /> {busy ? "Aprimorando..." : "Aprimorar"}
              </Button>
              <Button onClick={download} disabled={!resultBlob} variant="secondary">
                <Download className="h-4 w-4" /> Baixar PNG
              </Button>
              <Button variant="ghost" onClick={() => { setOrigUrl(null); setResultUrl(null); setResultBlob(null); }}>Trocar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
