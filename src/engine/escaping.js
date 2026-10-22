/**
 * Escapamento de argumentos para o FFmpeg.
 *
 * Existem DOIS níveis de interpretação:
 *  1. O parser do filtergraph (`-filter_complex`), onde `:` separa opções,
 *     `,` separa filtros e `'`/`\` fazem quoting.
 *  2. O parser interno de cada filtro (ex.: drawtext expande `%{...}`).
 *
 * Como invocamos o ffmpeg com `spawn` (sem shell), não há escaping de shell.
 */

/**
 * Escapa um valor genérico dentro de uma opção de filtro.
 * @param {string|number} value
 * @returns {string}
 */
function escapeFilterValue(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\u2019".repeat(0) + "\\'")
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

/**
 * Escapa um caminho de arquivo para uso dentro de um filtergraph.
 * Converte barras invertidas (Windows) em barras normais e protege `:` e `'`.
 * `C:\Users\João\a.ass` -> `C\:/Users/João/a.ass`
 * @param {string} filePath
 * @returns {string}
 */
function escapeFilterPath(filePath) {
  const normalized = String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:');
  return normalized;
}

/**
 * Escapa texto livre para o filtro `drawtext`.
 * Protege `\`, `'`, `:`, `%` e `,` — os caracteres que o drawtext interpreta.
 * @param {string} text
 * @returns {string}
 */
function escapeDrawtext(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

/**
 * Escapa um caminho para a opção `fontfile`/`filename` do drawtext.
 * @param {string} filePath
 */
function escapeDrawtextPath(filePath) {
  return escapeFilterPath(filePath);
}

/**
 * Converte `#RRGGBB` / `#RRGGBBAA` em `0xRRGGBB[@alpha]`, formato aceito pelo FFmpeg.
 * @param {string} hex
 * @param {number} [opacity=1]
 * @returns {string}
 */
function toFfmpegColor(hex, opacity = 1) {
  const raw = String(hex || '#000000').trim().replace(/^#/, '');
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 255;

  if (raw.length === 3 || raw.length === 4) {
    r = parseInt(raw[0] + raw[0], 16);
    g = parseInt(raw[1] + raw[1], 16);
    b = parseInt(raw[2] + raw[2], 16);
    if (raw.length === 4) a = parseInt(raw[3] + raw[3], 16);
  } else {
    r = parseInt(raw.slice(0, 2), 16) || 0;
    g = parseInt(raw.slice(2, 4), 16) || 0;
    b = parseInt(raw.slice(4, 6), 16) || 0;
    if (raw.length >= 8) a = parseInt(raw.slice(6, 8), 16);
  }

  const alpha = Math.max(0, Math.min(1, Number(opacity ?? 1))) * (a / 255);
  const hexColor = `0x${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
  return alpha >= 0.999 ? hexColor : `${hexColor}@${alpha.toFixed(3)}`;
}

/**
 * Extrai componentes RGBA de um hex (útil para ASS, que usa AABBGGRR).
 * @param {string} hex
 * @returns {{r:number,g:number,b:number,a:number}}
 */
function hexToRgb(hex) {
  const raw = String(hex || '#000000').trim().replace(/^#/, '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.padEnd(6, '0').slice(0, 6);
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
    a: 255
  };
}

/**
 * Converte hex para o formato de cor do ASS (`&HAABBGGRR`).
 * @param {string} hex
 * @param {number} [opacity=1] 1 = opaco, 0 = transparente
 * @returns {string}
 */
function toAssColor(hex, opacity = 1) {
  const { r, g, b } = hexToRgb(hex);
  const alpha = Math.round((1 - Math.max(0, Math.min(1, Number(opacity) || 0))) * 255);
  const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0').toUpperCase();
  return `&H${toHex(alpha)}${toHex(b)}${toHex(g)}${toHex(r)}`;
}

/** Converte um nome de alinhamento ("bottom-center") em (alignX, alignY) numéricos 0..1. */
function anchorToRatio(anchor) {
  const [vertical, horizontal] = String(anchor || 'center').split('-');
  const mapX = { left: 0, center: 0.5, middle: 0.5, right: 1 };
  const mapY = { top: 0, upper: 0.25, center: 0.5, middle: 0.5, lower: 0.75, bottom: 1 };
  const x = mapX[horizontal] ?? mapX[vertical] ?? 0.5;
  const y = mapY[vertical] ?? mapY[horizontal] ?? 0.5;
  return { x, y };
}

module.exports = {
  escapeFilterValue,
  escapeFilterPath,
  escapeDrawtext,
  escapeDrawtextPath,
  toFfmpegColor,
  toAssColor,
  hexToRgb,
  anchorToRatio
};
