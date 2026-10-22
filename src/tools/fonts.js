/**
 * Fontes do sistema.
 *
 * O FFmpeg (drawtext) precisa do CAMINHO do arquivo de fonte, e o libass
 * precisa do NOME DA FAMÍLIA exato. Por isso este módulo lê a tabela `name`
 * dos arquivos .ttf/.otf e devolve { family, path } — sem dependências
 * externas e sem internet.
 */

const fs = require('fs');
const path = require('path');

/** Diretórios de fonte por plataforma. */
function fontDirectories() {
  if (process.platform === 'win32') {
    const windowsDir = process.env.WINDIR || 'C:\\Windows';
    const local = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts') : null;
    return [path.join(windowsDir, 'Fonts'), local].filter(Boolean);
  }
  if (process.platform === 'darwin') {
    const home = require('os').homedir();
    return ['/System/Library/Fonts', '/Library/Fonts', path.join(home, 'Library', 'Fonts')];
  }
  return ['/usr/share/fonts', '/usr/local/share/fonts', path.join(require('os').homedir(), '.fonts')];
}

/**
 * Lê o nome da família de um arquivo TTF/OTF (tabela `name`).
 * @param {string} filePath
 * @returns {{family:string,subfamily:string,fullName:string}|null}
 */
function readFontName(filePath) {
  let fd = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(12);
    fs.readSync(fd, header, 0, 12, 0);
    const tag = header.toString('ascii', 0, 4);

    let tableDirectoryOffset = 12;
    let numTables = header.readUInt16BE(4);

    // Coleção TrueType (.ttc): usa a primeira fonte da lista.
    if (tag === 'ttcf') {
      const ttcHeader = Buffer.alloc(16);
      fs.readSync(fd, ttcHeader, 0, 16, 0);
      const numFonts = ttcHeader.readUInt32BE(8);
      if (numFonts < 1) return null;
      const offsets = Buffer.alloc(4);
      fs.readSync(fd, offsets, 0, 4, 12);
      tableDirectoryOffset = offsets.readUInt32BE(0) + 12;
      const sub = Buffer.alloc(4);
      fs.readSync(fd, sub, 0, 4, offsets.readUInt32BE(0) + 4);
      numTables = sub.readUInt16BE(0);
    } else if (tag !== '\u0000\u0001\u0000\u0000' && tag !== 'OTTO' && tag !== 'true' && tag !== 'typ1') {
      return null;
    }

    // Localiza a tabela 'name'.
    let nameOffset = -1;
    const recordSize = 16;
    for (let index = 0; index < Math.min(numTables, 64); index += 1) {
      const record = Buffer.alloc(recordSize);
      fs.readSync(fd, record, 0, recordSize, tableDirectoryOffset - 12 + index * recordSize);
      if (record.toString('ascii', 0, 4) === 'name') {
        nameOffset = record.readUInt32BE(8);
        break;
      }
    }
    if (nameOffset < 0) return null;

    const nameHeader = Buffer.alloc(6);
    fs.readSync(fd, nameHeader, 0, 6, nameOffset);
    const count = nameHeader.readUInt16BE(2);
    const stringOffset = nameHeader.readUInt16BE(4);
    const stringsBase = nameOffset + stringOffset;

    const wanted = { 1: null, 2: null, 4: null, 16: null, 17: null };
    const recordBytes = Buffer.alloc(count * 12);
    fs.readSync(fd, recordBytes, 0, recordBytes.length, nameOffset + 6);

    for (let index = 0; index < count; index += 1) {
      const base = index * 12;
      const platformId = recordBytes.readUInt16BE(base);
      const languageId = recordBytes.readUInt16BE(base + 4);
      const nameId = recordBytes.readUInt16BE(base + 6);
      const length = recordBytes.readUInt16BE(base + 8);
      const offset = recordBytes.readUInt16BE(base + 10);
      if (!(nameId in wanted) || wanted[nameId]) continue;

      // Prioriza Windows/Unicode em inglês; evita strings em outros idiomas.
      const isUnicode = platformId === 3 || platformId === 0;
      const isEnglish = platformId === 3 ? languageId === 0x0409 : languageId === 0;
      if (platformId !== 1 && !(isUnicode && isEnglish)) continue;

      const raw = Buffer.alloc(length);
      fs.readSync(fd, raw, 0, length, stringsBase + offset);
      const text = isUnicode
        ? raw.toString('utf16le').replace(/\0/g, '')
        : raw.toString('latin1').replace(/\0/g, '');
      // Buffer UTF-16BE precisa de byte-swap.
      const decoded = isUnicode ? Buffer.from(swapBytes(raw)).toString('utf16le').replace(/\0/g, '').trim() : text.trim();
      if (decoded) wanted[nameId] = decoded;
    }

    const family = wanted[16] || wanted[1] || null;
    if (!family) return null;
    return {
      family,
      subfamily: wanted[17] || wanted[2] || '',
      fullName: wanted[4] || `${family} ${wanted[2] || wanted[17] || ''}`.trim()
    };
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        /* ignore */
      }
    }
  }
}

function swapBytes(buffer) {
  const copy = Buffer.from(buffer);
  for (let index = 0; index + 1 < copy.length; index += 2) {
    const temporary = copy[index];
    copy[index] = copy[index + 1];
    copy[index + 1] = temporary;
  }
  return copy;
}

/**
 * Lista as fontes instaladas.
 * @param {{maxFiles?:number,cacheFile?:string}} [options]
 * @returns {{family:string,path:string,subfamily:string}[]}
 */
function listSystemFonts(options = {}) {
  const maxFiles = options.maxFiles || 800;
  if (options.cacheFile && fs.existsSync(options.cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(options.cacheFile, 'utf8'));
      if (Array.isArray(cached) && cached.length && Date.now() - (cached.generatedAt || 0) < 7 * 86400000) {
        return cached.fonts;
      }
    } catch {
      /* cache inválido: regenera */
    }
  }

  const fonts = [];
  const seen = new Set();
  const queue = fontDirectories();

  while (queue.length && fonts.length < maxFiles) {
    const dir = queue.shift();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        queue.push(full);
        continue;
      }
      if (!/\.(ttf|otf|ttc)$/i.test(entry.name)) continue;
      if (seen.has(full)) continue;
      seen.add(full);
      const info = readFontName(full);
      if (info?.family) {
        fonts.push({ family: info.family, subfamily: info.subfamily || '', path: full });
      } else {
        fonts.push({ family: path.basename(entry.name, path.extname(entry.name)), subfamily: '', path: full });
      }
      if (fonts.length >= maxFiles) break;
    }
  }

  fonts.sort((a, b) => a.family.localeCompare(b.family));
  if (options.cacheFile) {
    try {
      fs.mkdirSync(path.dirname(options.cacheFile), { recursive: true });
      fs.writeFileSync(options.cacheFile, JSON.stringify({ generatedAt: Date.now(), fonts }), 'utf8');
    } catch {
      /* cache é otimização, não requisito */
    }
  }
  return fonts;
}

/** Fontes de fallback garantidas em cada plataforma. */
const FALLBACK_FONTS = {
  win32: [
    { family: 'Segoe UI', file: 'segoeui.ttf', boldFile: 'segoeuib.ttf' },
    { family: 'Arial', file: 'arial.ttf', boldFile: 'arialbd.ttf' },
    { family: 'Impact', file: 'impact.ttf', boldFile: 'impact.ttf' }
  ],
  darwin: [
    { family: 'Helvetica Neue', file: 'Helvetica.ttc', boldFile: 'Helvetica.ttc' },
    { family: 'Arial', file: 'Arial.ttf', boldFile: 'Arial Bold.ttf' }
  ],
  linux: [
    { family: 'DejaVu Sans', file: 'DejaVuSans.ttf', boldFile: 'DejaVuSans-Bold.ttf' },
    { family: 'Liberation Sans', file: 'LiberationSans-Regular.ttf', boldFile: 'LiberationSans-Bold.ttf' }
  ]
};

/**
 * Resolve um nome de família (ou caminho) para um arquivo de fonte real.
 * @param {string} familyOrPath
 * @param {{fonts?:{family:string,path:string,subfamily:string}[],bold?:boolean}} [options]
 * @returns {{path:string|null,family:string,matched:boolean,reason?:string}}
 */
function resolveFontFile(familyOrPath, options = {}) {
  const requested = String(familyOrPath || '').trim();
  const fonts = options.fonts || [];

  if (!requested) return { path: null, family: '', matched: false, reason: 'Nenhuma fonte especificada.' };

  // Caminho direto para um arquivo.
  if (/\.(ttf|otf|ttc)$/i.test(requested)) {
    if (fs.existsSync(requested)) {
      const info = readFontName(requested);
      return { path: requested, family: info?.family || path.basename(requested, path.extname(requested)), matched: true };
    }
    return { path: null, family: requested, matched: false, reason: `Arquivo de fonte não encontrado: ${requested}` };
  }

  const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const target = normalize(requested);

  const candidates = fonts.filter((font) => normalize(font.family) === target);
  if (candidates.length) {
    const boldMatch = options.bold
      ? candidates.find((font) => /bold|black|heavy|negrito/i.test(font.subfamily) || /bold|black/i.test(path.basename(font.path)))
      : null;
    const chosen = boldMatch || candidates[0];
    return { path: chosen.path, family: chosen.family, matched: true };
  }

  const partial = fonts.find((font) => normalize(font.family).includes(target) || target.includes(normalize(font.family)));
  if (partial) return { path: partial.path, family: partial.family, matched: true, reason: `Usando "${partial.family}" no lugar de "${requested}".` };

  // Fallback de sistema.
  const fallbacks = FALLBACK_FONTS[process.platform] || FALLBACK_FONTS.linux;
  for (const fallback of fallbacks) {
    const found = fonts.find((font) => normalize(font.family) === normalize(fallback.family));
    if (found) return { path: found.path, family: found.family, matched: false, reason: `"${requested}" não está instalada; usando ${found.family}.` };
  }

  // Último recurso: procura o arquivo padrão no diretório de fontes do sistema.
  for (const dir of fontDirectories()) {
    for (const fallback of fallbacks) {
      const candidate = path.join(dir, options.bold ? fallback.boldFile : fallback.file);
      if (fs.existsSync(candidate)) {
        return { path: candidate, family: fallback.family, matched: false, reason: `"${requested}" não está instalada; usando ${fallback.family}.` };
      }
    }
  }

  return { path: null, family: requested, matched: false, reason: 'Nenhuma fonte disponível no sistema.' };
}

module.exports = { fontDirectories, readFontName, listSystemFonts, resolveFontFile, FALLBACK_FONTS };
