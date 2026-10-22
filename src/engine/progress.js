/**
 * Interpreta a saída de `-progress pipe:1` do FFmpeg e a converte em
 * porcentagem + velocidade + tempo restante.
 *
 * Formato recebido (um bloco por atualização, terminado em `progress=...`):
 *   frame=123
 *   fps=45.2
 *   out_time_ms=4123456
 *   out_time=00:00:04.123456
 *   speed=1.5x
 *   progress=continue|end
 */

const { parseTime, round3 } = require('../common/time');

/** Cria um analisador incremental de progresso. */
function createProgressParser(totalDurationSeconds) {
  const total = Math.max(0.001, Number(totalDurationSeconds) || 0.001);
  const state = {
    frame: 0,
    fps: 0,
    speed: 0,
    elapsedSeconds: 0,
    percent: 0,
    etaSeconds: null,
    finished: false
  };
  let buffer = '';
  const startedAt = Date.now();

  /**
   * Alimenta o parser com um trecho de stdout.
   * @param {string} text
   * @returns {object[]} eventos de progresso (0 ou mais)
   */
  function push(text) {
    buffer += String(text || '');
    const events = [];
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let pending = null;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const separator = line.indexOf('=');
      if (separator === -1) continue;
      const key = line.slice(0, separator);
      const value = line.slice(separator + 1);

      switch (key) {
        case 'frame':
          state.frame = parseInt(value, 10) || state.frame;
          break;
        case 'fps':
          state.fps = parseFloat(value) || state.fps;
          break;
        case 'speed':
          state.speed = parseFloat(String(value).replace('x', '')) || state.speed;
          break;
        case 'out_time_ms':
        case 'out_time_us': {
          const micros = parseInt(value, 10);
          if (Number.isFinite(micros) && micros > 0) {
            // `out_time_us` é o nome correto; `out_time_ms` na verdade também
            // carrega microssegundos em várias versões do FFmpeg.
            state.elapsedSeconds = round3(key === 'out_time_us' ? micros / 1e6 : micros / 1e6);
          }
          break;
        }
        case 'out_time':
          if (!state.elapsedSeconds) state.elapsedSeconds = parseTime(value);
          break;
        case 'progress': {
          state.finished = value === 'end';
          pending = snapshot();
          break;
        }
        default:
          break;
      }
    }

    if (pending) events.push(pending);
    return events;
  }

  function snapshot() {
    const percent = Math.max(0, Math.min(100, (state.elapsedSeconds / total) * 100));
    const wallSeconds = (Date.now() - startedAt) / 1000;
    const eta =
      state.finished || percent <= 0
        ? null
        : round3(Math.max(0, (wallSeconds / Math.max(percent, 1)) * (100 - percent)));
    return {
      frame: state.frame,
      fps: round3(state.fps),
      speed: round3(state.speed),
      elapsedSeconds: round3(state.elapsedSeconds),
      totalSeconds: round3(total),
      percent: round3(percent),
      etaSeconds: eta,
      finished: state.finished
    };
  }

  return { push, snapshot, state };
}

/** Extrai mensagens de erro úteis da stderr do FFmpeg. */
function extractError(stderr) {
  const text = String(stderr || '');
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const interesting = lines.filter((line) =>
    /^(Error|Invalid|Unable|Failed|No such|Unknown|Option|Conversion failed|Encoder|Could not|av_interleaved)/i.test(line) ||
    /Error while|error while|does not contain|Invalid argument|No such file/i.test(line)
  );
  const chosen = interesting.length ? interesting : lines.slice(-6);
  return chosen.slice(-8).join(' | ');
}

/** Detecta erros típicos de encoder de hardware para decidir o fallback. */
function isHardwareEncoderFailure(stderr) {
  return /nvenc|qsv|amf|videotoolbox|cuvid|Cannot load (nvcuda|nvEncodeAPI)|no supported|GPU/i.test(String(stderr || ''));
}

module.exports = { createProgressParser, extractError, isHardwareEncoderFailure };
