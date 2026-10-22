/**
 * Testes de escapamento e conversão de cores.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  escapeFilterPath,
  escapeFilterValue,
  escapeDrawtext,
  toFfmpegColor,
  toAssColor,
  hexToRgb,
  anchorToRatio
} = require('../../src/engine/escaping');

test('escapeFilterPath converte barras do Windows e protege os dois-pontos', () => {
  assert.equal(escapeFilterPath('C:\\Users\\João\\projeto\\legenda.ass'), 'C\\:/Users/João/projeto/legenda.ass');
  assert.equal(escapeFilterPath('/tmp/vcs/legenda.ass'), '/tmp/vcs/legenda.ass');
  assert.equal(escapeFilterPath('C:\\a b\\c.ass'), 'C\\:/a b/c.ass');
});

test('escapeFilterPath protege aspas simples', () => {
  assert.equal(escapeFilterPath("/tmp/it's/file.ass"), "/tmp/it\\'s/file.ass");
});

test('escapeFilterValue protege separadores do filtergraph', () => {
  const result = escapeFilterValue("a:b,c;d[e]f'g\\h");
  assert.ok(result.includes('\\:'));
  assert.ok(result.includes('\\,'));
  assert.ok(result.includes('\\;'));
  assert.ok(result.includes('\\['));
  assert.ok(result.includes('\\]'));
  // Uma barra invertida na entrada vira duas (exigência do parser do filtergraph).
  assert.equal(escapeFilterValue('\\\\'), '\\\\\\\\');
  assert.ok(result.includes('\\\\h'), 'barra invertida dobrada antes do h');
});

test('escapeDrawtext protege % (expansão de variáveis do drawtext)', () => {
  assert.equal(escapeDrawtext('100% viral'), '100\\% viral');
  // Chaves não precisam de escape no drawtext; só o % que dispara expansão.
  assert.equal(escapeDrawtext('%{n}'), '\\%{n}');
  assert.equal(escapeDrawtext("a:b'c\\d"), 'a\\:b\\\'c\\\\d');
});

test('toFfmpegColor converte hex em 0xRRGGBB com alpha opcional', () => {
  assert.equal(toFfmpegColor('#FFFFFF'), '0xffffff');
  assert.equal(toFfmpegColor('#ff2d55'), '0xff2d55');
  assert.equal(toFfmpegColor('#000'), '0x000000');
  assert.equal(toFfmpegColor('#000000', 0.5), '0x000000@0.500');
  assert.equal(toFfmpegColor('#000000', 1), '0x000000');
});

test('toFfmpegColor ignora alpha quase opaco para não gerar ruído', () => {
  assert.equal(toFfmpegColor('#123456', 0.9999), '0x123456');
});

test('toAssColor usa o formato &HAABBGGRR (ordem invertida)', () => {
  // Vermelho puro e opaco -> alpha 00, B=00, G=00, R=FF.
  assert.equal(toAssColor('#FF0000'), '&H000000FF');
  assert.equal(toAssColor('#FFFFFF'), '&H00FFFFFF');
  assert.equal(toAssColor('#000000', 0.5), '&H80000000');
  // Totalmente transparente => alpha FF.
  assert.equal(toAssColor('#123456', 0), '&HFF563412');
});

test('hexToRgb lida com 3 e 6 dígitos', () => {
  assert.deepEqual(hexToRgb('#fff'), { r: 255, g: 255, b: 255, a: 255 });
  assert.deepEqual(hexToRgb('#0a0b0c'), { r: 10, g: 11, b: 12, a: 255 });
});

test('anchorToRatio mapeia as 9 âncoras', () => {
  assert.deepEqual(anchorToRatio('top-left'), { x: 0, y: 0 });
  assert.deepEqual(anchorToRatio('top-right'), { x: 1, y: 0 });
  assert.deepEqual(anchorToRatio('center'), { x: 0.5, y: 0.5 });
  assert.deepEqual(anchorToRatio('bottom-center'), { x: 0.5, y: 1 });
  assert.deepEqual(anchorToRatio('middle-left'), { x: 0, y: 0.5 });
});

test('anchorToRatio tem fallback seguro para valor inválido', () => {
  assert.deepEqual(anchorToRatio('nonsense'), { x: 0.5, y: 0.5 });
  assert.deepEqual(anchorToRatio(undefined), { x: 0.5, y: 0.5 });
});
