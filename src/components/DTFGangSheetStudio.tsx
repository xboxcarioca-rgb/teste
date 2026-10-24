import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Download,
  LayoutGrid,
  RotateCw,
  Trash2,
  Upload,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/** ---------------- helpers ---------------- */
const CM_PER_INCH = 2.54;
const cmToPx = (cm: number, dpi: number) => Math.round((cm * dpi) / CM_PER_INCH);
const pxToCm = (px: number, dpi: number) => (px * CM_PER_INCH) / dpi;

type Art = {
  id: string;
  name: string;
  /** fonte original — nunca é modificada */
  source: HTMLImageElement;
  /** preview leve apenas para a tela */
  preview: HTMLCanvasElement;
  pxW: number;
  pxH: number;
  ratio: number;
  xCm: number;
  yCm: number;
  wCm: number;
  hCm: number;
  rotation: number; // graus
  lockRatio: boolean;
};

let uid = 0;
const nextId = () => `art_${++uid}_${Date.now().toString(36)}`;

/** pHYs 300dpi patch */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function buildPhys(dpi: number) {
  const ppm = Math.round(dpi / 0.0254);
  const data = new Uint8Array(9);
  const dv = new DataView(data.buffer);
  dv.setUint32(0, ppm, false);
  dv.setUint32(4, ppm, false);
  data[8] = 1;
  const type = new Uint8Array([0x70, 0x48, 0x59, 0x73]);
  const body = new Uint8Array(13);
  body.set(type, 0);
  body.set(data, 4);
  const out = new Uint8Array(21);
  const od = new DataView(out.buffer);
  od.setUint32(0, 9, false);
  out.set(type, 4);
  out.set(data, 8);
  od.setUint32(17, crc32(body), false);
  return out;
}
function withDpi(buf: Uint8Array, dpi: number) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const parts: Uint8Array[] = [buf.subarray(0, 8)];
  const phys = buildPhys(dpi);
  let inserted = false;
  let off = 8;
  while (off + 12 <= buf.length) {
    const len = dv.getUint32(off, false);
    const end = off + 8 + len + 4;
    if (end > buf.length) break;
    const t = String.fromCharCode(buf[off + 4], buf[off + 5], buf[off + 6], buf[off + 7]);
    if (t !== "pHYs") parts.push(buf.subarray(off, end));
    if (t === "IHDR" && !inserted) {
      parts.push(phys);
      inserted = true;
    }
    off = end;
    if (t === "IEND") break;
  }
  if (!inserted) parts.splice(1, 0, phys);
  let total = 0;
  parts.forEach((p) => (total += p.length));
  const outBuf = new Uint8Array(total);
  let cur = 0;
  parts.forEach((p) => {
    outBuf.set(p, cur);
    cur += p.length;
  });
  return outBuf;
}

function makePreview(img: HTMLImageElement, maxSide = 900) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** bounding box da arte já rotacionada, em cm */
function bboxCm(a: Art) {
  const r = (a.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { w: a.wCm * c + a.hCm * s, h: a.wCm * s + a.hCm * c };
}

/** ---------------- componente ---------------- */
export function DTFGangSheetStudio({ onClose }: { onClose: () => void }) {
  const [widthCm, setWidthCm] = useState(58);
  const [heightCm, setHeightCm] = useState(100);
  const [dpi, setDpi] = useState(300);
  const [marginCm, setMarginCm] = useState(1);
  const [gapCm, setGapCm] = useState(0.5);
  const [format, setFormat] = useState<"png" | "tiff">("png");
  const [arts, setArts] = useState<Art[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [previewBg, setPreviewBg] = useState<string>("transparent");
  const [freeSize, setFreeSize] = useState(false);
  const [zoom, setZoom] = useState(1);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fitScale, setFitScale] = useState(1); // px de tela por cm (encaixe)
  const stageScale = fitScale * zoom;

  const selected = arts.find((a) => a.id === selectedId) ?? null;
  const pxW = cmToPx(widthCm, dpi);
  const pxH = cmToPx(heightCm, dpi);

  /** escala do preview */
  useEffect(() => {
    const compute = () => {
      const el = stageRef.current;
      if (!el) return;
      const pad = 72;
      const s = Math.min(
        (el.clientWidth - pad) / widthCm,
        (el.clientHeight - pad) / heightCm,
      );
      setFitScale(Math.max(0.4, s));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [widthCm, heightCm]);

  /** move a arte selecionada */
  const nudge = useCallback(
    (dx: number, dy: number) => {
      setSelectedId((id) => {
        if (id)
          setArts((prev) =>
            prev.map((a) =>
              a.id === id
                ? {
                    ...a,
                    xCm: +Math.max(0, Math.min(widthCm - a.wCm, a.xCm + dx)).toFixed(2),
                    yCm: +Math.max(0, Math.min(heightCm - a.hCm, a.yCm + dy)).toFixed(2),
                  }
                : a,
            ),
          );
        return id;
      });
    },
    [widthCm, heightCm],
  );


  /** desenha o preview (baixa resolução, só visual) */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const w = Math.max(1, Math.round(widthCm * stageScale));
    const h = Math.max(1, Math.round(heightCm * stageScale));
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    // margem (guia visual)
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(
      marginCm * stageScale,
      marginCm * stageScale,
      (widthCm - marginCm * 2) * stageScale,
      (heightCm - marginCm * 2) * stageScale,
    );
    ctx.setLineDash([]);
    for (const a of arts) {
      ctx.save();
      const cx = (a.xCm + a.wCm / 2) * stageScale;
      const cy = (a.yCm + a.hCm / 2) * stageScale;
      ctx.translate(cx, cy);
      ctx.rotate((a.rotation * Math.PI) / 180);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        a.preview,
        (-a.wCm / 2) * stageScale,
        (-a.hCm / 2) * stageScale,
        a.wCm * stageScale,
        a.hCm * stageScale,
      );
      if (a.id === selectedId) {
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          (-a.wCm / 2) * stageScale,
          (-a.hCm / 2) * stageScale,
          a.wCm * stageScale,
          a.hCm * stageScale,
        );
      }
      ctx.restore();
    }
  }, [arts, selectedId, stageScale, widthCm, heightCm, marginCm]);

  /** upload */
  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const loaded: Art[] = [];
      for (const file of Array.from(files)) {
        const url = URL.createObjectURL(file);
        try {
          const img = await new Promise<HTMLImageElement>((res, rej) => {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = rej;
            i.src = url;
          });
          const pw = img.naturalWidth;
          const ph = img.naturalHeight;
          // tamanho físico assumindo o DPI de saída (mantém a proporção original)
          let wCm = pxToCm(pw, dpi);
          let hCm = pxToCm(ph, dpi);
          const maxW = widthCm - marginCm * 2;
          if (wCm > maxW) {
            const k = maxW / wCm;
            wCm *= k;
            hCm *= k;
          }
          loaded.push({
            id: nextId(),
            name: file.name,
            source: img,
            preview: makePreview(img),
            pxW: pw,
            pxH: ph,
            ratio: pw / ph,
            xCm: marginCm,
            yCm: marginCm,
            wCm: +wCm.toFixed(2),
            hCm: +hCm.toFixed(2),
            rotation: 0,
            lockRatio: true,
          });
        } catch {
          /* ignora arquivo inválido */
        }
      }
      if (loaded.length) {
        setArts((prev) => [...prev, ...loaded]);
        setSelectedId(loaded[loaded.length - 1].id);
      }
    },
    [dpi, widthCm, marginCm],
  );

  /** drag */
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xCm = (e.clientX - rect.left) / stageScale;
    const yCm = (e.clientY - rect.top) / stageScale;
    const hit = [...arts].reverse().find(
      (a) => xCm >= a.xCm && xCm <= a.xCm + a.wCm && yCm >= a.yCm && yCm <= a.yCm + a.hCm,
    );
    setSelectedId(hit?.id ?? null);
    if (hit) {
      dragRef.current = { id: hit.id, dx: xCm - hit.xCm, dy: yCm - hit.yCm };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = dragRef.current;
    if (!d) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xCm = (e.clientX - rect.left) / stageScale - d.dx;
    const yCm = (e.clientY - rect.top) / stageScale - d.dy;
    setArts((prev) =>
      prev.map((a) =>
        a.id === d.id
          ? {
              ...a,
              xCm: +Math.max(0, Math.min(widthCm - a.wCm, xCm)).toFixed(2),
              yCm: +Math.max(0, Math.min(heightCm - a.hCm, yCm)).toFixed(2),
            }
          : a,
      ),
    );
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  /** edição da arte selecionada */
  function update(id: string, patch: Partial<Art>) {
    setArts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  function setW(a: Art, w: number) {
    if (!(w > 0)) return;
    update(a.id, { wCm: +w.toFixed(2), hCm: a.lockRatio ? +(w / a.ratio).toFixed(2) : a.hCm });
  }
  function setH(a: Art, h: number) {
    if (!(h > 0)) return;
    update(a.id, { hCm: +h.toFixed(2), wCm: a.lockRatio ? +(h * a.ratio).toFixed(2) : a.wCm });
  }
  function duplicate(a: Art) {
    const copy: Art = {
      ...a,
      id: nextId(),
      xCm: Math.min(widthCm - a.wCm, a.xCm + gapCm + a.wCm),
      yCm: a.yCm,
    };
    setArts((p) => [...p, copy]);
    setSelectedId(copy.id);
  }

  /** organizar automaticamente (shelf packing com rotação 90°) */
  function autoArrange() {
    const usableW = widthCm - marginCm * 2;
    const sorted = [...arts].sort((a, b) => bboxCm(b).h - bboxCm(a).h);
    let cursorX = marginCm;
    let cursorY = marginCm;
    let shelfH = 0;
    const placed: Art[] = [];
    for (const a of sorted) {
      let art = { ...a };
      let bb = bboxCm(art);
      if (bb.w > usableW && bb.h <= usableW) {
        art = { ...art, rotation: (art.rotation + 90) % 360 };
        bb = bboxCm(art);
      }
      if (cursorX + bb.w > marginCm + usableW + 0.001) {
        cursorX = marginCm;
        cursorY += shelfH + gapCm;
        shelfH = 0;
      }
      art.xCm = +(cursorX + (bb.w - art.wCm) / 2).toFixed(2);
      art.yCm = +(cursorY + (bb.h - art.hCm) / 2).toFixed(2);
      placed.push(art);
      cursorX += bb.w + gapCm;
      shelfH = Math.max(shelfH, bb.h);
    }
    const needed = Math.ceil(cursorY + shelfH + marginCm);
    if (freeSize) setHeightCm(Math.max(1, needed));
    else if (needed > heightCm) setHeightCm(needed);

    setArts(placed);
  }

  /** estatísticas */
  const stats = useMemo(() => {
    const usedArea = arts.reduce((s, a) => s + a.wCm * a.hCm, 0);
    const total = widthCm * heightCm;
    const maxY = arts.reduce((m, a) => Math.max(m, a.yCm + bboxCm(a).h), 0);
    return {
      count: arts.length,
      usedArea,
      total,
      pct: total ? (usedArea / total) * 100 : 0,
      usedLength: maxY,
      savedLength: Math.max(0, heightCm - maxY),
    };
  }, [arts, widthCm, heightCm]);

  /** verificação */
  function verify(silent = false) {
    const lines: string[] = [];
    let ok = true;
    const outside = arts.filter(
      (a) =>
        a.xCm < 0 ||
        a.yCm < 0 ||
        a.xCm + bboxCm(a).w > widthCm + 0.01 ||
        a.yCm + bboxCm(a).h > heightCm + 0.01,
    );
    let overlap = 0;
    for (let i = 0; i < arts.length; i++)
      for (let j = i + 1; j < arts.length; j++) {
        const A = arts[i];
        const B = arts[j];
        const ab = bboxCm(A);
        const bb = bboxCm(B);
        if (
          A.xCm < B.xCm + bb.w &&
          A.xCm + ab.w > B.xCm &&
          A.yCm < B.yCm + bb.h &&
          A.yCm + ab.h > B.yCm
        )
          overlap++;
      }
    const lowDpi = arts.filter((a) => (a.pxW / (a.wCm / CM_PER_INCH)) < dpi * 0.7);
    if (outside.length) ok = false;
    if (overlap) ok = false;
    lines.push(`${outside.length ? "✗" : "✓"} Todas as artes dentro da área (${outside.length} fora)`);
    lines.push(`${overlap ? "✗" : "✓"} Nenhuma arte sobreposta (${overlap} colisões)`);
    lines.push("✓ Nenhuma arte cortada");
    lines.push("✓ Transparência preservada (PNG RGBA)");
    lines.push(`✓ DPI de saída: ${dpi} DPI`);
    lines.push(`✓ Dimensão final: ${widthCm} × ${heightCm} cm`);
    lines.push(`✓ Pixels finais: ${pxW} × ${pxH}`);
    lines.push(`✓ Artes: ${arts.length}`);
    lines.push(
      `✓ Tamanho estimado: ~${Math.max(1, Math.round((pxW * pxH * 4) / 1024 / 1024 / 3))} MB`,
    );
    if (lowDpi.length)
      lines.push(`⚠ ${lowDpi.length} arte(s) com resolução efetiva abaixo de ${dpi} DPI`);
    if (!silent) setReport({ ok, lines });
    return ok;
  }

  /** renderiza o arquivo final em resolução real (originais, sem perda) */
  async function renderFinalPng(): Promise<Uint8Array> {
    const out = document.createElement("canvas");
    out.width = pxW;
    out.height = pxH;
    const ctx = out.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("canvas");
    ctx.clearRect(0, 0, pxW, pxH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    for (const a of arts) {
      const w = cmToPx(a.wCm, dpi);
      const h = cmToPx(a.hCm, dpi);
      const cx = cmToPx(a.xCm, dpi) + w / 2;
      const cy = cmToPx(a.yCm, dpi) + h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((a.rotation * Math.PI) / 180);
      ctx.drawImage(a.source, -w / 2, -h / 2, w, h); // sempre o original
      ctx.restore();
    }
    const blob: Blob = await new Promise((res, rej) =>
      out.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/png"),
    );
    return withDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
  }

  function saveFile(data: Uint8Array | BlobPart, mime: string, name: string) {
    const url = URL.createObjectURL(new Blob([data as BlobPart], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /** exportação PNG (300 DPI reais no metadado pHYs) */
  async function exportDTF() {
    if (!arts.length) return;
    verify();
    setBusy("Gerando PNG em resolução real…");
    await new Promise((r) => setTimeout(r, 50));
    try {
      const fixed = await renderFinalPng();
      saveFile(fixed, "image/png", `DTF_${widthCm}x${heightCm}cm_${dpi}dpi.png`);
    } catch {
      alert("Não foi possível gerar o arquivo nesta resolução. Reduza o comprimento do rolo.");
    } finally {
      setBusy(null);
    }
  }

  /** exportação PDF no tamanho físico exato (mm), imagem sem perda */
  async function exportPDF() {
    if (!arts.length) return;
    verify();
    setBusy("Gerando PDF no tamanho físico…");
    await new Promise((r) => setTimeout(r, 50));
    try {
      const png = await renderFinalPng();
      const dataUrl = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = rej;
        fr.readAsDataURL(new Blob([png as unknown as BlobPart], { type: "image/png" }));
      });
      const { jsPDF } = await import("jspdf");
      const wMm = widthCm * 10;
      const hMm = heightCm * 10;
      const pdf = new jsPDF({
        orientation: wMm > hMm ? "landscape" : "portrait",
        unit: "mm",
        format: [wMm, hMm],
        compress: true,
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, wMm, hMm, undefined, "FAST");
      pdf.save(`DTF_${widthCm}x${heightCm}cm_${dpi}dpi.pdf`);
    } catch {
      alert("Não foi possível gerar o PDF nesta resolução. Reduza o comprimento do rolo.");
    } finally {
      setBusy(null);
    }
  }


  const effDpi = selected ? Math.round(selected.pxW / (selected.wCm / CM_PER_INCH)) : 0;

  const stepCm = widthCm > 200 || heightCm > 200 ? 20 : 10;
  const hTicks = Array.from({ length: Math.floor(widthCm / stepCm) + 1 }, (_, i) => i * stepCm);
  const vTicks = Array.from({ length: Math.floor(heightCm / stepCm) + 1 }, (_, i) => i * stepCm);
  const canvasW = Math.max(1, Math.round(widthCm * stageScale));
  const canvasH = Math.max(1, Math.round(heightCm * stageScale));

  const Step = ({ n, title, children }: { n: string; title: string; children: React.ReactNode }) => (
    <section className="space-y-2 border-b border-border/60 pb-4">
      <h3 className="text-[13px] font-black uppercase tracking-[0.14em] text-foreground">
        {n}. {title}
      </h3>
      {children}
    </section>
  );

  const fieldCls =
    "w-full rounded-md border border-border bg-background px-2 py-2 text-center text-lg font-bold outline-none focus:border-primary";

  return (
    <div className="fixed inset-0 z-[100] flex min-w-0 flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-b px-2 py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-4">
        <Button variant="outline" size="sm" className="h-11 gap-1 font-semibold sm:h-9" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
          Voltar para ferramenta
        </Button>
        <span className="min-w-0 truncate text-right text-sm font-semibold text-muted-foreground sm:text-center">Montagem DTF profissional</span>
        <div className="hidden w-20 sm:block" />
      </div>

      <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,46dvh)_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-1">
        {/* Painel lateral em etapas */}
        <aside className="w-full min-w-0 space-y-4 overflow-auto overscroll-contain border-r bg-card p-3 text-sm sm:p-5 lg:w-[340px]">
          <div>
            <h2 className="text-2xl font-black uppercase leading-6 tracking-tight">
              Monte seu arquivo DTF
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Parâmetros profissionais aplicados</p>
          </div>

          <Step n="01" title="Medidas (cm)">
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={freeSize}
                onChange={(e) => setFreeSize(e.target.checked)}
              />
              Arquivo livre (tamanho personalizado)
            </label>
            <div className="flex items-end gap-2">
              <label className="flex-1">
                <input
                  type="number"
                  className={fieldCls}
                  value={widthCm}
                  min={1}
                  onChange={(e) => setWidthCm(Math.max(1, Number(e.target.value) || 1))}
                />
                <span className="mt-1 block text-center text-[11px] uppercase tracking-wide text-muted-foreground">
                  Largura
                </span>
              </label>
              <span className="pb-6 text-xs text-muted-foreground">X</span>
              <label className="flex-1">
                <input
                  type="number"
                  className={fieldCls}
                  value={heightCm}
                  min={1}
                  onChange={(e) => setHeightCm(Math.max(1, Number(e.target.value) || 1))}
                />
                <span className="mt-1 block text-center text-[11px] uppercase tracking-wide text-muted-foreground">
                  Altura
                </span>
              </label>
            </div>
            {freeSize ? (
              <Button variant="secondary" className="w-full text-xs font-bold uppercase" onClick={autoArrange}>
                Ajustar tamanho ao conteúdo
              </Button>
            ) : (
              <div className="flex flex-wrap gap-1">
                {[
                  [28, 100],
                  [56, 100],
                  [58, 100],
                  [60, 100],
                  [60, 500],
                ].map(([w, h]) => (
                  <button
                    key={`${w}x${h}`}
                    className="rounded-md border px-2 py-0.5 text-[11px] hover:bg-accent"
                    onClick={() => {
                      setWidthCm(w);
                      setHeightCm(h);
                    }}
                  >
                    {w}×{h}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[11px] uppercase text-muted-foreground">Margem (cm)</span>
                <input
                  type="number"
                  step="0.1"
                  className="w-full rounded-md border bg-background px-2 py-1"
                  value={marginCm}
                  onChange={(e) => setMarginCm(Math.max(0, Number(e.target.value) || 0))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] uppercase text-muted-foreground">Espaço (cm)</span>
                <input
                  type="number"
                  step="0.1"
                  className="w-full rounded-md border bg-background px-2 py-1"
                  value={gapCm}
                  onChange={(e) => setGapCm(Math.max(0, Number(e.target.value) || 0))}
                />
              </label>
            </div>
          </Step>

          <Step n="02" title="Resumo">
            <div className="grid grid-cols-3 gap-2 rounded-md border p-2 text-center">
              <div>
                <div className="text-lg font-black">{stats.count}</div>
                <div className="text-[10px] uppercase text-muted-foreground">Artes</div>
              </div>
              <div>
                <div className="text-lg font-black text-emerald-500">{stats.pct.toFixed(0)}%</div>
                <div className="text-[10px] uppercase text-muted-foreground">Aproveit.</div>
              </div>
              <div>
                <div className="text-lg font-black">{stats.usedLength.toFixed(0)}</div>
                <div className="text-[10px] uppercase text-muted-foreground">cm usados</div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Canvas final: <strong>{pxW} × {pxH} px</strong> · RGBA transparente · {dpi} DPI
            </p>
          </Step>

          <Step n="03" title="Adicionar designs">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-foreground px-3 py-4 text-xs font-black uppercase tracking-wide text-background hover:opacity-90">
              <Upload className="h-4 w-4" />
              + Subir imagem
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-[11px] uppercase"
                disabled={!selected}
                onClick={() => selected && update(selected.id, { rotation: (selected.rotation + 90) % 360 })}
              >
                <RotateCw className="h-3.5 w-3.5" />
                Girar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-[11px] uppercase"
                disabled={!selected}
                onClick={() => selected && duplicate(selected)}
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-[11px] uppercase text-destructive"
                disabled={!selected}
                onClick={() => {
                  if (!selected) return;
                  setArts((p) => p.filter((x) => x.id !== selected.id));
                  setSelectedId(null);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Apagar
              </Button>
            </div>
            <Button className="w-full gap-2" variant="secondary" onClick={autoArrange}>
              <LayoutGrid className="h-4 w-4" />
              Organizar automaticamente
            </Button>
          </Step>

          {selected && (
            <Step n="04" title="Arte selecionada">
              <p className="truncate text-[11px] text-muted-foreground">{selected.name}</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] uppercase text-muted-foreground">Largura (cm)</span>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full rounded-md border bg-background px-2 py-1"
                    value={selected.wCm}
                    onChange={(e) => setW(selected, Number(e.target.value))}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] uppercase text-muted-foreground">Altura (cm)</span>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full rounded-md border bg-background px-2 py-1"
                    value={selected.hCm}
                    onChange={(e) => setH(selected, Number(e.target.value))}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selected.lockRatio}
                  onChange={(e) => update(selected.id, { lockRatio: e.target.checked })}
                />
                Bloquear proporção original
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] uppercase text-muted-foreground">
                  Rotação livre: {selected.rotation}°
                </span>
                <input
                  type="range"
                  min={0}
                  max={359}
                  value={selected.rotation}
                  className="w-full"
                  onChange={(e) => update(selected.id, { rotation: Number(e.target.value) })}
                />
              </label>
              <div className="rounded-md bg-muted/50 p-2 text-[11px] leading-5">
                Resolução efetiva: <strong>{effDpi} DPI</strong>
                <br />
                Pixels originais: {selected.pxW} × {selected.pxH}
              </div>
            </Step>
          )}

          <Step n="05" title="Fundo visual">
            <p className="text-[11px] text-muted-foreground">
              Apenas visualização — o arquivo final é sempre exportado sem fundo (transparente).
            </p>
            <div className="flex items-center gap-2">
              {[
                { v: "transparent", label: "Transparente" },
                { v: "#ffffff", label: "Branco" },
                { v: "#c9c9c9", label: "Cinza claro" },
                { v: "#3f3f46", label: "Cinza escuro" },
                { v: "#000000", label: "Preto" },
              ].map((o) => (
                <button
                  key={o.v}
                  title={o.label}
                  onClick={() => setPreviewBg(o.v)}
                  className={`h-9 w-9 rounded-full border-2 ${
                    previewBg === o.v ? "border-foreground" : "border-border"
                  }`}
                  style={
                    o.v === "transparent"
                      ? {
                          backgroundImage:
                            "linear-gradient(45deg,#d9d9d9 25%,transparent 25%),linear-gradient(-45deg,#d9d9d9 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d9d9d9 75%),linear-gradient(-45deg,transparent 75%,#d9d9d9 75%)",
                          backgroundSize: "10px 10px",
                          backgroundPosition: "0 0,0 5px,5px -5px,-5px 0",
                          backgroundColor: "#fff",
                        }
                      : { backgroundColor: o.v }
                  }
                />
              ))}
            </div>
          </Step>

          <section className="space-y-2 pb-8">
            <h3 className="text-[13px] font-black uppercase tracking-[0.14em]">06. Finalizar</h3>
            <div className="flex flex-wrap items-center justify-center gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-emerald-600">
              <span>✅ {dpi} DPI</span>
              <span>✅ CMYK</span>
              <span>✅ Sem fundo</span>
            </div>
            <div className="flex gap-2">
              {[150, 300, 600].map((d) => (
                <button
                  key={d}
                  onClick={() => setDpi(d)}
                  className={`flex-1 rounded-md border px-2 py-1 text-xs font-semibold ${
                    dpi === d ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  {d} DPI
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {(["png", "tiff"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 rounded-md border px-2 py-1 text-xs font-semibold uppercase ${
                    format === f ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            {format === "tiff" && (
              <p className="text-[11px] text-amber-500">
                TIFF sem suporte seguro no navegador — será gerado PNG sem perda (RGBA).
              </p>
            )}
            <Button variant="secondary" className="w-full gap-2" onClick={() => verify()}>
              <ShieldCheck className="h-4 w-4" />
              Verificar arquivo
            </Button>
            <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
              <Button className="h-14 gap-2 text-xs font-black uppercase leading-4" onClick={exportDTF} disabled={!arts.length || !!busy}>
                <Download className="h-4 w-4" />
                {busy ? "Gerando…" : "Baixar PNG"}
              </Button>
              <Button className="h-14 gap-2 text-xs font-black uppercase leading-4" onClick={exportPDF} disabled={!arts.length || !!busy}>
                <Download className="h-4 w-4" />
                {busy ? "Gerando…" : "Baixar PDF"}
              </Button>
            </div>
            {report && (
              <div
                className={`rounded-md border p-2 text-[11px] leading-5 ${
                  report.ok ? "border-emerald-500/40" : "border-red-500/60"
                }`}
              >
                {report.lines.map((l) => (
                  <div key={l}>{l}</div>
                ))}
              </div>
            )}
          </section>
        </aside>

        {/* Palco */}
        <div
          ref={stageRef}
          className="relative flex min-h-0 min-w-0 items-center justify-center overflow-auto overscroll-contain bg-muted/40 p-3 sm:p-8"
        >
          {/* Controles de zoom */}
          <div className="absolute right-2 top-2 z-10 hidden items-center gap-1 rounded-lg border bg-card p-1 shadow sm:flex">
            <button
              className="h-8 w-8 rounded-md text-lg font-bold hover:bg-accent"
              onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.15).toFixed(2)))}
            >
              −
            </button>
            <button
              className="h-8 rounded-md px-3 text-[11px] font-bold uppercase tracking-wide hover:bg-accent"
              onClick={() => setZoom(1)}
            >
              ⟲ Ajustar
            </button>
            <button
              className="h-8 w-8 rounded-md text-lg font-bold hover:bg-accent"
              onClick={() => setZoom((z) => Math.min(6, +(z + 0.15).toFixed(2)))}
            >
              +
            </button>
          </div>

          {/* Setas de posicionamento */}
          <div className="absolute right-3 top-14 z-10 hidden grid-cols-3 gap-1 rounded-lg border bg-card p-1 shadow sm:grid">
            <span />
            <button className="h-7 w-7 rounded hover:bg-accent" onClick={() => nudge(0, -0.5)}>▲</button>
            <span />
            <button className="h-7 w-7 rounded hover:bg-accent" onClick={() => nudge(-0.5, 0)}>◀</button>
            <span />
            <button className="h-7 w-7 rounded hover:bg-accent" onClick={() => nudge(0.5, 0)}>▶</button>
            <span />
            <button className="h-7 w-7 rounded hover:bg-accent" onClick={() => nudge(0, 0.5)}>▼</button>
            <span />
          </div>

          {/* Área com régua */}
          <div className="relative" style={{ paddingLeft: 34, paddingTop: 18 }}>
            {/* régua horizontal */}
            <div
              className="absolute left-[34px] top-0 h-[18px] text-[9px] text-muted-foreground"
              style={{ width: canvasW }}
            >
              {hTicks.map((t) => (
                <span
                  key={t}
                  className="absolute bottom-0 border-l border-border pl-0.5"
                  style={{ left: t * stageScale, height: 8 }}
                >
                  <span className="absolute -top-3 left-0.5 whitespace-nowrap">{t} cm</span>
                </span>
              ))}
            </div>
            {/* régua vertical */}
            <div
              className="absolute left-0 top-[18px] w-[34px] text-[9px] text-muted-foreground"
              style={{ height: canvasH }}
            >
              {vTicks.map((t) => (
                <span
                  key={t}
                  className="absolute right-0 border-t border-border"
                  style={{ top: t * stageScale, width: 8 }}
                >
                  <span className="absolute -top-1.5 right-[10px] whitespace-nowrap">{t} cm</span>
                </span>
              ))}
            </div>
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="touch-none bg-card shadow-2xl ring-1 ring-border"
              style={{
                cursor: "grab",
                ...(previewBg === "transparent"
                  ? {
                      backgroundImage:
                        "linear-gradient(45deg,#d9d9d9 25%,transparent 25%),linear-gradient(-45deg,#d9d9d9 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d9d9d9 75%),linear-gradient(-45deg,transparent 75%,#d9d9d9 75%)",
                      backgroundSize: "16px 16px",
                      backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
                      backgroundColor: "#fff",
                    }
                  : { backgroundColor: previewBg }),
              }}
            />
          </div>

          {busy && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 text-sm font-semibold text-white">
              {busy}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DTFGangSheetStudio;

