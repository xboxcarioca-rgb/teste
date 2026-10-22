/**
 * Detecção de capacidades do FFmpeg em uso.
 *
 * O binário pode ser: o embutido no instalador, o do sistema (PATH) ou um
 * escolhido pelo usuário — e cada build tem um conjunto diferente de filtros,
 * encoders e opções. Em vez de assumir, o app pergunta e degrada com aviso.
 */

const { execFile } = require('child_process');

/**
 * Executa um comando e devolve stdout+stderr.
 * @param {string} bin
 * @param {string[]} args
 * @param {number} [timeoutMs=20000]
 * @returns {Promise<{stdout:string,stderr:string,code:number}>}
 */
function run(bin, args, timeoutMs = 20000) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      resolve({
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
        code: error ? (typeof error.code === 'number' ? error.code : 1) : 0
      });
    });
  });
}

/** Converte a saída de `-filters` em um Set de nomes. */
function parseFilterNames(output) {
  const names = new Set();
  for (const line of String(output).split('\n')) {
    // Formato: " T.C drawtext           V->V       descrição"
    const match = /^\s*[A-Z.]{2,4}\s+([a-z0-9_]+)\s+[A-Z|]+->[A-Z|]+/.exec(line);
    if (match) names.add(match[1]);
  }
  return names;
}

/** Converte a saída de `-encoders` em um Set de nomes. */
function parseEncoderNames(output) {
  const names = new Set();
  for (const line of String(output).split('\n')) {
    // Formato: " V..... libx264    H.264 / AVC ..."
    const match = /^\s*[VASD.][FSXBD.]{5}\s+([a-z0-9_]+)\s/.exec(line);
    if (match) names.add(match[1]);
  }
  return names;
}

/**
 * Descobre tudo que o FFmpeg em uso suporta.
 * @param {string} ffmpegPath
 * @returns {Promise<{
 *   version:string, filters:Set<string>, encoders:Set<string>,
 *   hasDrawtext:boolean, hasSubtitles:boolean, hasAss:boolean, hasGblur:boolean,
 *   hasBoxblur:boolean, hasLoudnorm:boolean, hasFade:boolean, hasColorChannelMixer:boolean,
 *   hasGradients:boolean, hasAmix:boolean, hasOverlay:boolean, hasVstack:boolean, hasHstack:boolean,
 *   hasScale2ref:boolean, hasTrim:boolean, hasDynaudnorm:boolean, hasRubberband:boolean,
 *   hardwareEncoders:string[], ok:boolean, raw:string
 * }>}
 */
async function detectCapabilities(ffmpegPath) {
  const [versionRes, filtersRes, encodersRes, buildConfRes] = await Promise.all([
    run(ffmpegPath, ['-hide_banner', '-version']),
    run(ffmpegPath, ['-hide_banner', '-filters'], 30000),
    run(ffmpegPath, ['-hide_banner', '-encoders'], 30000),
    run(ffmpegPath, ['-hide_banner', '-buildconf'])
  ]);

  const raw = `${versionRes.stdout}${versionRes.stderr}`;
  const versionMatch = /ffmpeg version\s+(\S+)/.exec(raw);
  const filters = parseFilterNames(`${filtersRes.stdout}\n${filtersRes.stderr}`);
  const encoders = parseEncoderNames(`${encodersRes.stdout}\n${encodersRes.stderr}`);
  const buildConf = `${buildConfRes.stdout}${buildConfRes.stderr}`;

  const hardwareEncoders = ['h264_nvenc', 'hevc_nvenc', 'h264_qsv', 'hevc_qsv', 'h264_amf', 'hevc_amf', 'h264_videotoolbox', 'hevc_videotoolbox'].filter(
    (encoder) => encoders.has(encoder)
  );

  return {
    ok: filters.size > 20,
    version: versionMatch ? versionMatch[1] : 'desconhecida',
    filters,
    encoders,
    hasDrawtext: filters.has('drawtext') && /enable-freetype|enable-libfreetype/.test(buildConf),
    hasSubtitles: filters.has('subtitles'),
    hasAss: filters.has('ass'),
    hasGblur: filters.has('gblur'),
    hasBoxblur: filters.has('boxblur'),
    hasLoudnorm: filters.has('loudnorm'),
    hasFade: filters.has('fade'),
    hasColorChannelMixer: filters.has('colorchannelmixer'),
    hasGradients: filters.has('gradients'),
    hasAmix: filters.has('amix'),
    hasOverlay: filters.has('overlay'),
    hasVstack: filters.has('vstack'),
    hasHstack: filters.has('hstack'),
    hasScale2ref: filters.has('scale2ref'),
    hasTrim: filters.has('trim'),
    hasDynaudnorm: filters.has('dynaudnorm'),
    hasRubberband: filters.has('rubberband'),
    hasLibx264: encoders.has('libx264'),
    hasLibx265: encoders.has('libx265'),
    hasAac: encoders.has('aac'),
    hardwareEncoders,
    filterCount: filters.size,
    raw
  };
}

/**
 * Converte o Set de capacidades em um objeto serializável (para IPC/JSON).
 * @param {Awaited<ReturnType<typeof detectCapabilities>>} caps
 */
function serializeCapabilities(caps) {
  return {
    ...caps,
    filters: undefined,
    encoders: undefined,
    filterList: [...(caps.filters || [])].sort(),
    encoderList: [...(caps.encoders || [])].sort(),
    raw: undefined
  };
}

module.exports = { detectCapabilities, serializeCapabilities, parseFilterNames, parseEncoderNames, run };
