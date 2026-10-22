/**
 * Resolução do FFmpeg/FFprobe em uso.
 *
 * Ordem de preferência:
 *   1. caminho definido pelo usuário nas configurações;
 *   2. binário embutido no instalador (@ffmpeg-installer, já descompactado do asar);
 *   3. binário baixado pelo app em <userData>/bin;
 *   4. ffmpeg/ffprobe do sistema (PATH).
 *
 * As capacidades do binário escolhido são detectadas uma vez e ficam em cache.
 */

const fs = require('fs');
const path = require('path');
const { detectCapabilities, serializeCapabilities } = require('../engine/capabilities');
const { testBinary, findFileRecursive, ensureDir } = require('./binaries');

let cache = null;

/** Caminho do binário embutido, tratando o asar (que não permite executar). */
function bundledBinary(kind) {
  try {
    if (kind === 'ffprobe') {
      const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
      return unpack(ffprobeInstaller.path);
    }
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    return unpack(ffmpegInstaller.path);
  } catch {
    return null;
  }
}

/** Converte ".../app.asar/node_modules/..." em ".../app.asar.unpacked/node_modules/...". */
function unpack(filePath) {
  if (!filePath) return null;
  if (filePath.includes(`${path.sep}app.asar${path.sep}`)) {
    return filePath.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
  }
  return filePath;
}

/** Procura o binário no diretório gerenciado pelo app. */
async function managedBinary(binDir, name) {
  if (!binDir || !fs.existsSync(binDir)) return null;
  const executable = process.platform === 'win32' ? `${name}.exe` : name;
  const direct = path.join(binDir, executable);
  if (fs.existsSync(direct)) return direct;
  return findFileRecursive(binDir, (fileName) => fileName.toLowerCase() === executable.toLowerCase(), 3);
}

/** Procura no PATH do sistema. */
function systemBinary(name) {
  const executable = process.platform === 'win32' ? `${name}.exe` : name;
  const pathDirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of pathDirs) {
    const candidate = path.join(dir, executable);
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* diretório inacessível */
    }
  }
  return null;
}

/**
 * Resolve ffmpeg + ffprobe.
 * @param {{binDir?:string,settings?:{ffmpegPath?:string,ffprobePath?:string}}} [options]
 * @returns {Promise<{ffmpegPath:string|null,ffprobePath:string|null,source:'user'|'bundled'|'managed'|'system'|null,capabilities:object|null}>}
 */
async function resolveFfmpeg(options = {}) {
  const binDir = options.binDir ? ensureDir(options.binDir) : null;
  const settings = options.settings || {};

  const candidates = [
    { source: 'user', ffmpeg: settings.ffmpegPath || null, ffprobe: settings.ffprobePath || null },
    { source: 'bundled', ffmpeg: bundledBinary('ffmpeg'), ffprobe: bundledBinary('ffprobe') },
    { source: 'managed', ffmpeg: binDir ? await managedBinary(binDir, 'ffmpeg') : null, ffprobe: binDir ? await managedBinary(binDir, 'ffprobe') : null },
    { source: 'system', ffmpeg: systemBinary('ffmpeg'), ffprobe: systemBinary('ffprobe') }
  ];

  for (const candidate of candidates) {
    if (!candidate.ffmpeg) continue;
    if (!fs.existsSync(candidate.ffmpeg)) continue;
    const works = await testBinary(candidate.ffmpeg, ['-hide_banner', '-version']);
    if (!works) continue;

    // ffprobe é opcional, mas sem ele perdemos duração/resolução.
    let ffprobePath = candidate.ffprobe && fs.existsSync(candidate.ffprobe) ? candidate.ffprobe : null;
    if (!ffprobePath) {
      const fallback = binDir ? await managedBinary(binDir, 'ffprobe') : null;
      ffprobePath = fallback || systemBinary('ffprobe');
    }

    const capabilities = await detectCapabilities(candidate.ffmpeg);
    cache = {
      ffmpegPath: candidate.ffmpeg,
      ffprobePath,
      source: candidate.source,
      capabilities,
      serialized: serializeCapabilities(capabilities)
    };
    return cache;
  }

  return { ffmpegPath: null, ffprobePath: null, source: null, capabilities: null };
}

/** Devolve o resultado em cache (ou resolve de novo). */
async function getFfmpeg(options = {}) {
  if (cache?.ffmpegPath && fs.existsSync(cache.ffmpegPath)) return cache;
  return resolveFfmpeg(options);
}

/** Limpa o cache (usado quando o usuário muda o caminho nas configurações). */
function invalidateFfmpegCache() {
  cache = null;
}

module.exports = { resolveFfmpeg, getFfmpeg, invalidateFfmpegCache, bundledBinary, unpack, systemBinary };
