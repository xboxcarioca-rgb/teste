/**
 * Testes de geometria (cover, contain, split) e formatos.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { coverRect, containRect, splitGeometry, computeGeometry } = require('../../src/engine/geometry');
const { even, evenDimension, resolveDimensions, aspectRatioLabel, getFormat, getLayout, FORMATS, LAYOUTS } = require('../../src/common/formats');

test('even arredonda para par preservando o zero', () => {
  assert.equal(even(1080), 1080);
  assert.equal(even(1081), 1082);
  assert.equal(even(1), 2);
  assert.equal(even(0), 0, 'zero precisa continuar zero (offsets e gaps podem ser 0)');
  assert.equal(even(-3), -4);
  assert.equal(even(NaN), 0);
});

test('evenDimension garante o mínimo de 2 pixels para largura/altura', () => {
  assert.equal(evenDimension(1081), 1082);
  assert.equal(evenDimension(1), 2);
  assert.equal(evenDimension(0), 2);
  assert.equal(evenDimension(5, 4), 6);
});

test('resolveDimensions devolve o tamanho de cada formato', () => {
  assert.deepEqual(
    { ...resolveDimensions({ formatId: 'vertical' }) },
    { width: 1080, height: 1920, ratio: '9:16', label: 'Vertical 9:16' }
  );
  assert.equal(resolveDimensions({ formatId: 'square' }).width, 1080);
  assert.equal(resolveDimensions({ formatId: 'portrait' }).height, 1350);
  assert.equal(resolveDimensions({ formatId: 'horizontal' }).width, 1920);
});

test('resolveDimensions aceita tamanho personalizado e força par', () => {
  const result = resolveDimensions({ formatId: 'custom', width: 721, height: 1281 });
  assert.equal(result.width % 2, 0);
  assert.equal(result.height % 2, 0);
});

test('aspectRatioLabel reduz a proporção', () => {
  assert.equal(aspectRatioLabel(1080, 1920), '9:16');
  assert.equal(aspectRatioLabel(1080, 1080), '1:1');
  assert.equal(aspectRatioLabel(1920, 1080), '16:9');
});

test('getFormat/getLayout caem no padrão quando o id não existe', () => {
  assert.equal(getFormat('inexistente').id, FORMATS[0].id);
  assert.equal(getLayout('inexistente').id, LAYOUTS[0].id);
});

test('coverRect cobre o alvo inteiro partindo de 16:9 -> 9:16', () => {
  const result = coverRect({ width: 1920, height: 1080 }, { width: 1080, height: 1920 }, { x: 0.5, y: 0.5 });
  // Escala por altura (fator 1920/1080 ≈ 1.78).
  assert.ok(result.scale.width >= 1080);
  assert.ok(result.scale.height >= 1920);
  assert.equal(result.crop.width, 1080);
  assert.equal(result.crop.height, 1920);
  // Foco centralizado => corte simétrico nas laterais.
  const expectedX = Math.round((result.scale.width - 1080) / 2);
  assert.ok(Math.abs(result.crop.x - expectedX) <= 1);
});

test('coverRect desloca o corte conforme o ponto de foco', () => {
  const source = { width: 1920, height: 1080 };
  const target = { width: 1080, height: 1920 };
  const left = coverRect(source, target, { x: 0, y: 0.5 });
  const right = coverRect(source, target, { x: 1, y: 0.5 });
  assert.equal(left.crop.x, 0);
  assert.equal(right.crop.x, right.scale.width - 1080);
  assert.ok(right.crop.x > left.crop.x);
});

test('coverRect nunca produz offset negativo nem além do limite', () => {
  for (const focusX of [-1, 0, 0.3, 0.5, 1, 5]) {
    const result = coverRect({ width: 640, height: 480 }, { width: 1080, height: 1920 }, { x: focusX, y: focusX });
    assert.ok(result.crop.x >= 0);
    assert.ok(result.crop.y >= 0);
    assert.ok(result.crop.x + 1080 <= result.scale.width);
    assert.ok(result.crop.y + 1920 <= result.scale.height);
  }
});

test('coverRect mantém tudo quando a proporção já é a do alvo', () => {
  const result = coverRect({ width: 1080, height: 1920 }, { width: 1080, height: 1920 });
  assert.equal(result.crop.x, 0);
  assert.equal(result.crop.y, 0);
});

test('containRect cabe o vídeo inteiro e centra', () => {
  const result = containRect({ width: 1920, height: 1080 }, { width: 1080, height: 1920 });
  assert.equal(result.width, 1080);
  assert.ok(result.height <= 1920);
  assert.equal(result.offsetX, 0);
  assert.ok(result.offsetY > 0);
  // Soma das margens + altura do vídeo = altura do alvo (par).
  assert.ok(Math.abs(result.offsetY * 2 + result.height - 1920) <= 2);
});

test('splitGeometry vertical divide em 2 painéis que somam a altura alvo', () => {
  const result = splitGeometry('split-v', { width: 1080, height: 1920 }, { gapRatio: 0 });
  assert.equal(result.panes.length, 2);
  assert.equal(result.panes[0].width, 1080);
  assert.equal(result.panes[0].height + result.panes[1].height, 1920);
  assert.equal(result.panes[1].y, result.panes[0].height);
});

test('splitGeometry vertical com gap reserva o espaço entre painéis', () => {
  const result = splitGeometry('split-v', { width: 1080, height: 1920 }, { gapRatio: 0.02 });
  assert.ok(result.gap > 0);
  const sum = result.panes.reduce((total, pane) => total + pane.height, 0);
  assert.equal(sum + result.gap, 1920);
  assert.equal(result.panes[1].y, result.panes[0].height + result.gap);
});

test('splitGeometry horizontal divide a largura', () => {
  const result = splitGeometry('split-h', { width: 1920, height: 1080 }, { gapRatio: 0 });
  assert.equal(result.direction, 'h');
  assert.equal(result.panes[0].width + result.panes[1].width, 1920);
  assert.equal(result.panes[0].height, 1080);
  assert.equal(result.panes[1].x, result.panes[0].width);
});

test('splitGeometry triplo gera 3 painéis', () => {
  const result = splitGeometry('split-v-triple', { width: 1080, height: 1920 }, { gapRatio: 0.01 });
  assert.equal(result.panes.length, 3);
  const sum = result.panes.reduce((total, pane) => total + pane.height, 0);
  assert.equal(sum + result.gap * 2, 1920);
});

test('computeGeometry escolhe o modo certo para cada layout', () => {
  const sources = [{ width: 1920, height: 1080 }];
  assert.equal(computeGeometry({ output: { formatId: 'vertical', layout: 'fill' }, sources }).mode, 'cover');
  assert.equal(computeGeometry({ output: { formatId: 'vertical', layout: 'fit-blur' }, sources }).mode, 'blur-pad');
  assert.equal(computeGeometry({ output: { formatId: 'square', layout: 'fit-solid' }, sources }).mode, 'solid-pad');
  assert.equal(computeGeometry({ output: { formatId: 'vertical', layout: 'split-v' }, sources }).mode, 'split');
  assert.equal(computeGeometry({ output: { formatId: 'horizontal', layout: 'split-h' }, sources }).mode, 'split');
});

test('computeGeometry avisa quando falta vídeo para tela dividida', () => {
  const result = computeGeometry({ output: { formatId: 'vertical', layout: 'split-v' }, sources: [{ width: 1920, height: 1080 }] });
  assert.equal(result.panes.length, 2);
  // O segundo painel repete a fonte principal.
  assert.equal(result.panes[1].sourceIndex, 0);
  assert.ok(result.warnings.length >= 1);
  assert.match(result.warnings[0], /repetir o vídeo principal/);
});

test('computeGeometry funciona sem fontes informadas (fallback)', () => {
  const result = computeGeometry({ output: { formatId: 'square', layout: 'fill' } });
  assert.equal(result.target.width, 1080);
  assert.equal(result.target.height, 1080);
});
