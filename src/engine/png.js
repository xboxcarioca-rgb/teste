/**
 * Escritor mínimo de PNG (RGB 8-bit), sem dependências externas.
 *
 * Usado para gerar fundos em gradiente: builds antigos de FFmpeg não têm o
 * filtro `gradients`, então o app desenha o gradiente em PNG e o usa como
 * entrada `-loop 1`. Funciona em qualquer versão do FFmpeg.
 */

const zlib = require('zlib');

/** Tabela CRC-32 (polinômio do PNG). */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

/**
 * Empacota pixels RGBA em um PNG.
 * @param {number} width
 * @param {number} height
 * @param {Buffer} rgba tamanho esperado: width*height*4
 * @returns {Buffer}
 */
function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Cada linha é prefixada pelo byte de filtro (0 = none).
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const idat = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/** Converte "#RRGGBB" em [r,g,b]. */
function hexToTuple(hex) {
  const raw = String(hex || '#000000').replace(/^#/, '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.padEnd(6, '0').slice(0, 6);
  return [parseInt(full.slice(0, 2), 16) || 0, parseInt(full.slice(2, 4), 16) || 0, parseInt(full.slice(4, 6), 16) || 0];
}

function mix(a, b, t) {
  return a.map((value, index) => Math.round(value + (b[index] - value) * t));
}

/**
 * Gera um PNG com gradiente (linear, diagonal suave) entre duas cores.
 * @param {object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {string} options.from cor inicial (#RRGGBB)
 * @param {string} options.to cor final (#RRGGBB)
 * @param {'vertical'|'horizontal'|'diagonal'|'radial'} [options.direction='diagonal']
 * @returns {Buffer} PNG pronto para gravar em disco
 */
function createGradientPng({ width, height, from, to, direction = 'diagonal' }) {
  const w = Math.max(2, Math.round(width));
  const h = Math.max(2, Math.round(height));
  const start = hexToTuple(from);
  const end = hexToTuple(to);
  const pixels = Buffer.alloc(w * h * 4);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let t;
      if (direction === 'vertical') t = y / (h - 1);
      else if (direction === 'horizontal') t = x / (w - 1);
      else if (direction === 'radial') {
        const dx = (x - w / 2) / (w / 2);
        const dy = (y - h / 2) / (h / 2);
        t = Math.min(1, Math.sqrt(dx * dx + dy * dy) / Math.SQRT2);
      } else {
        t = (x / (w - 1) + y / (h - 1)) / 2;
      }
      const [r, g, b] = mix(start, end, t);
      const offset = (y * w + x) * 4;
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      pixels[offset + 3] = 255;
    }
  }

  return encodePng(w, h, pixels);
}

/**
 * Gera um PNG sólido (útil como placeholder de logo ausente).
 * @param {{width:number,height:number,color:string}} options
 */
function createSolidPng({ width, height, color }) {
  return createGradientPng({ width, height, from: color, to: color, direction: 'vertical' });
}

module.exports = { encodePng, createGradientPng, createSolidPng, crc32 };
