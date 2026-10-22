/**
 * Utilitários de tempo e texto — usados por legendas, cortes e UI.
 * Módulo puro, sem dependências externas.
 */

/** Arredonda para 3 casas (precisão de milissegundo). */
function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

/** Limita um número entre mínimo e máximo. */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

/**
 * Converte segundos em timecode "HH:MM:SS.mmm".
 * @param {number} seconds
 * @param {number} [decimals=3]
 * @returns {string}
 */
function toTimecode(seconds, decimals = 3) {
  const total = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  const frac = round3(total - Math.floor(total));
  const fracText = frac.toFixed(decimals).slice(2 - (decimals === 0 ? 1 : 0));
  const base = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  if (decimals === 0) return base;
  return `${base}.${fracText}`;
}

/**
 * Converte segundos em "MM:SS" curto (para a interface).
 * @param {number} seconds
 * @returns {string}
 */
function toShortTime(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * Interpreta "HH:MM:SS,mmm" (SRT), "HH:MM:SS.mmm" (VTT) ou número de segundos.
 * @param {string|number} value
 * @returns {number} segundos
 */
function parseTime(value) {
  if (typeof value === 'number') return round3(value);
  const text = String(value || '').trim().replace(',', '.');
  if (!text) return 0;
  if (!text.includes(':')) return round3(parseFloat(text) || 0);
  const parts = text.split(':').map((part) => parseFloat(part) || 0);
  while (parts.length < 3) parts.unshift(0);
  const [hours, minutes, seconds] = parts.slice(-3);
  return round3(hours * 3600 + minutes * 60 + seconds);
}

/**
 * Analisa um arquivo SRT.
 * @param {string} content
 * @returns {{index:number,start:number,end:number,text:string}[]}
 */
function parseSrt(content) {
  const cues = [];
  const blocks = String(content || '')
    .replace(/\r\n/g, '\n')
    .replace(/^\uFEFF/, '')
    .split(/\n{2,}/);

  for (const rawBlock of blocks) {
    const block = rawBlock.trim();
    if (!block) continue;
    const lines = block.split('\n').map((line) => line.trim());
    let timeLineIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeLineIndex === -1) continue;

    const [startText, endText] = lines[timeLineIndex].split('-->').map((part) => part.trim());
    const start = parseTime(startText);
    const end = parseTime((endText || '').split(' ')[0]);
    const text = lines
      .slice(timeLineIndex + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (!text || end <= start) continue;

    cues.push({
      index: cues.length + 1,
      start: round3(start),
      end: round3(end),
      text
    });
  }
  return cues;
}

/**
 * Analisa um arquivo WebVTT.
 * @param {string} content
 */
function parseVtt(content) {
  const text = String(content || '')
    .replace(/\r\n/g, '\n')
    .replace(/^WEBVTT[^\n]*\n/, '')
    .replace(/NOTE[\s\S]*?\n\n/g, '\n');
  return parseSrt(text);
}

/**
 * Analisa a saída JSON do whisper.cpp (`whisper-cli -oj`).
 * @param {any} json
 * @returns {{index:number,start:number,end:number,text:string,words?:{start:number,end:number,text:string}[]}[]}
 */
function parseWhisperJson(json) {
  const result = typeof json === 'string' ? JSON.parse(json) : json;
  const entries = Array.isArray(result?.transcription)
    ? result.transcription
    : Array.isArray(result?.segments)
      ? result.segments
      : [];

  return entries
    .map((entry, position) => {
      const start = round3(entry.offsets?.from != null ? entry.offsets.from / 1000 : (entry.start ?? 0));
      const end = round3(entry.offsets?.to != null ? entry.offsets.to / 1000 : (entry.end ?? 0));
      const text = String(entry.text ?? '').replace(/\s+/g, ' ').trim();
      const words = Array.isArray(entry.tokens)
        ? entry.tokens
            .filter((token) => token.timestamps?.from != null && token.timestamps?.to != null)
            .map((token) => ({
              start: round3(token.timestamps.from / 1000),
              end: round3(token.timestamps.to / 1000),
              text: String(token.text ?? '').trim()
            }))
            .filter((word) => word.text && word.end > word.start)
        : undefined;
      return { index: position + 1, start, end, text, words };
    })
    .filter((cue) => cue.text && cue.end > cue.start);
}

/** Serializa legendas em SRT. */
function toSrt(cues) {
  return (cues || [])
    .map((cue, position) => `${position + 1}\n${toTimecode(cue.start)} --> ${toTimecode(cue.end)}\n${cue.text}\n`)
    .join('\n');
}

/**
 * Quebra o texto em linhas respeitando um limite de caracteres, sem cortar palavras.
 * @param {string} text
 * @param {number} maxCharsPerLine
 * @returns {string[]}
 */
function wrapText(text, maxCharsPerLine = 24) {
  const words = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const limit = Math.max(6, Math.round(maxCharsPerLine));
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= limit) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // Palavra maior que o limite: quebra na marra para não estourar a tela.
      if (word.length > limit) {
        for (let i = 0; i < word.length; i += limit) lines.push(word.slice(i, i + limit));
        current = '';
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Re-quebra uma lista de legendas para caber no limite de caracteres,
 * dividindo legendas longas em duas (ajustando os tempos proporcionalmente).
 * @param {{start:number,end:number,text:string}[]} cues
 * @param {number} maxCharsPerLine
 * @param {number} [maxLines=2]
 */
function reflowCues(cues, maxCharsPerLine = 24, maxLines = 2) {
  const output = [];
  for (const cue of cues || []) {
    const lines = wrapText(cue.text, maxCharsPerLine);
    if (lines.length <= maxLines) {
      output.push({ ...cue, text: lines.join('\n') });
      continue;
    }
    // Divide em blocos de no máximo maxLines linhas, distribuindo o tempo por caracteres.
    const chunks = [];
    for (let i = 0; i < lines.length; i += maxLines) chunks.push(lines.slice(i, i + maxLines));
    const totalChars = chunks.reduce((sum, chunk) => sum + chunk.join(' ').length, 0) || 1;
    const duration = Math.max(0.2, cue.end - cue.start);
    let cursor = cue.start;
    chunks.forEach((chunk, chunkIndex) => {
      const share = (chunk.join(' ').length / totalChars) * duration;
      const start = round3(cursor);
      const end = chunkIndex === chunks.length - 1 ? round3(cue.end) : round3(cursor + share);
      output.push({ index: output.length + 1, start, end, text: chunk.join('\n') });
      cursor = cursor + share;
    });
  }
  return output.map((cue, position) => ({ ...cue, index: position + 1 }));
}

/** Remove sobreposição de tempos entre legendas consecutivas. */
function dedupeCueTimings(cues, minGap = 0.02) {
  const sorted = [...(cues || [])].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (previous.end > current.start) previous.end = round3(Math.max(previous.start + 0.1, current.start - minGap));
  }
  return sorted.map((cue, position) => ({ ...cue, index: position + 1 }));
}

/** Nome de arquivo seguro (remove caracteres proibidos no Windows). */
function sanitizeFilename(name, fallback = 'corte') {
  const cleaned = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

module.exports = {
  round3,
  clamp,
  toTimecode,
  toShortTime,
  parseTime,
  parseSrt,
  parseVtt,
  parseWhisperJson,
  toSrt,
  wrapText,
  reflowCues,
  dedupeCueTimings,
  sanitizeFilename
};
