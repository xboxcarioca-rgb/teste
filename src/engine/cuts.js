/**
 * Detecção de "cortes virais".
 *
 * A ideia: um bom corte começa e termina numa respiração (não no meio de uma
 * palavra), tem um gancho nos primeiros segundos, fala densa (sem ar morto),
 * variação de energia (emoção) e duração dentro da janela doce da plataforma.
 *
 * As funções de pontuação são puras e testáveis. A coleta dos sinais
 * (silêncios, energia, cenas) acontece em analyze.js, via FFmpeg.
 */

const { round3, clamp } = require('../common/time');
const { DEFAULT_CUT_SETTINGS } = require('../common/defaults');

/**
 * Converte intervalos de fala em "pontos de corte naturais" (meio dos silêncios).
 * @param {{start:number,end:number}[]} speech
 * @param {number} duration duração total do vídeo
 * @param {{minGap?:number}} [options]
 * @returns {number[]} lista ordenada de tempos seguros para cortar
 */
function cutPointsFromSpeech(speech, duration, options = {}) {
  const minGap = Number(options.minGap) || 0.35;
  const sorted = [...(speech || [])].sort((a, b) => a.start - b.start);
  const points = [0];

  for (let i = 1; i < sorted.length; i += 1) {
    const gapStart = sorted[i - 1].end;
    const gapEnd = sorted[i].start;
    if (gapEnd - gapStart >= minGap) points.push(round3((gapStart + gapEnd) / 2));
  }

  points.push(round3(duration));
  // Remove duplicatas e garante ordem.
  return [...new Set(points.map((point) => round3(point)))].sort((a, b) => a - b);
}

/** Energia média de um trecho a partir de amostras {time, rms}. */
function energyInRange(energy, start, end) {
  const samples = (energy || []).filter((sample) => sample.time >= start && sample.time <= end);
  if (!samples.length) return { mean: 0, peak: 0, variance: 0, count: 0 };
  const values = samples.map((sample) => Number(sample.rms) || 0);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const peak = Math.max(...values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return { mean, peak, variance, count: values.length };
}

/** Fração do trecho coberta por fala (0..1). */
function speechDensity(speech, start, end) {
  const window = Math.max(0.001, end - start);
  const covered = (speech || [])
    .filter((item) => item.end > start && item.start < end)
    .reduce((sum, item) => sum + (Math.min(item.end, end) - Math.max(item.start, start)), 0);
  return clamp(covered / window, 0, 1);
}

/** Quantidade de mudanças de cena por minuto dentro do trecho. */
function sceneDensity(scenes, start, end) {
  const window = Math.max(0.001, end - start);
  const count = (scenes || []).filter((scene) => scene >= start && scene <= end).length;
  return (count / window) * 60;
}

/**
 * Pontua um candidato a corte (0..100).
 *
 * @param {object} params
 * @param {number} params.start
 * @param {number} params.end
 * @param {{start:number,end:number}[]} [params.speech]
 * @param {{time:number,rms:number}[]} [params.energy]
 * @param {number[]} [params.scenes]
 * @param {object} [params.settings]
 * @returns {{score:number,reasons:string[],metrics:object}}
 */
function scoreSegment({ start, end, speech = [], energy = [], scenes = [], settings = {} }) {
  const cfg = { ...DEFAULT_CUT_SETTINGS, ...settings };
  const duration = Math.max(0.001, end - start);
  const reasons = [];

  // 1) Duração dentro da janela doce (curva trapezoidal).
  const min = Number(cfg.targetMinSeconds) || 15;
  const max = Number(cfg.targetMaxSeconds) || 60;
  let durationScore;
  if (duration < min * 0.5 || duration > max * 1.6) durationScore = 0.1;
  else if (duration < min) durationScore = 0.45 + 0.55 * ((duration - min * 0.5) / Math.max(0.001, min * 0.5));
  else if (duration > max) durationScore = 1 - 0.6 * ((duration - max) / Math.max(0.001, max * 0.6));
  else {
    const ideal = min + (max - min) * 0.45;
    const spread = Math.max(1, (max - min) / 2);
    durationScore = 1 - 0.35 * Math.min(1, Math.abs(duration - ideal) / spread);
  }
  durationScore = clamp(durationScore, 0, 1);
  if (durationScore > 0.85) reasons.push(`duração ideal (${Math.round(duration)}s)`);
  else if (durationScore < 0.4) reasons.push('duração fora da janela recomendada');

  // 2) Densidade de fala: cortes com muito silêncio morrem no feed.
  const density = speechDensity(speech, start, end);
  const densityScore = clamp((density - 0.35) / 0.5, 0, 1);
  if (density > 0.8) reasons.push('fala contínua, sem ar morto');
  if (density < 0.4) reasons.push('muito silêncio no trecho');

  // 3) Gancho: pico de energia logo no início prende a atenção.
  const hookWindow = Number(cfg.hookWindowSeconds) || 3;
  const hook = energyInRange(energy, start, start + Math.min(hookWindow, duration));
  const whole = energyInRange(energy, start, end);
  const hookScore = whole.mean > 0 ? clamp((hook.peak / Math.max(0.001, whole.peak)) * (hook.mean / whole.mean), 0, 1.4) / 1.4 : 0.5;
  if (hookScore > 0.75) reasons.push('gancho forte nos primeiros segundos');

  // 4) Dinâmica: variação de energia = emoção/ênfase.
  const dynamicsScore = clamp(Math.sqrt(whole.variance) / Math.max(0.001, whole.mean) / 1.5, 0, 1);
  if (dynamicsScore > 0.6) reasons.push('boa variação de intensidade');

  // 5) Ritmo visual: algumas mudanças de cena ajudam; excesso atrapalha.
  const sceneRate = sceneDensity(scenes, start, end);
  const rhythmScore = sceneRate <= 0 ? 0.5 : clamp(1 - Math.abs(sceneRate - 12) / 24, 0.15, 1);
  if (sceneRate > 20) reasons.push('muita troca de cena (pode cansar)');

  // 6) Volume absoluto: trecho muito baixo costuma ser trecho fraco.
  const levelScore = clamp((whole.mean + 60) / 35, 0, 1);
  if (whole.mean < -45) reasons.push('áudio muito baixo no trecho');

  const weights = { duration: 0.2, density: 0.24, hook: 0.2, dynamics: 0.14, rhythm: 0.1, level: 0.12 };
  const score =
    durationScore * weights.duration +
    densityScore * weights.density +
    hookScore * weights.hook +
    dynamicsScore * weights.dynamics +
    rhythmScore * weights.rhythm +
    levelScore * weights.level;

  return {
    score: round3(clamp(score, 0, 1) * 100),
    reasons,
    metrics: {
      duration: round3(duration),
      speechDensity: round3(density),
      hookScore: round3(hookScore),
      dynamics: round3(dynamicsScore),
      sceneRate: round3(sceneRate),
      meanRms: round3(whole.mean),
      peakRms: round3(whole.peak)
    }
  };
}

/** Dois trechos se sobrepõem? (com margem de segurança) */
function overlaps(a, b, margin = 0.5) {
  return a.start < b.end - margin && b.start < a.end - margin;
}

/**
 * Propõe os cortes virais.
 *
 * @param {object} params
 * @param {number} params.duration duração total da fonte
 * @param {{start:number,end:number}[]} [params.speech] intervalos de fala
 * @param {{time:number,rms:number}[]} [params.energy] energia do áudio por janela
 * @param {number[]} [params.scenes] tempos de mudança de cena
 * @param {object} [params.settings] DEFAULT_CUT_SETTINGS
 * @returns {{id:string,start:number,end:number,duration:number,score:number,reasons:string[],metrics:object,label:string}[]}
 */
function proposeCuts({ duration, speech = [], energy = [], scenes = [], settings = {} }) {
  const cfg = { ...DEFAULT_CUT_SETTINGS, ...settings };
  const total = Math.max(0.5, Number(duration) || 0.5);
  const mode = cfg.mode || 'auto';
  const minDuration = Math.max(2, Number(cfg.targetMinSeconds) || 15);
  const maxDuration = Math.max(minDuration + 1, Number(cfg.targetMaxSeconds) || 60);
  const maxCuts = Math.max(1, Number(cfg.maxCuts) || 8);

  /** @type {{start:number,end:number}[]} */
  const candidates = [];

  if (mode === 'fixed') {
    for (let start = 0; start < total - 1; start += maxDuration) {
      candidates.push({ start: round3(start), end: round3(Math.min(total, start + maxDuration)) });
    }
  } else if (mode === 'scenes' && scenes.length) {
    const marks = [0, ...scenes.filter((scene) => scene > 0 && scene < total), total];
    for (let i = 0; i < marks.length - 1; i += 1) {
      const start = marks[i];
      const end = marks[i + 1];
      if (end - start >= minDuration * 0.5) candidates.push({ start: round3(start), end: round3(end) });
      // Junta cenas próximas para atingir a duração mínima.
      if (end - start < minDuration && marks[i + 2] != null) {
        candidates.push({ start: round3(start), end: round3(marks[i + 2]) });
      }
    }
  } else {
    // auto | speech: usa pontos de corte naturais (respirações) como fronteiras.
    const points =
      speech.length >= 2
        ? cutPointsFromSpeech(speech, total, { minGap: Number(cfg.silenceMinDuration) || 0.45 })
        : scenes.length
          ? [0, ...scenes, total].sort((a, b) => a - b)
          : Array.from({ length: Math.ceil(total / minDuration) + 1 }, (_, index) => round3(index * minDuration)).concat(round3(total));

    const uniquePoints = [...new Set(points.map((point) => round3(clamp(point, 0, total))))].sort((a, b) => a - b);

    for (let i = 0; i < uniquePoints.length; i += 1) {
      for (let j = i + 1; j < uniquePoints.length; j += 1) {
        const start = uniquePoints[i];
        const end = uniquePoints[j];
        const length = end - start;
        if (length < minDuration * 0.6) continue;
        if (length > maxDuration * 1.5) break;
        candidates.push({ start, end });
      }
    }

    // Sem fala nem cenas: grade fixa como última alternativa.
    if (!candidates.length) {
      for (let start = 0; start < total - 1; start += maxDuration) {
        candidates.push({ start: round3(start), end: round3(Math.min(total, start + maxDuration)) });
      }
    }
  }

  const scored = candidates
    .map((candidate, index) => {
      const evaluation = scoreSegment({ ...candidate, speech, energy, scenes, settings: cfg });
      return {
        id: `cut_${index.toString(36)}_${Math.round(candidate.start * 1000).toString(36)}`,
        start: candidate.start,
        end: candidate.end,
        duration: round3(candidate.end - candidate.start),
        ...evaluation
      };
    })
    .filter((candidate) => candidate.score >= (Number(cfg.minScore) || 0));

  // Seleção gulosa: melhores primeiro, sem sobreposição.
  scored.sort((a, b) => b.score - a.score);
  const chosen = [];
  for (const candidate of scored) {
    if (chosen.length >= maxCuts) break;
    if (chosen.some((picked) => overlaps(picked, candidate))) continue;
    chosen.push(candidate);
  }

  chosen.sort((a, b) => a.start - b.start);
  return chosen.map((candidate, index) => ({
    ...candidate,
    label: `Corte ${index + 1}`,
    selected: true
  }));
}

/** Nome sugerido para o arquivo de um corte, aplicando o padrão configurado. */
function buildFilename(pattern, context) {
  const replacements = {
    title: context.title || 'corte',
    format: context.format || 'vertical',
    index: String(context.index ?? 1).padStart(2, '0'),
    score: String(Math.round(context.score ?? 0)),
    duration: String(Math.round(context.duration ?? 0)),
    start: String(Math.round(context.start ?? 0)),
    date: new Date().toISOString().slice(0, 10),
    layout: context.layout || 'fill'
  };
  const result = String(pattern || '{title}-{format}-{index}').replace(/\{(\w+)\}/g, (match, key) =>
    replacements[key] !== undefined ? replacements[key] : match
  );
  return result.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '').trim() || 'corte';
}

module.exports = {
  cutPointsFromSpeech,
  energyInRange,
  speechDensity,
  sceneDensity,
  scoreSegment,
  proposeCuts,
  buildFilename,
  overlaps
};
