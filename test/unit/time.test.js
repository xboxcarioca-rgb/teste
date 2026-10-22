/**
 * Testes do módulo de tempo/legendas (SRT, VTT, quebra de linha).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const time = require('../../src/common/time');

test('toTimecode formata com milissegundos', () => {
  assert.equal(time.toTimecode(0), '00:00:00.000');
  assert.equal(time.toTimecode(1.234), '00:00:01.234');
  assert.equal(time.toTimecode(61.5), '00:01:01.500');
  assert.equal(time.toTimecode(3661.001), '01:01:01.001');
  assert.equal(time.toTimecode(-5), '00:00:00.000');
});

test('parseTime aceita SRT (vírgula), VTT (ponto) e segundos', () => {
  assert.equal(time.parseTime('00:00:01,500'), 1.5);
  assert.equal(time.parseTime('00:00:01.500'), 1.5);
  assert.equal(time.parseTime('01:02:03.400'), 3723.4);
  assert.equal(time.parseTime('12.75'), 12.75);
  assert.equal(time.parseTime(9.25), 9.25);
  assert.equal(time.parseTime(''), 0);
});

test('parseSrt lê blocos, ignora inválidos e remove tags HTML', () => {
  const srt = `1
00:00:01,000 --> 00:00:03,500
Primeira linha
segunda linha

2
00:00:04,000 --> 00:00:05,000
<i>com tag</i>

3
00:00:09,000 --> 00:00:08,000
fim antes do início (inválido)

4
00:00:10,000 --> 00:00:12,000
`;
  const cues = time.parseSrt(srt);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, 'Primeira linha\nsegunda linha');
  assert.equal(cues[0].start, 1);
  assert.equal(cues[0].end, 3.5);
  assert.equal(cues[1].text, 'com tag');
  assert.equal(cues[1].index, 2);
});

test('parseSrt aceita CRLF e BOM', () => {
  const srt = '\uFEFF1\r\n00:00:00,500 --> 00:00:02,000\r\nOlá\r\n';
  const cues = time.parseSrt(srt);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].text, 'Olá');
});

test('parseVtt remove cabeçalho WEBVTT e NOTE', () => {
  const vtt = `WEBVTT

NOTE isto é um comentário

00:00:01.000 --> 00:00:02.000
linha um

00:00:03.000 --> 00:00:04.000
linha dois
`;
  const cues = time.parseVtt(vtt);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, 'linha um');
});

test('parseWhisperJson entende offsets (ms) e segments (s)', () => {
  const fromOffsets = { transcription: [{ offsets: { from: 1000, to: 2500 }, text: '  olá   mundo ' }] };
  const cues = time.parseWhisperJson(fromOffsets);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].start, 1);
  assert.equal(cues[0].end, 2.5);
  assert.equal(cues[0].text, 'olá mundo');

  const fromSegments = { segments: [{ start: 0.5, end: 1.25, text: 'teste' }] };
  assert.equal(time.parseWhisperJson(fromSegments)[0].end, 1.25);
});

test('toSrt gera arquivo válido de ida e volta', () => {
  const cues = [
    { start: 0, end: 1.5, text: 'um' },
    { start: 1.5, end: 3, text: 'dois' }
  ];
  const srt = time.toSrt(cues);
  assert.match(srt, /1\n00:00:00\.000 --> 00:00:01\.500\num/);
  assert.equal(time.parseSrt(srt.replace(/\./g, ',')).length, 2);
});

test('wrapText respeita o limite sem cortar palavras', () => {
  assert.deepEqual(time.wrapText('palavra curta', 20), ['palavra curta']);
  assert.deepEqual(time.wrapText('uma frase bem longa aqui', 12), ['uma frase', 'bem longa', 'aqui']);
});

test('wrapText quebra palavra maior que o limite', () => {
  const lines = time.wrapText('supercalifragilistico', 8);
  assert.ok(lines.every((line) => line.length <= 8));
  assert.equal(lines.join(''), 'supercalifragilistico');
});

test('reflowCues divide legenda longa em duas com tempos proporcionais', () => {
  const cues = [{ start: 10, end: 14, text: 'primeira parte da fala segunda parte da fala' }];
  const result = time.reflowCues(cues, 14, 1);
  assert.ok(result.length >= 2);
  assert.ok(result[result.length - 1].end <= 14.001);
  assert.ok(result[0].start >= 9.999);
  // Tempos contíguos e crescentes.
  for (let index = 1; index < result.length; index += 1) {
    assert.ok(result[index].start >= result[index - 1].start);
  }
});

test('dedupeCueTimings elimina sobreposição', () => {
  const cues = [
    { start: 0, end: 5, text: 'a' },
    { start: 3, end: 6, text: 'b' }
  ];
  const result = time.dedupeCueTimings(cues);
  assert.ok(result[0].end <= result[1].start);
  assert.equal(result.length, 2);
});

test('sanitizeFilename remove caracteres proibidos no Windows', () => {
  assert.equal(time.sanitizeFilename('a/b:c*d?e"f<g>h|i'), 'abcdefghi');
  assert.equal(time.sanitizeFilename(''), 'corte');
  // Acentos são removidos de propósito: evita problema de encoding em
  // caminhos no Windows (yt-dlp/ffmpeg com pastas do usuário).
  assert.equal(time.sanitizeFilename('Café Vídeo!'), 'Cafe Video!');
  assert.equal(time.sanitizeFilename('  espaços   múltiplos '), 'espacos multiplos');
});

test('toShortTime mostra horas só quando necessário', () => {
  assert.equal(time.toShortTime(65), '1:05');
  assert.equal(time.toShortTime(3725), '1:02:05');
  assert.equal(time.toShortTime(0), '0:00');
});
