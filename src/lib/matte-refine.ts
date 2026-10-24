/**
 * Refinamento de matte (canal alpha) para recortes profissionais.
 * Todas as operações preservam a resolução original e o alpha real (sem
 * preenchimento branco/preto). Em caso de dúvida, o pixel é PRESERVADO.
 */

export type RefineOptions = {
  /** Mantém apenas o(s) objeto(s) principal(is); remove restos do fundo. */
  removeBackgroundObjects: boolean;
  /** Mantém vários objetos independentes (não apenas o maior). */
  detectMultiple: boolean;
  /** Preserva ilhas pequenas dentro do objeto (textos, logos, números). */
  preserveText: boolean;
  /** Contração da máscara em px — mata halos claros/escuros. */
  antiHalo: number;
  /** Suavização de contorno (feather inteligente) em px. */
  feather: number;
  /** Reforça a transição (anti-serrilhado sem borrar). */
  edgeContrast: number;
  /** Remove contaminação de cor do fundo nas bordas translúcidas. */
  decontaminate: boolean;
};

export const REFINE_PRESETS: Record<"rapido" | "profissional" | "ultra", RefineOptions> = {
  rapido: {
    removeBackgroundObjects: true,
    detectMultiple: true,
    preserveText: true,
    antiHalo: 0,
    feather: 0,
    edgeContrast: 1.1,
    decontaminate: false,
  },
  profissional: {
    removeBackgroundObjects: true,
    detectMultiple: true,
    preserveText: true,
    antiHalo: 0.6,
    feather: 1,
    edgeContrast: 1.35,
    decontaminate: true,
  },
  ultra: {
    removeBackgroundObjects: true,
    detectMultiple: true,
    preserveText: true,
    antiHalo: 1,
    feather: 1.6,
    edgeContrast: 1.6,
    decontaminate: true,
  },
};

/** Componentes conectados do alpha, usados para separar objeto de sobras do fundo. */
function keepMainObjects(
  alpha: Float32Array,
  w: number,
  h: number,
  opts: RefineOptions,
) {
  const n = w * h;
  const label = new Int32Array(n).fill(-1);
  const areas: number[] = [];
  const boxes: Array<[number, number, number, number]> = [];
  const stack = new Int32Array(n);
  let current = 0;

  for (let i = 0; i < n; i++) {
    if (alpha[i] <= 12 || label[i] !== -1) continue;
    let sp = 0;
    stack[sp++] = i;
    label[i] = current;
    let area = 0;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (sp > 0) {
      const p = stack[--sp];
      const x = p % w, y = (p / w) | 0;
      area++;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
      if (x > 0 && label[p - 1] === -1 && alpha[p - 1] > 12) { label[p - 1] = current; stack[sp++] = p - 1; }
      if (x < w - 1 && label[p + 1] === -1 && alpha[p + 1] > 12) { label[p + 1] = current; stack[sp++] = p + 1; }
      if (y > 0 && label[p - w] === -1 && alpha[p - w] > 12) { label[p - w] = current; stack[sp++] = p - w; }
      if (y < h - 1 && label[p + w] === -1 && alpha[p + w] > 12) { label[p + w] = current; stack[sp++] = p + w; }
    }
    areas.push(area);
    boxes.push([x0, y0, x1, y1]);
    current++;
  }
  if (current === 0) return;

  let maxArea = 0, maxIdx = 0;
  for (let c = 0; c < current; c++) if (areas[c] > maxArea) { maxArea = areas[c]; maxIdx = c; }

  const keep = new Uint8Array(current);
  keep[maxIdx] = 1;
  if (opts.detectMultiple) {
    for (let c = 0; c < current; c++) if (areas[c] >= maxArea * 0.08) keep[c] = 1;
  }
  if (opts.preserveText) {
    // Ilhas pequenas que caem dentro da caixa de um objeto mantido são texto,
    // logotipo, número ou detalhe da estampa — nunca devem sumir.
    const kept = boxes.filter((_, c) => keep[c] === 1);
    for (let c = 0; c < current; c++) {
      if (keep[c]) continue;
      const [x0, y0, x1, y1] = boxes[c];
      for (const [a0, b0, a1, b1] of kept) {
        if (x0 >= a0 - 2 && x1 <= a1 + 2 && y0 >= b0 - 2 && y1 <= b1 + 2) { keep[c] = 1; break; }
      }
    }
  }
  // Ruído mínimo (poeira) sempre sai.
  for (let c = 0; c < current; c++) if (areas[c] < 6) keep[c] = 0;

  if (!opts.removeBackgroundObjects) return;
  for (let i = 0; i < n; i++) {
    const l = label[i];
    if (l >= 0 && !keep[l]) alpha[i] = 0;
  }
}

function erode(alpha: Float32Array, w: number, h: number, amount: number) {
  if (amount <= 0) return;
  const r = Math.max(1, Math.round(amount));
  const out = new Float32Array(alpha.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 255;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const v = alpha[yy * w + xx];
          if (v < m) m = v;
        }
      }
      out[y * w + x] = alpha[y * w + x] * (1 - amount) + m * amount;
    }
  }
  alpha.set(out);
}

function blur(alpha: Float32Array, w: number, h: number, radius: number) {
  if (radius <= 0) return;
  const r = Math.max(1, Math.round(radius));
  const tmp = new Float32Array(alpha.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        s += alpha[y * w + xx]; c++;
      }
      tmp[y * w + x] = s / c;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let s = 0, c = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        s += tmp[yy * w + x]; c++;
      }
      alpha[y * w + x] = s / c;
    }
  }
}

/** Puxa a cor de um pixel opaco vizinho para bordas translúcidas (anti-fringe). */
function decontaminateColors(data: Uint8ClampedArray, alpha: Float32Array, w: number, h: number) {
  const R = 4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const a = alpha[i];
      if (a <= 4 || a >= 248) continue;
      let br = 0, bg = 0, bb = 0, bw = 0;
      for (let dy = -R; dy <= R; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (alpha[j] < 250) continue;
          const wt = 1 / (1 + dx * dx + dy * dy);
          br += data[j * 4] * wt; bg += data[j * 4 + 1] * wt; bb += data[j * 4 + 2] * wt; bw += wt;
        }
      }
      if (bw === 0) continue;
      const k = 0.85;
      data[i * 4] = data[i * 4] * (1 - k) + (br / bw) * k;
      data[i * 4 + 1] = data[i * 4 + 1] * (1 - k) + (bg / bw) * k;
      data[i * 4 + 2] = data[i * 4 + 2] * (1 - k) + (bb / bw) * k;
    }
  }
}

export function refineMatte(img: ImageData, opts: RefineOptions): ImageData {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) alpha[i] = data[i * 4 + 3];

  keepMainObjects(alpha, w, h, opts);
  if (opts.decontaminate) decontaminateColors(data, alpha, w, h);
  erode(alpha, w, h, opts.antiHalo);
  blur(alpha, w, h, opts.feather);

  const g = opts.edgeContrast;
  for (let i = 0; i < n; i++) {
    let a = alpha[i];
    if (a > 2 && a < 253 && g !== 1) {
      a = 255 / (1 + Math.exp(-((a / 255 - 0.5) * 12 * g)));
    }
    data[i * 4 + 3] = a < 1 ? 0 : a > 254 ? 255 : Math.round(a);
    // Alpha real: pixel invisível não guarda cor de fundo.
    if (data[i * 4 + 3] === 0) { data[i * 4] = 0; data[i * 4 + 1] = 0; data[i * 4 + 2] = 0; }
  }
  return img;
}
