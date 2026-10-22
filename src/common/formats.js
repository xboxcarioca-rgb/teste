/**
 * Formatos de saída e layouts de enquadramento.
 *
 * Este módulo é "puro" (sem dependência de Electron/Node) para poder ser
 * reaproveitado pelo processo de renderização, pelo renderer e pelos testes.
 */

/** @typedef {{id:string,label:string,width:number,height:number,ratio:string,platforms:string[],minBitrateKbps:number,maxBitrateKbps:number}} Format */

/**
 * Modelos de corte (proporções) suportados.
 * @type {Format[]}
 */
const FORMATS = [
  {
    id: 'vertical',
    label: 'Vertical 9:16',
    width: 1080,
    height: 1920,
    ratio: '9:16',
    platforms: ['Reels', 'TikTok', 'Shorts', 'Kwai'],
    minBitrateKbps: 8000,
    maxBitrateKbps: 16000
  },
  {
    id: 'square',
    label: 'Quadrado 1:1',
    width: 1080,
    height: 1080,
    ratio: '1:1',
    platforms: ['Feed Instagram', 'Feed Facebook', 'LinkedIn'],
    minBitrateKbps: 6000,
    maxBitrateKbps: 12000
  },
  {
    id: 'portrait',
    label: 'Retrato 4:5',
    width: 1080,
    height: 1350,
    ratio: '4:5',
    platforms: ['Feed Instagram (ocupa mais tela)'],
    minBitrateKbps: 7000,
    maxBitrateKbps: 14000
  },
  {
    id: 'horizontal',
    label: 'Horizontal 16:9',
    width: 1920,
    height: 1080,
    ratio: '16:9',
    platforms: ['YouTube', 'X/Twitter', 'Site'],
    minBitrateKbps: 8000,
    maxBitrateKbps: 16000
  },
  {
    id: 'cinema',
    label: 'Cinema 2.35:1',
    width: 1920,
    height: 816,
    ratio: '2.35:1',
    platforms: ['Teaser cinematográfico'],
    minBitrateKbps: 8000,
    maxBitrateKbps: 18000
  },
  {
    id: 'custom',
    label: 'Personalizado',
    width: 1080,
    height: 1920,
    ratio: 'custom',
    platforms: ['Definido por você'],
    minBitrateKbps: 4000,
    maxBitrateKbps: 24000
  }
];

/** @typedef {{id:string,label:string,description:string,needsSecondSource:boolean}} Layout */

/**
 * Modelos de enquadramento dentro do formato escolhido.
 * @type {Layout[]}
 */
const LAYOUTS = [
  {
    id: 'fill',
    label: 'Preencher quadro',
    description: 'Amplia e corta as bordas até cobrir o formato inteiro (sem tarjas).',
    needsSecondSource: false
  },
  {
    id: 'fit-blur',
    label: 'Metade + fundo desfocado',
    description: 'O vídeo aparece inteiro no centro e o restante do quadro é preenchido com ele mesmo desfocado. Estilo podcast/clip.',
    needsSecondSource: false
  },
  {
    id: 'fit-solid',
    label: 'Barras coloridas',
    description: 'Vídeo inteiro no centro com barras de cor sólida (ou gradiente) nas laterais.',
    needsSecondSource: false
  },
  {
    id: 'split-h',
    label: 'Tela dividida — lado a lado',
    description: 'Dois vídeos lado a lado. Ideal para 16:9 (reação/dueto).',
    needsSecondSource: true
  },
  {
    id: 'split-v',
    label: 'Tela dividida — empilhado',
    description: 'Dois vídeos empilhados (um em cima do outro). Ideal para 9:16 e 1:1.',
    needsSecondSource: true
  },
  {
    id: 'split-v-triple',
    label: 'Triplo — 3 faixas',
    description: 'Três vídeos empilhados, estilo gameplay + facecam + chat.',
    needsSecondSource: true
  }
];

/** Formatos mais usados para cada layout dividido. */
const SPLIT_RECOMMENDED_FORMATS = {
  'split-h': ['horizontal', 'square'],
  'split-v': ['vertical', 'square', 'portrait'],
  'split-v-triple': ['vertical', 'portrait']
};

/** @param {string} id @returns {Format} */
function getFormat(id) {
  const found = FORMATS.find((f) => f.id === id);
  return found || FORMATS[0];
}

/** @param {string} id @returns {Layout} */
function getLayout(id) {
  const found = LAYOUTS.find((l) => l.id === id);
  return found || LAYOUTS[0];
}

/**
 * Arredonda para o inteiro par mais próximo (o H.264/H.265 em yuv420p exige
 * dimensões pares). Zero é preservado — quem precisa de mínimo usa
 * `evenDimension`, que também cobre offsets/gaps que podem ser 0.
 * @param {number} value
 * @returns {number}
 */
function even(value) {
  const rounded = Math.round(Number(value) || 0);
  if (rounded === 0) return 0;
  return rounded % 2 === 0 ? rounded : rounded + Math.sign(rounded);
}

/**
 * Dimensão par com mínimo garantido (larguras/alturas nunca podem ser 0).
 * @param {number} value
 * @param {number} [min=2]
 * @returns {number}
 */
function evenDimension(value, min = 2) {
  return Math.max(min, even(value));
}

/**
 * Resolve dimensões finais aplicando overrides de tamanho personalizado.
 * @param {{formatId?:string,width?:number,height?:number}} output
 * @returns {{width:number,height:number,ratio:string,label:string}}
 */
function resolveDimensions(output = {}) {
  const base = getFormat(output.formatId || 'vertical');
  if (base.id === 'custom') {
    return {
      width: evenDimension(output.width || base.width),
      height: evenDimension(output.height || base.height),
      ratio: 'custom',
      label: base.label
    };
  }
  return { width: evenDimension(base.width), height: evenDimension(base.height), ratio: base.ratio, label: base.label };
}

/**
 * Reduz a proporção (ex.: 1080x1920 -> "9:16").
 * @param {number} width
 * @param {number} height
 * @returns {string}
 */
function aspectRatioLabel(width, height) {
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(Math.round(width), Math.round(height)) || 1;
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

module.exports = {
  FORMATS,
  LAYOUTS,
  SPLIT_RECOMMENDED_FORMATS,
  getFormat,
  getLayout,
  even,
  evenDimension,
  resolveDimensions,
  aspectRatioLabel
};
