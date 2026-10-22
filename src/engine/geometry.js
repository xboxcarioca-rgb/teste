/**
 * Geometria dos layouts: transforma "formato alvo + layout + foco" em
 * números concretos (escala, corte, posição). Módulo puro e testável.
 */

const { even, evenDimension, resolveDimensions } = require('../common/formats');
const { clamp } = require('../common/time');

/**
 * Calcula o retângulo de corte para cobrir o alvo ("cover").
 * O ponto de foco (0..1) escolhe qual parte da fonte permanece visível:
 * 0.5 = centro, 0 = borda esquerda/superior, 1 = borda direita/inferior.
 *
 * @param {{width:number,height:number}} source
 * @param {{width:number,height:number}} target
 * @param {{x:number,y:number}} [focus]
 * @returns {{scale:{width:number,height:number},crop:{x:number,y:number,width:number,height:number}}}
 */
function coverRect(source, target, focus = { x: 0.5, y: 0.5 }) {
  const sw = Math.max(1, Number(source.width) || 1);
  const sh = Math.max(1, Number(source.height) || 1);
  const tw = Math.max(2, Number(target.width) || 2);
  const th = Math.max(2, Number(target.height) || 2);

  const factor = Math.max(tw / sw, th / sh);
  const scaledWidth = Math.ceil(sw * factor);
  const scaledHeight = Math.ceil(sh * factor);

  const focusX = clamp(focus?.x ?? 0.5, 0, 1);
  const focusY = clamp(focus?.y ?? 0.5, 0, 1);

  const cropX = Math.round(Math.max(0, scaledWidth - tw) * focusX);
  const cropY = Math.round(Math.max(0, scaledHeight - th) * focusY);

  return {
    scale: { width: scaledWidth, height: scaledHeight },
    crop: {
      x: Math.min(cropX, Math.max(0, scaledWidth - tw)),
      y: Math.min(cropY, Math.max(0, scaledHeight - th)),
      width: tw,
      height: th
    }
  };
}

/**
 * Calcula o tamanho do vídeo quando ele cabe inteiro no alvo ("contain").
 * @param {{width:number,height:number}} source
 * @param {{width:number,height:number}} target
 * @returns {{width:number,height:number,offsetX:number,offsetY:number}}
 */
function containRect(source, target) {
  const sw = Math.max(1, Number(source.width) || 1);
  const sh = Math.max(1, Number(source.height) || 1);
  const tw = Math.max(2, Number(target.width) || 2);
  const th = Math.max(2, Number(target.height) || 2);

  const factor = Math.min(tw / sw, th / sh);
  const width = evenDimension(sw * factor);
  const height = evenDimension(sh * factor);

  return {
    width: Math.min(width, tw),
    height: Math.min(height, th),
    offsetX: even((tw - Math.min(width, tw)) / 2),
    offsetY: even((th - Math.min(height, th)) / 2)
  };
}

/**
 * Geometria de layouts divididos (2 ou 3 painéis).
 * @param {'split-h'|'split-v'|'split-v-triple'} layout
 * @param {{width:number,height:number}} target
 * @param {{gapRatio?:number}} [split]
 * @returns {{direction:'h'|'v',panes:{x:number,y:number,width:number,height:number}[],gap:number}}
 */
function splitGeometry(layout, target, split = {}) {
  const tw = evenDimension(target.width);
  const th = evenDimension(target.height);
  const paneCount = layout === 'split-v-triple' ? 3 : 2;
  const direction = layout === 'split-h' ? 'h' : 'v';
  const gap = even((Number(split.gapRatio) || 0) * (direction === 'v' ? th : tw));

  const panes = [];
  if (direction === 'v') {
    const paneHeight = evenDimension((th - gap * (paneCount - 1)) / paneCount);
    let y = 0;
    for (let i = 0; i < paneCount; i += 1) {
      const height = i === paneCount - 1 ? th - y : paneHeight;
      panes.push({ x: 0, y, width: tw, height: evenDimension(height) });
      y += paneHeight + gap;
    }
  } else {
    const paneWidth = evenDimension((tw - gap * (paneCount - 1)) / paneCount);
    let x = 0;
    for (let i = 0; i < paneCount; i += 1) {
      const width = i === paneCount - 1 ? tw - x : paneWidth;
      panes.push({ x, y: 0, width: evenDimension(width), height: th });
      x += paneWidth + gap;
    }
  }
  return { direction, panes, gap };
}

/**
 * Constrói a descrição geométrica completa de um trabalho de renderização.
 *
 * @param {object} spec
 * @param {{formatId?:string,width?:number,height?:number,layout?:string,focusX?:number,focusY?:number}} spec.output
 * @param {{width?:number,height?:number}[]} spec.sources dimensões reais de cada fonte (via ffprobe)
 * @returns {{
 *   target:{width:number,height:number},
 *   layout:string,
 *   mode:'cover'|'blur-pad'|'solid-pad'|'split',
 *   panes:{sourceIndex:number,x:number,y:number,width:number,height:number,crop:{x:number,y:number}}[],
 *   background:{color:string},
 *   warnings:string[]
 * }}
 */
function computeGeometry(spec) {
  const output = spec.output || {};
  const warnings = [];
  const { width, height } = resolveDimensions(output);
  const target = { width: evenDimension(width), height: evenDimension(height) };
  const layout = String(output.layout || 'fill');
  const focus = { x: clamp(output.focusX ?? 0.5, 0, 1), y: clamp(output.focusY ?? 0.45, 0, 1) };
  const sources = Array.isArray(spec.sources) && spec.sources.length ? spec.sources : [{ width: 1920, height: 1080 }];

  const primary = sources[0] || { width: 1920, height: 1080 };
  const background = { color: output.background?.color || '#0B0B0F' };

  if (layout === 'split-h' || layout === 'split-v' || layout === 'split-v-triple') {
    const geometry = splitGeometry(layout, target, output.split || {});
    const needed = geometry.panes.length;
    const panes = geometry.panes.map((pane, index) => {
      const source = sources[index] || null;
      if (!source) {
        warnings.push(
          `Layout "${layout}" precisa de ${needed} vídeos, mas só há ${sources.length}. O painel ${index + 1} vai repetir o vídeo principal.`
        );
      }
      const src = source || primary;
      const cover = coverRect(src, pane, focus);
      return {
        sourceIndex: source ? index : 0,
        x: pane.x,
        y: pane.y,
        width: pane.width,
        height: pane.height,
        crop: { x: cover.crop.x, y: cover.crop.y },
        coverScale: cover.scale
      };
    });
    return { target, layout, mode: 'split', panes, background, warnings, gap: geometry.gap };
  }

  if (layout === 'fit-blur') {
    const contain = containRect(primary, target);
    return {
      target,
      layout,
      mode: 'blur-pad',
      foreground: contain,
      panes: [{ sourceIndex: 0, x: contain.offsetX, y: contain.offsetY, width: contain.width, height: contain.height }],
      background,
      warnings
    };
  }

  if (layout === 'fit-solid') {
    const contain = containRect(primary, target);
    return {
      target,
      layout,
      mode: 'solid-pad',
      foreground: contain,
      panes: [{ sourceIndex: 0, x: contain.offsetX, y: contain.offsetY, width: contain.width, height: contain.height }],
      background,
      warnings
    };
  }

  // fill (padrão): cobre o quadro inteiro.
  const cover = coverRect(primary, target, focus);
  return {
    target,
    layout: 'fill',
    mode: 'cover',
    foreground: cover,
    panes: [{ sourceIndex: 0, x: 0, y: 0, width: target.width, height: target.height, crop: cover.crop }],
    background,
    warnings
  };
}

/**
 * Converte um ponto de foco (0..1 no vídeo de origem) em coordenadas do alvo.
 * Usado pela UI para mostrar onde o corte vai mirar.
 */
function focusToTargetPixel(focus, geometry) {
  return {
    x: Math.round(clamp(focus?.x ?? 0.5, 0, 1) * geometry.target.width),
    y: Math.round(clamp(focus?.y ?? 0.5, 0, 1) * geometry.target.height)
  };
}

module.exports = { coverRect, containRect, splitGeometry, computeGeometry, focusToTargetPixel };
