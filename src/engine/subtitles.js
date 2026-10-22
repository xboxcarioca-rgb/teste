/**
 * Geração de legendas em ASS (Advanced SubStation Alpha).
 *
 * Por que ASS e não SRT queimado?
 *  - Controle total de fonte, contorno, sombra, caixa e cores;
 *  - Animações (karaoke palavra a palavra, pop, typewriter);
 *  - Escala automática via PlayResX/PlayResY (mesmo template serve para
 *    9:16, 1:1, 4:5 e 16:9);
 *  - Renderizado pelo libass dentro do FFmpeg (presente no binário embutido).
 */

const { wrapText, reflowCues, dedupeCueTimings, round3, clamp } = require('../common/time');
const { toAssColor } = require('./escaping');

/** Converte segundos em tempo ASS: "H:MM:SS.CC" (centésimos). */
function assTime(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  const centis = Math.round((total - Math.floor(total)) * 100);
  const carry = centis === 100 ? 1 : 0;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs + carry).padStart(2, '0')}.${String(carry === 1 ? 0 : centis).padStart(2, '0')}`;
}

/** Alinhamento "bottom-center" -> número do numpad usado pelo ASS. */
function assAlignment(align) {
  const map = {
    'bottom-left': 1,
    'bottom-center': 2,
    'bottom-right': 3,
    'middle-left': 4,
    center: 5,
    'middle-center': 5,
    'middle-right': 6,
    'top-left': 7,
    'top-center': 8,
    'top-right': 9
  };
  return map[String(align || 'bottom-center')] || 2;
}

/** Escapa caracteres especiais do texto ASS. */
function escapeAssText(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\{/g, '(')
    .replace(/\}/g, ')')
    .replace(/\\/g, '/');
}

/**
 * Seleciona apenas as legendas que caem dentro de um trecho e desloca os
 * tempos para o início do clipe (tempo "local"), evitando qualquer dessincronia.
 *
 * @param {{start:number,end:number,text:string,words?:any[]}[]} cues
 * @param {number} clipStart
 * @param {number} clipEnd
 * @param {{edgeTrimRatio?:number}} [options]
 */
function cuesForClip(cues, clipStart, clipEnd, options = {}) {
  const edgeTrim = options.edgeTrimRatio ?? 0.02;
  const duration = Math.max(0.1, clipEnd - clipStart);
  const output = [];

  for (const cue of cues || []) {
    if (cue.end <= clipStart || cue.start >= clipEnd) continue;
    const start = clamp(cue.start - clipStart, 0, duration);
    const end = clamp(cue.end - clipStart, 0, duration);
    if (end - start < 0.08) continue;

    // Encurta legendas que atravessam a borda do corte (evita "sobra" visual).
    const touchedStart = cue.start < clipStart;
    const touchedEnd = cue.end > clipEnd;
    const trimmedStart = touchedStart ? Math.min(start + duration * edgeTrim, end - 0.1) : start;
    const trimmedEnd = touchedEnd ? Math.max(end - duration * edgeTrim, trimmedStart + 0.1) : end;

    const words = Array.isArray(cue.words)
      ? cue.words
          .map((word) => ({ ...word, start: word.start - clipStart, end: word.end - clipStart }))
          .filter((word) => word.end > 0 && word.start < duration)
      : undefined;

    output.push({
      start: round3(Math.max(0, trimmedStart)),
      end: round3(Math.min(duration, trimmedEnd)),
      text: cue.text,
      words
    });
  }

  return dedupeCueTimings(output);
}

/** Aplica caixa alta, quebra de linha e limites de duração. */
function normalizeCues(cues, style = {}, limits = {}) {
  let result = (cues || []).map((cue) => ({
    ...cue,
    text: String(cue.text ?? '').replace(/\s+/g, ' ').trim()
  }));

  result = result.filter((cue) => cue.text);

  if (style.uppercase) result = result.map((cue) => ({ ...cue, text: cue.text.toUpperCase() }));

  const maxChars = Number(style.maxCharsPerLine) || 22;
  const maxLines = Number(style.maxLines) || 2;
  result = reflowCues(result, maxChars, maxLines);

  const minDuration = Number(limits.minCueDuration ?? 0.6);
  const maxDuration = Number(limits.maxCueDuration ?? 4.5);
  result = result.map((cue) => {
    const duration = cue.end - cue.start;
    if (duration < minDuration) return { ...cue, end: round3(cue.start + minDuration) };
    if (duration > maxDuration) {
      // Divide legendas longas demais em blocos proporcionais ao texto.
      const lines = cue.text.split('\n');
      if (lines.length > 1) {
        const total = lines.join(' ').length || 1;
        const pieces = [];
        let cursor = cue.start;
        lines.forEach((line, index) => {
          const share = ((line.length || 1) / total) * duration;
          pieces.push({
            start: round3(cursor),
            end: round3(index === lines.length - 1 ? cue.end : cursor + share),
            text: line,
            words: cue.words
          });
          cursor += share;
        });
        return pieces;
      }
      return { ...cue, end: round3(cue.start + maxDuration) };
    }
    return cue;
  });

  result = result.flat();
  return dedupeCueTimings(result);
}

/**
 * Distribui o tempo de uma legenda entre as palavras (usando timestamps reais
 * quando existem, senão proporcional ao número de caracteres).
 * @returns {{text:string,startMs:number,endMs:number}[]}
 */
function wordTimings(cue) {
  const text = String(cue.text || '');
  if (Array.isArray(cue.words) && cue.words.length) {
    const words = cue.words.map((word) => ({
      text: String(word.text || '').trim(),
      start: word.start,
      end: word.end
    }));
    // Se a transcrição trouxe palavras em ordem diferente do texto exibido,
    // mantemos os tempos e apenas substituímos o texto pela versão formatada.
    const displayTokens = text.split(/\s+/).filter(Boolean);
    if (displayTokens.length === words.length) {
      return words.map((word, index) => ({
        text: displayTokens[index],
        startMs: Math.max(0, Math.round(word.start * 1000)),
        endMs: Math.max(0, Math.round(word.end * 1000))
      }));
    }
    return words
      .filter((word) => word.text)
      .map((word) => ({
        text: word.text,
        startMs: Math.max(0, Math.round(word.start * 1000)),
        endMs: Math.max(0, Math.round(word.end * 1000))
      }));
  }

  const tokens = text.split(/(\s+)/).filter((token) => token.length);
  const durationMs = Math.max(1, Math.round((cue.end - cue.start) * 1000));
  const weight = tokens.reduce((sum, token) => sum + (token.trim() ? token.length : 1), 0) || 1;
  let cursor = 0;
  return tokens.map((token) => {
    const share = Math.round(((token.trim() ? token.length : 1) / weight) * durationMs);
    const item = { text: token, startMs: cursor, endMs: cursor + share };
    cursor += share;
    return item;
  });
}

/** Monta o texto ASS com a animação pedida. */
function renderCueText(cue, style, animation) {
  const text = escapeAssText(cue.text);
  const overrides = [];

  if (animation === 'pop') {
    overrides.push('\\fscx82\\fscy82\\t(0,140,\\fscx100\\fscy100)');
    overrides.push('\\fad(60,90)');
  } else if (animation === 'fade') {
    overrides.push('\\fad(110,110)');
  } else if (animation !== 'karaoke' && animation !== 'typewriter') {
    overrides.push('\\fad(40,40)');
  }

  if (animation === 'karaoke') {
    const tokens = wordTimings(cue).filter((token) => token.text.trim());
    const parts = tokens.map((token) => {
      const centis = Math.max(1, Math.round((token.endMs - token.startMs) / 10));
      return `{\\kf${centis}}${escapeAssText(token.text)}${token.text.endsWith(' ') ? '' : ' '}`;
    });
    return `${overrides.length ? `{${overrides.join('')}}` : ''}${parts.join('').trimEnd()}`;
  }

  if (animation === 'typewriter') {
    const tokens = wordTimings(cue).filter((token) => token.text.trim());
    const parts = tokens.map((token) => {
      const from = clamp(token.startMs, 0, 600000);
      const to = from + 70;
      return `{\\alpha&HFF&\\t(${from},${to},\\alpha&H00&)}${escapeAssText(token.text)} `;
    });
    return parts.join('').trimEnd();
  }

  return `${overrides.length ? `{${overrides.join('')}}` : ''}${text.replace(/\n/g, '\\N')}`;
}

/**
 * Gera o arquivo ASS completo.
 *
 * @param {object} params
 * @param {{start:number,end:number,text:string,words?:any[]}[]} params.cues
 * @param {object} params.style estilo de legenda (DEFAULT_SUBTITLE_STYLE)
 * @param {{width:number,height:number}} params.target resolução de saída
 * @param {{title?:string}} [params.meta]
 * @returns {string} conteúdo do .ass
 */
function buildAss({ cues, style = {}, target = { width: 1080, height: 1920 }, meta = {} }) {
  const playResX = Math.max(2, Math.round(target.width));
  const playResY = Math.max(2, Math.round(target.height));
  const scale = playResY;

  const fontSize = Math.max(12, Math.round((Number(style.sizeRatio) || 0.06) * scale));
  const outline = Math.max(0, Math.round((Number(style.outlineRatio) || 0) * scale * 10) / 10);
  const shadow = Math.max(0, Math.round((Number(style.shadowRatio) || 0) * scale * 10) / 10);
  const marginV = Math.max(0, Math.round((Number(style.marginRatio) || 0) * scale));
  const marginLR = Math.max(0, Math.round(playResX * 0.06));
  const lineSpacing = Math.max(0, Math.round((Number(style.interlineRatio) || 0) * scale));
  const alignment = assAlignment(style.align);
  const animation = String(style.animation || 'none');
  const usesKaraoke = animation === 'karaoke';

  // No karaoke, o ASS desenha SecondaryColour ANTES de destacar e PrimaryColour DEPOIS.
  const primary = toAssColor(usesKaraoke ? style.activeWordColor || '#FFE14D' : style.color || '#FFFFFF');
  const secondary = toAssColor(style.color || '#FFFFFF');
  const outlineColour = toAssColor(style.outlineColor || '#000000');
  const backColour = style.box
    ? toAssColor(style.boxColor || '#000000', Number(style.boxOpacity ?? 0.55))
    : toAssColor(style.shadowColor || '#000000', Number(style.shadowOpacity ?? 0.6));

  const fontName = String(style.font || 'Montserrat').split(',')[0].trim();
  const bold = style.bold ? -1 : 0;
  const italic = style.italic ? -1 : 0;
  const borderStyle = style.box ? 3 : 1; // 3 = caixa opaca atrás do texto

  const lines = [];
  lines.push('[Script Info]');
  lines.push('; Gerado por Viral Cut Studio');
  if (meta.title) lines.push(`Title: ${String(meta.title).replace(/[\r\n]/g, ' ')}`);
  lines.push('ScriptType: v4.00+');
  lines.push(`PlayResX: ${playResX}`);
  lines.push(`PlayResY: ${playResY}`);
  lines.push('WrapStyle: 0');
  lines.push('ScaledBorderAndShadow: yes');
  lines.push('YCbCr Matrix: TV.709');
  lines.push('');
  lines.push('[V4+ Styles]');
  lines.push(
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding'
  );
  lines.push(
    [
      'Style: Default',
      fontName,
      fontSize,
      primary,
      secondary,
      outlineColour,
      backColour,
      bold,
      italic,
      0,
      0,
      100,
      100,
      0,
      0,
      borderStyle,
      outline,
      borderStyle === 3 ? 0 : shadow,
      alignment,
      marginLR,
      marginLR,
      marginV,
      1
    ].join(',')
  );
  lines.push('');
  lines.push('[Events]');
  lines.push('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text');

  for (const cue of cues || []) {
    if (!cue.text) continue;
    const text = renderCueText(cue, style, animation);
    lines.push(
      `Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},Default,,0,0,0,,${text}`
    );
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Pipeline completo: normaliza, recorta para o clipe e gera o ASS.
 * @returns {{ass:string,cues:any[]}}
 */
function buildAssForClip({ cues, clipStart, clipEnd, style, target, limits = {}, meta = {} }) {
  const normalized = normalizeCues(cues, style, limits);
  const local = cuesForClip(normalized, clipStart, clipEnd);
  const wrapped = local.map((cue) => ({ ...cue, text: wrapText(cue.text, style.maxCharsPerLine || 22).join('\n') }));
  return { ass: buildAss({ cues: wrapped, style, target, meta }), cues: wrapped };
}

module.exports = {
  assTime,
  assAlignment,
  escapeAssText,
  cuesForClip,
  normalizeCues,
  wordTimings,
  renderCueText,
  buildAss,
  buildAssForClip
};
