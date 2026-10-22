#!/usr/bin/env node
/**
 * Gera os ícones do app sem nenhuma dependência externa.
 *
 * Saídas:
 *   assets/icon.png  1024x1024 (fonte, usada pelo electron-builder em linux/mac)
 *   build/icon.png    512x512
 *   build/icon.ico    multi-tamanho (256,128,64,48,32,24,16) — necessário no Windows
 *
 * O desenho é rasterizado analiticamente com campos de distância assinados (SDF),
 * o que dá bordas perfeitamente suavizadas em qualquer tamanho — importante
 * porque o mesmo arquivo vira desde o ícone da barra de tarefas (16px) até o do
 * instalador (256px).
 *
 * Arte: quadrado arredondado com o gradiente da marca (#FF2D55 -> #7B5CFF, 135°)
 * e um triângulo de "play" branco com cantos arredondados, centralizado opticamente.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { encodePng } = require('../src/engine/png');

const ROOT = path.resolve(__dirname, '..');
const MASTER = 1024;
const ICO_SIZES = [256, 128, 64, 48, 32, 24, 16];

/** Cor inicial do gradiente (--accent). */
const FROM = [0xff, 0x2d, 0x55];
/** Cor final do gradiente (--accent-2). */
const TO = [0x7b, 0x5c, 0xff];

// ------------------------------------------------------------------ SDF utils

/** Distância assinada a um segmento de reta. */
function sdSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy || 1;
  let t = (wx * vx + wy * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (ax + vx * t);
  const dy = py - (ay + vy * t);
  return Math.hypot(dx, dy);
}

/** Sinal usado pelo SDF de triângulo (de qual lado da aresta o ponto está). */
function edgeSign(px, py, ax, ay, bx, by) {
  return (px - bx) * (ay - by) - (ax - bx) * (py - by);
}

/** SDF de triângulo: negativo dentro, positivo fora. */
function sdTriangle(px, py, a, b, c) {
  const d1 = edgeSign(px, py, a[0], a[1], b[0], b[1]);
  const d2 = edgeSign(px, py, b[0], b[1], c[0], c[1]);
  const d3 = edgeSign(px, py, c[0], c[1], a[0], a[1]);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  const inside = !(hasNeg && hasPos);
  const d = Math.min(
    sdSegment(px, py, a[0], a[1], b[0], b[1]),
    sdSegment(px, py, b[0], b[1], c[0], c[1]),
    sdSegment(px, py, c[0], c[1], a[0], a[1])
  );
  return inside ? -d : d;
}

/** SDF de retângulo arredondado centrado na origem. */
function sdRoundBox(px, py, halfX, halfY, radius) {
  const qx = Math.abs(px) - halfX + radius;
  const qy = Math.abs(py) - halfY + radius;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return Math.min(Math.max(qx, qy), 0) + outside - radius;
}

/** Converte distância em cobertura de pixel (faixa de 1px de antialiasing). */
function coverage(sdf) {
  return Math.max(0, Math.min(1, 0.5 - sdf));
}

function mixChannel(a, b, t) {
  return Math.round(a + (b - a) * t);
}

// ------------------------------------------------------------------- desenho

/**
 * Renderiza o ícone em `size` x `size`.
 * @param {number} size
 * @returns {Uint8Array} RGBA
 */
function renderIcon(size) {
  const rgba = new Uint8Array(size * size * 4);

  // Geometria em coordenadas normalizadas (0..1), convertidas para o SDF em
  // unidades de pixel para que a faixa de antialiasing seja sempre de 1px.
  const cornerRadius = 0.22 * size;
  const half = size / 2;

  // Triângulo de play, deslocado um pouco à direita (centro óptico).
  const cx = 0.535 * size;
  const cy = 0.5 * size;
  const triHalfHeight = 0.235 * size;
  const triWidth = 0.4 * size;
  const a = [cx - triWidth / 2, cy - triHalfHeight];
  const b = [cx - triWidth / 2, cy + triHalfHeight];
  const c = [cx + triWidth / 2, cy];
  const triRadius = 0.05 * size;

  for (let y = 0; y < size; y += 1) {
    // Centro do pixel.
    const py = y + 0.5;
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;

      const bg = coverage(sdRoundBox(px - half, py - half, half, half, cornerRadius));
      if (bg <= 0) {
        // Totalmente transparente: não precisa calcular o resto.
        const i = (y * size + x) * 4;
        rgba[i + 3] = 0;
        continue;
      }

      // Gradiente 135° (eixo canto superior esquerdo -> inferior direito).
      const u = px / size;
      const v = py / size;
      const t = Math.max(0, Math.min(1, (u + v) / 2));

      // Vinheta suave: escurece levemente as bordas para dar volume.
      const dxn = (px - half) / half;
      const dyn = (py - half) / half;
      const vignette = 1 - 0.14 * Math.min(1, Math.hypot(dxn, dyn));

      let r = mixChannel(FROM[0], TO[0], t) * vignette;
      let g = mixChannel(FROM[1], TO[1], t) * vignette;
      let bl = mixChannel(FROM[2], TO[2], t) * vignette;

      // Realce diagonal no canto superior esquerdo.
      const gloss = Math.max(0, 0.16 * (1 - Math.hypot(dxn + 0.45, dyn + 0.45)));
      r += (255 - r) * gloss;
      g += (255 - g) * gloss;
      bl += (255 - bl) * gloss;

      // Triângulo branco com cantos arredondados (SDF inflado pelo raio).
      const tri = coverage(sdTriangle(px, py, a, b, c) - triRadius);
      if (tri > 0) {
        r += (255 - r) * tri;
        g += (255 - g) * tri;
        bl += (255 - bl) * tri;
      }

      const i = (y * size + x) * 4;
      rgba[i] = Math.max(0, Math.min(255, Math.round(r)));
      rgba[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
      rgba[i + 2] = Math.max(0, Math.min(255, Math.round(bl)));
      rgba[i + 3] = Math.round(bg * 255);
    }
  }

  return rgba;
}

/**
 * Reduz por média de área (box filter) — preserva a suavização nos tamanhos
 * pequenos muito melhor do que amostrar pontos isolados.
 * @param {Uint8Array} src RGBA do mestre
 * @param {number} srcSize
 * @param {number} dstSize
 * @returns {Uint8Array}
 */
function downscale(src, srcSize, dstSize) {
  if (dstSize === srcSize) return Uint8Array.from(src);
  const out = new Uint8Array(dstSize * dstSize * 4);
  const scale = srcSize / dstSize;

  for (let y = 0; y < dstSize; y += 1) {
    const y0 = Math.floor(y * scale);
    const y1 = Math.max(y0 + 1, Math.min(srcSize, Math.ceil((y + 1) * scale)));
    for (let x = 0; x < dstSize; x += 1) {
      const x0 = Math.floor(x * scale);
      const x1 = Math.max(x0 + 1, Math.min(srcSize, Math.ceil((x + 1) * scale)));

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const i = (sy * srcSize + sx) * 4;
          r += src[i];
          g += src[i + 1];
          b += src[i + 2];
          a += src[i + 3];
          count += 1;
        }
      }
      const o = (y * dstSize + x) * 4;
      out[o] = Math.round(r / count);
      out[o + 1] = Math.round(g / count);
      out[o + 2] = Math.round(b / count);
      out[o + 3] = Math.round(a / count);
    }
  }
  return out;
}

// ------------------------------------------------------------------- ICO/DIB

/**
 * Codifica uma imagem como DIB de 32bpp (BITMAPINFOHEADER + BGRA + máscara AND).
 *
 * É o formato clássico de entrada de .ico e o mais compatível com o tooling do
 * Windows (explorer, assinador de código, resource hackers).
 * @param {Uint8Array} rgba
 * @param {number} size
 * @returns {Buffer}
 */
function encodeDib(rgba, size) {
  const headerSize = 40;
  const xorSize = size * size * 4;
  // Máscara AND de 1 bit por pixel, com cada linha alinhada em 4 bytes.
  const andRowBytes = Math.ceil(size / 32) * 4;
  const andSize = andRowBytes * size;
  const buf = Buffer.alloc(headerSize + xorSize + andSize);

  buf.writeUInt32LE(headerSize, 0);
  buf.writeInt32LE(size, 4);
  // Altura em dobro: metade para o XOR (pixels) e metade para a máscara AND.
  buf.writeInt32LE(size * 2, 8);
  buf.writeUInt16LE(1, 12); // planes
  buf.writeUInt16LE(32, 14); // bpp
  buf.writeUInt32LE(0, 16); // BI_RGB
  buf.writeUInt32LE(xorSize + andSize, 20);

  let offset = headerSize;
  // Pixels de baixo para cima (convenção BMP), na ordem BGRA.
  for (let y = size - 1; y >= 0; y -= 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      buf[offset++] = rgba[i + 2]; // B
      buf[offset++] = rgba[i + 1]; // G
      buf[offset++] = rgba[i]; // R
      buf[offset++] = rgba[i + 3]; // A
    }
  }
  // A máscara AND fica zerada: quem manda é o canal alpha.
  return buf;
}

/**
 * Monta um .ico com várias resoluções.
 * @param {{size:number,rgba:Uint8Array}[]} images
 * @returns {Buffer}
 */
function encodeIco(images) {
  const entries = images.map((image) => ({ size: image.size, data: encodeDib(image.rgba, image.size) }));
  const directorySize = 6 + entries.length * 16;

  const header = Buffer.alloc(directorySize);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: ícone
  header.writeUInt16LE(entries.length, 4);

  let offset = directorySize;
  entries.forEach((entry, index) => {
    const at = 6 + index * 16;
    // 0 significa 256 px (limite da representação em 1 byte).
    header[at] = entry.size >= 256 ? 0 : entry.size;
    header[at + 1] = entry.size >= 256 ? 0 : entry.size;
    header[at + 2] = 0; // cores na paleta
    header[at + 3] = 0; // reservado
    header.writeUInt16LE(1, at + 4); // planes
    header.writeUInt16LE(32, at + 6); // bpp
    header.writeUInt32LE(entry.data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += entry.data.length;
  });

  return Buffer.concat([header, ...entries.map((entry) => entry.data)]);
}

// ---------------------------------------------------------------------- main

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  console.log(`Renderizando ícone em ${MASTER}x${MASTER}...`);
  const master = renderIcon(MASTER);

  const assetsDir = path.join(ROOT, 'assets');
  const buildDir = path.join(ROOT, 'build');
  ensureDir(assetsDir);
  ensureDir(buildDir);

  const iconPng = path.join(assetsDir, 'icon.png');
  fs.writeFileSync(iconPng, encodePng(MASTER, MASTER, Buffer.from(master.buffer, master.byteOffset, master.length)));
  console.log(`  ✓ ${path.relative(ROOT, iconPng)} (${(fs.statSync(iconPng).size / 1024).toFixed(1)} KB)`);

  const buildPng = path.join(buildDir, 'icon.png');
  const png512 = downscale(master, MASTER, 512);
  fs.writeFileSync(buildPng, encodePng(512, 512, Buffer.from(png512.buffer, png512.byteOffset, png512.length)));
  console.log(`  ✓ ${path.relative(ROOT, buildPng)} (${(fs.statSync(buildPng).size / 1024).toFixed(1)} KB)`);

  const images = ICO_SIZES.map((size) => ({ size, rgba: downscale(master, MASTER, size) }));
  const icoPath = path.join(buildDir, 'icon.ico');
  fs.writeFileSync(icoPath, encodeIco(images));
  console.log(`  ✓ ${path.relative(ROOT, icoPath)} (${(fs.statSync(icoPath).size / 1024).toFixed(1)} KB) — ${ICO_SIZES.join(', ')} px`);

  // Sanity check: o ICO precisa ter o diretório correto para o Windows aceitar.
  const ico = fs.readFileSync(icoPath);
  if (ico.readUInt16LE(2) !== 1) throw new Error('ICO gerado com tipo inválido');
  if (ico.readUInt16LE(4) !== ICO_SIZES.length) throw new Error('ICO gerado com número de imagens inválido');

  console.log('Ícones gerados com sucesso.');
}

main();
