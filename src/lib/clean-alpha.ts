// Limpa o canal alpha de uma ImageData:
// - zera pixels com alpha <= alphaThreshold (poeira translúcida)
// - remove clusters menores que minClusterSize (pixels flutuantes)
// Preserva cores, anti-aliasing e sombras legítimas.
export function cleanAlphaInPlace(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  opts: { alphaThreshold?: number; minClusterSize?: number } = {},
): void {
  const aThr = opts.alphaThreshold ?? 8;
  const minSize = Math.max(1, opts.minClusterSize ?? 12);
  const N = w * h;

  // 1) zera alpha baixíssimo
  for (let i = 0; i < N; i++) {
    if (data[i * 4 + 3] <= aThr) data[i * 4 + 3] = 0;
  }

  // 2) connected components 4-vizinhança
  const visited = new Uint8Array(N);
  const stack = new Int32Array(N);
  const compIdx = new Int32Array(N);
  for (let p = 0; p < N; p++) {
    if (visited[p] || data[p * 4 + 3] === 0) continue;
    let top = 0;
    stack[top++] = p;
    visited[p] = 1;
    let count = 0;
    while (top > 0) {
      const q = stack[--top];
      compIdx[count++] = q;
      const x = q % w, y = (q / w) | 0;
      if (x > 0) { const n = q - 1; if (!visited[n] && data[n * 4 + 3] > 0) { visited[n] = 1; stack[top++] = n; } }
      if (x < w - 1) { const n = q + 1; if (!visited[n] && data[n * 4 + 3] > 0) { visited[n] = 1; stack[top++] = n; } }
      if (y > 0) { const n = q - w; if (!visited[n] && data[n * 4 + 3] > 0) { visited[n] = 1; stack[top++] = n; } }
      if (y < h - 1) { const n = q + w; if (!visited[n] && data[n * 4 + 3] > 0) { visited[n] = 1; stack[top++] = n; } }
    }
    if (count < minSize) {
      for (let k = 0; k < count; k++) data[compIdx[k] * 4 + 3] = 0;
    }
  }
}

export async function cleanAlphaBlob(
  blob: Blob,
  opts?: { alphaThreshold?: number; minClusterSize?: number },
): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  cleanAlphaInPlace(img.data, bmp.width, bmp.height, opts);
  ctx.putImageData(img, 0, 0);
  return await new Promise<Blob>((res) =>
    canvas.toBlob((b) => res(b ?? blob), "image/png"),
  );
}
