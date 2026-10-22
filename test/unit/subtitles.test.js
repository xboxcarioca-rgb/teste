/**
 * Testes da geração de ASS (legendas queimadas).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assTime,
  assAlignment,
  escapeAssText,
  cuesForClip,
  normalizeCues,
  wordTimings,
  buildAss,
  buildAssForClip
} = require('../../src/engine/subtitles');
const { DEFAULT_SUBTITLE_STYLE } = require('../../src/common/defaults');

test('assTime usa centésimos e não estoura 100', () => {
  assert.equal(assTime(0), '0:00:00.00');
  assert.equal(assTime(1.234), '0:00:01.23');
  assert.equal(assTime(61.999), '0:01:02.00');
  assert.equal(assTime(3661.5), '1:01:01.50');
  assert.equal(assTime(-3), '0:00:00.00');
});

test('assAlignment mapeia nomes para o numpad do ASS', () => {
  assert.equal(assAlignment('bottom-center'), 2);
  assert.equal(assAlignment('center'), 5);
  assert.equal(assAlignment('top-center'), 8);
  assert.equal(assAlignment('top-left'), 7);
  assert.equal(assAlignment('desconhecido'), 2);
});

test('escapeAssText neutraliza chaves de override e quebras de linha', () => {
  // Chaves viram parênteses (senão o usuário injetaria overrides) e \ vira /.
  assert.equal(escapeAssText('{\\pos(1,2)}'), '(/pos(1,2))');
  assert.equal(escapeAssText('a\r\nb\nc'), 'a\nb\nc');
  assert.equal(escapeAssText('a\rb'), 'a\nb'); // \r solitário também normaliza
});

test('cuesForClip desloca os tempos para o início do clipe', () => {
  const cues = [
    { start: 10, end: 12, text: 'antes' },
    { start: 30, end: 32, text: 'dentro' },
    { start: 60, end: 62, text: 'depois' }
  ];
  const result = cuesForClip(cues, 25, 45);
  assert.equal(result.length, 1);
  assert.equal(result[0].text, 'dentro');
  assert.equal(result[0].start, 5);
  assert.equal(result[0].end, 7);
});

test('cuesForClip encurta legenda que atravessa a borda do corte', () => {
  const cues = [{ start: 24, end: 28, text: 'cruzando o início' }];
  const result = cuesForClip(cues, 25, 45);
  assert.equal(result.length, 1);
  // Começa depois de 0 (evita legenda "pendurada" da fala anterior).
  assert.ok(result[0].start > 0);
  assert.ok(result[0].end <= 20);
});

test('cuesForClip descarta trechos curtos demais', () => {
  const cues = [{ start: 24.95, end: 25.0, text: 'migalha' }];
  assert.equal(cuesForClip(cues, 25, 45).length, 0);
});

test('normalizeCues aplica caixa alta, requebra e respeita duração máxima', () => {
  const cues = [{ start: 0, end: 8, text: 'um texto bem longo que precisa ser dividido em partes menores' }];
  const result = normalizeCues(cues, { ...DEFAULT_SUBTITLE_STYLE, uppercase: true, maxCharsPerLine: 16, maxLines: 1 }, { maxCueDuration: 4 });
  assert.ok(result.length >= 2);
  assert.ok(result.every((cue) => cue.text === cue.text.toUpperCase()));
  assert.ok(result.every((cue) => cue.end - cue.start <= 4.5));
});

test('normalizeCues estica legenda curta demais', () => {
  const result = normalizeCues([{ start: 0, end: 0.1, text: 'oi' }], DEFAULT_SUBTITLE_STYLE, { minCueDuration: 0.6 });
  assert.ok(result[0].end - result[0].start >= 0.59);
});

test('wordTimings usa timestamps reais quando existem', () => {
  const cue = {
    start: 0,
    end: 2,
    text: 'dois palavras',
    words: [
      { start: 0.1, end: 0.9, text: 'dois' },
      { start: 0.9, end: 1.8, text: 'palavras' }
    ]
  };
  const tokens = wordTimings(cue);
  assert.equal(tokens.length, 2);
  assert.equal(tokens[0].startMs, 100);
  assert.equal(tokens[1].endMs, 1800);
});

test('wordTimings distribui proporcionalmente sem timestamps', () => {
  const tokens = wordTimings({ start: 0, end: 3, text: 'ab cdefgh' });
  const words = tokens.filter((token) => token.text.trim());
  assert.equal(words.length, 2);
  // A palavra mais longa recebe mais tempo.
  assert.ok(words[1].endMs - words[1].startMs > words[0].endMs - words[0].startMs);
  assert.equal(tokens[tokens.length - 1].endMs, 3000);
});

test('buildAss gera cabeçalho com PlayRes do alvo e estilo Default', () => {
  const ass = buildAss({
    cues: [{ start: 0, end: 2, text: 'olá' }],
    style: DEFAULT_SUBTITLE_STYLE,
    target: { width: 1080, height: 1920 }
  });
  assert.match(ass, /\[Script Info\]/);
  assert.match(ass, /ScriptType: v4\.00\+/);
  assert.match(ass, /PlayResX: 1080/);
  assert.match(ass, /PlayResY: 1920/);
  assert.match(ass, /ScaledBorderAndShadow: yes/);
  assert.match(ass, /\[V4\+ Styles\]/);
  assert.match(ass, /Style: Default,/);
  assert.match(ass, /\[Events\]/);
  assert.match(ass, /Dialogue: 0,0:00:00\.00,0:00:02\.00,Default,/);
});

test('buildAss escala a fonte proporcionalmente à altura do quadro', () => {
  const style = { ...DEFAULT_SUBTITLE_STYLE, sizeRatio: 0.06 };
  const small = buildAss({ cues: [], style, target: { width: 540, height: 960 } });
  const large = buildAss({ cues: [], style, target: { width: 1080, height: 1920 } });
  const fontSizeOf = (ass) => Number(/Style: Default,[^,]+,(\d+),/.exec(ass)[1]);
  assert.equal(fontSizeOf(small), Math.round(0.06 * 960));
  assert.equal(fontSizeOf(large), Math.round(0.06 * 1920));
  // Proporção preservada (com tolerância de arredondamento).
  assert.ok(Math.abs(fontSizeOf(large) / fontSizeOf(small) - 2) < 0.05);
});

test('buildAss no modo karaoke inverte primária/secundária e usa \\kf', () => {
  const ass = buildAss({
    cues: [{ start: 0, end: 2, text: 'uma duas', words: [{ start: 0, end: 1, text: 'uma' }, { start: 1, end: 2, text: 'duas' }] }],
    style: { ...DEFAULT_SUBTITLE_STYLE, animation: 'karaoke', color: '#FFFFFF', activeWordColor: '#FFE14D' },
    target: { width: 1080, height: 1920 }
  });
  // PrimaryColour = cor da palavra destacada; SecondaryColour = cor antes do destaque.
  assert.match(ass, /Style: Default,[^,]+,\d+,&H004DE1FF,&H00FFFFFF,/);
  assert.match(ass, /\{\\kf\d+\}/);
});

test('buildAss usa caixa (BorderStyle 3) quando box está ativo', () => {
  const withBox = buildAss({ cues: [], style: { ...DEFAULT_SUBTITLE_STYLE, box: true }, target: { width: 1080, height: 1920 } });
  const withoutBox = buildAss({ cues: [], style: { ...DEFAULT_SUBTITLE_STYLE, box: false }, target: { width: 1080, height: 1920 } });
  // BorderStyle é o 16º campo da linha Style (14 campos depois de "Default,").
  const borderStyleOf = (ass) => Number(/Style: Default,(?:[^,]*,){14}(\d+),/.exec(ass)[1]);
  assert.equal(borderStyleOf(withBox), 3);
  assert.equal(borderStyleOf(withoutBox), 1);
});

test('buildAss aplica animação pop com transform de escala', () => {
  const ass = buildAss({
    cues: [{ start: 0, end: 2, text: 'pop' }],
    style: { ...DEFAULT_SUBTITLE_STYLE, animation: 'pop' },
    target: { width: 1080, height: 1920 }
  });
  assert.match(ass, /\\fscx82\\fscy82\\t\(0,140,\\fscx100\\fscy100\)/);
});

test('buildAss typewriter revela palavra a palavra com alpha animado', () => {
  const ass = buildAss({
    cues: [{ start: 0, end: 2, text: 'um dois' }],
    style: { ...DEFAULT_SUBTITLE_STYLE, animation: 'typewriter' },
    target: { width: 1080, height: 1920 }
  });
  assert.match(ass, /\\alpha&HFF&\\t\(\d+,\d+,\\alpha&H00&\)/);
});

test('buildAssForClip encadeia normalização + recorte + ASS', () => {
  const cues = [
    { start: 0, end: 2, text: 'fora do clipe' },
    { start: 30, end: 33, text: 'dentro do clipe' }
  ];
  const result = buildAssForClip({
    cues,
    clipStart: 25,
    clipEnd: 45,
    style: DEFAULT_SUBTITLE_STYLE,
    target: { width: 1080, height: 1920 }
  });
  assert.equal(result.cues.length, 1);
  assert.equal(result.cues[0].text, 'DENTRO DO CLIPE'); // uppercase vem do padrão
  assert.ok(result.cues[0].start < 8);
  assert.match(result.ass, /Dialogue: 0,0:00:0[45]/);
});
