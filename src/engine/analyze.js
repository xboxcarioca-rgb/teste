/**
 * Análise de mídia via FFmpeg: mudança de cena, silêncio e energia do áudio.
 *
 * A energia é calculada em JavaScript a partir do PCM cru (8 kHz mono), o que
 * funciona em QUALQUER build de FFmpeg — sem depender de filtros de metadados
 * como `astats`/`ametadata`, que mudam de formato entre versões.
 * De quebra, o mesmo passe gera o waveform exibido na linha do tempo.
 */

const { spawn } = require('child_process');
const { round3 } = require('../common/time');

/** Executa o FFmpeg capturando stderr (progresso/erros) e resolvendo com o texto. */
function runToNull(ffmpegPath, args, { timeoutMs = 0, onChunk } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-hide_banner', '-nostdin', ...args], { windowsHide: true });
    let stderr = '';
    let timer = null;

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      if (onChunk) onChunk(text);
    });
    child.stdout.on('data', () => {});
    child.on('error', reject);
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0 || stderr.includes('frame=')) resolve({ code, stderr });
      else reject(new Error(stderr.split('\n').slice(-6).join(' | ') || `ffmpeg saiu com código ${code}`));
    });

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Análise excedeu o tempo limite.'));
      }, timeoutMs);
    }
  });
}

/**
 * Detecta mudanças de cena.
 * @param {string} ffmpegPath
 * @param {string} filePath
 * @param {{threshold?:number}} [options] 0..1 (menor = mais sensível)
 * @returns {Promise<number[]>} tempos em segundos
 */
async function detectScenes(ffmpegPath, filePath, options = {}) {
  const threshold = Math.max(0.05, Math.min(0.9, Number(options.threshold) || 0.28));
  const { stderr } = await runToNull(ffmpegPath, [
    '-i',
    filePath,
    '-vf',
    `select='gt(scene,${threshold})',showinfo`,
    '-f',
    'null',
    '-'
  ]);

  const times = [];
  const regex = /pts_time:([0-9]+(?:\.[0-9]+)?)/g;
  let match;
  while ((match = regex.exec(stderr)) !== null) times.push(round3(parseFloat(match[1])));
  return [...new Set(times)].sort((a, b) => a - b);
}

/**
 * Detecta silêncios.
 * @param {string} ffmpegPath
 * @param {string} filePath
 * @param {{thresholdDb?:number,minDuration?:number}} [options]
 * @returns {Promise<{start:number,end:number}[]>}
 */
async function detectSilence(ffmpegPath, filePath, options = {}) {
  const thresholdDb = Number(options.thresholdDb) || -35;
  const minDuration = Math.max(0.1, Number(options.minDuration) || 0.45);
  const { stderr } = await runToNull(ffmpegPath, [
    '-i',
    filePath,
    '-af',
    `silencedetect=noise=${thresholdDb}dB:d=${minDuration}`,
    '-f',
    'null',
    '-'
  ]);

  const silences = [];
  const startRegex = /silence_start:\s*(-?[0-9]+(?:\.[0-9]+)?)/g;
  const endRegex = /silence_end:\s*(-?[0-9]+(?:\.[0-9]+)?)/g;
  const starts = [];
  const ends = [];
  let match;
  while ((match = startRegex.exec(stderr)) !== null) starts.push(parseFloat(match[1]));
  while ((match = endRegex.exec(stderr)) !== null) ends.push(parseFloat(match[1]));

  starts.forEach((start, index) => {
    const end = ends[index] ?? start + minDuration;
    if (end > start) silences.push({ start: round3(Math.max(0, start)), end: round3(end) });
  });
  return silences;
}

/**
 * Converte silêncios em intervalos de fala (complemento).
 * @param {{start:number,end:number}[]} silences
 * @param {number} duration
 * @returns {{start:number,end:number}[]}
 */
function speechFromSilence(silences, duration) {
  const total = Math.max(0, Number(duration) || 0);
  const sorted = [...(silences || [])].sort((a, b) => a.start - b.start);
  const speech = [];
  let cursor = 0;
  for (const silence of sorted) {
    if (silence.start > cursor + 0.05) speech.push({ start: round3(cursor), end: round3(Math.min(total, silence.start)) });
    cursor = Math.max(cursor, silence.end);
  }
  if (cursor < total - 0.05) speech.push({ start: round3(cursor), end: round3(total) });
  return speech;
}

/**
 * Lê o PCM do áudio (8 kHz mono, s16le) e calcula RMS/pico por janela.
 * Também devolve o waveform normalizado para desenhar na interface.
 *
 * @param {string} ffmpegPath
 * @param {string} filePath
 * @param {{intervalSeconds?:number,waveformPoints?:number}} [options]
 * @returns {Promise<{energy:{time:number,rms:number,peak:number}[],waveform:number[],duration:number}>}
 */
async function analyzeAudioEnergy(ffmpegPath, filePath, options = {}) {
  const interval = Math.max(0.05, Number(options.intervalSeconds) || 0.5);
  const waveformPoints = Math.max(64, Math.min(4096, Number(options.waveformPoints) || 900));
  const sampleRate = 8000;

  const chunks = await new Promise((resolve, reject) => {
    const child = spawn(
      ffmpegPath,
      [
        '-hide_banner',
        '-nostdin',
        '-i',
        filePath,
        '-vn',
        '-f',
        's16le',
        '-acodec',
        'pcm_s16le',
        '-ac',
        '1',
        '-ar',
        String(sampleRate),
        'pipe:1'
      ],
      { windowsHide: true }
    );
    const collected = [];
    let stderr = '';
    child.stdout.on('data', (data) => collected.push(data));
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0 && !collected.length) reject(new Error(stderr.split('\n').slice(-4).join(' | ') || 'falha ao ler áudio'));
      else resolve(collected);
    });
  });

  const pcm = Buffer.concat(chunks);
  const sampleCount = Math.floor(pcm.length / 2);
  if (!sampleCount) return { energy: [], waveform: [], duration: 0 };

  const duration = sampleCount / sampleRate;
  const samplesPerWindow = Math.max(1, Math.round(interval * sampleRate));
  const energy = [];
  let peakGlobal = 1;

  for (let offset = 0; offset < sampleCount; offset += samplesPerWindow) {
    const end = Math.min(sampleCount, offset + samplesPerWindow);
    let sumSquares = 0;
    let peak = 0;
    for (let i = offset; i < end; i += 1) {
      const sample = pcm.readInt16LE(i * 2) / 32768;
      sumSquares += sample * sample;
      const absolute = Math.abs(sample);
      if (absolute > peak) peak = absolute;
    }
    const rms = Math.sqrt(sumSquares / Math.max(1, end - offset));
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -90;
    if (rms > peakGlobal) peakGlobal = rms;
    energy.push({ time: round3(offset / sampleRate), rms: round3(rmsDb), peak: round3(peak) });
  }

  // Waveform normalizado (0..1) para a linha do tempo.
  const samplesPerPoint = Math.max(1, Math.floor(sampleCount / waveformPoints));
  const waveform = [];
  for (let point = 0; point < waveformPoints; point += 1) {
    const start = point * samplesPerPoint;
    const end = Math.min(sampleCount, start + samplesPerPoint);
    if (start >= sampleCount) break;
    let max = 0;
    for (let i = start; i < end; i += 1) {
      const absolute = Math.abs(pcm.readInt16LE(i * 2) / 32768);
      if (absolute > max) max = absolute;
    }
    waveform.push(Math.round(max * 1000) / 1000);
  }

  return { energy, waveform, duration: round3(duration), peakGlobal: round3(peakGlobal) };
}

/**
 * Análise completa usada pela detecção de cortes.
 * @param {object} params
 * @param {string} params.ffmpegPath
 * @param {string} params.filePath
 * @param {number} params.duration
 * @param {boolean} [params.hasAudio]
 * @param {object} [params.settings] DEFAULT_CUT_SETTINGS
 * @param {(stage:{stage:string,percent:number,message?:string})=>void} [params.onProgress]
 * @param {AbortSignal} [params.signal]
 */
async function analyzeMedia({ ffmpegPath, filePath, duration, hasAudio = true, settings = {}, onProgress, signal }) {
  const report = (stage, percent, message) => {
    if (onProgress && !signal?.aborted) onProgress({ stage, percent, message });
  };

  report('scenes', 10, 'Detectando mudanças de cena…');
  const scenes = await detectScenes(ffmpegPath, filePath, { threshold: settings.sceneThreshold || 0.28 });

  let silences = [];
  let energy = [];
  let waveform = [];
  let speech = [];

  if (hasAudio) {
    report('silence', 35, 'Mapeando silêncios (pontos de respiração)…');
    silences = await detectSilence(ffmpegPath, filePath, {
      thresholdDb: settings.silenceThresholdDb || -35,
      minDuration: settings.silenceMinDuration || 0.45
    });

    report('energy', 60, 'Medindo energia do áudio…');
    const audio = await analyzeAudioEnergy(ffmpegPath, filePath, { intervalSeconds: 0.5, waveformPoints: 1200 });
    energy = audio.energy;
    waveform = audio.waveform;
    speech = settings.snapToSpeech !== false ? speechFromSilence(silences, duration) : [];
  }

  report('done', 100, 'Análise concluída.');
  return {
    duration: round3(duration),
    scenes,
    silences,
    speech,
    energy,
    waveform,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  detectScenes,
  detectSilence,
  speechFromSilence,
  analyzeAudioEnergy,
  analyzeMedia,
  runToNull
};
