/**
 * Testes da preparação de assets temporários (ASS, texto do banner, gradiente)
 * e das capacidades/parsing de listas do FFmpeg.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { prepareAssets, gradientColors } = require('../../src/engine/assets');
const { parseFilterNames, parseEncoderNames } = require('../../src/engine/capabilities');
const { createDefaultProject } = require('../../src/common/defaults');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vcs-assets-'));
}

test('prepareAssets grava o ASS só quando há legendas no trecho', () => {
  const dir = tempDir();
  const project = createDefaultProject({
    subtitles: { enabled: true, cues: [{ start: 30, end: 33, text: 'dentro do clipe' }] }
  });

  const withCues = prepareAssets({ project, clip: { start: 25, end: 45, duration: 20 }, tempDir: dir });
  assert.ok(withCues.assPath);
  assert.ok(fs.existsSync(withCues.assPath));
  const assContent = fs.readFileSync(withCues.assPath, 'utf8');
  // No modo karaoke o texto vem com tags {\kfN} entre as palavras.
  assert.match(assContent, /DENTRO/);
  assert.match(assContent, /CLIPE/);
  assert.match(assContent, /Dialogue: 0,0:00:05\.00,0:00:08\.00/);
  assert.equal(withCues.cues.length, 1);

  const outOfRange = prepareAssets({
    project: createDefaultProject({ subtitles: { enabled: true, cues: [{ start: 0, end: 2, text: 'fora' }] } }),
    clip: { start: 25, end: 45, duration: 20 },
    tempDir: dir
  });
  assert.equal(outOfRange.assPath, null);
  assert.ok(outOfRange.warnings.some((warning) => /Nenhuma legenda/i.test(warning)));

  withCues.cleanup();
  assert.ok(!fs.existsSync(withCues.assPath), 'cleanup deve apagar o ASS');
});

test('prepareAssets não gera ASS com legendas desligadas', () => {
  const dir = tempDir();
  const result = prepareAssets({
    project: createDefaultProject({ subtitles: { enabled: false, cues: [{ start: 0, end: 1, text: 'x' }] } }),
    clip: { start: 0, end: 10, duration: 10 },
    tempDir: dir
  });
  assert.equal(result.assPath, null);
  result.cleanup();
});

test('prepareAssets grava o texto do banner sem BOM e em CAIXA ALTA', () => {
  const dir = tempDir();
  const result = prepareAssets({
    project: createDefaultProject({ banner: { text: { enabled: true, content: 'chamada forte', uppercase: true, maxCharsPerLine: 40 } } }),
    clip: { start: 0, end: 10, duration: 10 },
    tempDir: dir
  });
  assert.ok(result.bannerTextPath);
  const content = fs.readFileSync(result.bannerTextPath);
  assert.equal(content[0], 0x43, 'primeiro byte é "C", não BOM');
  assert.equal(content.toString('utf8'), 'CHAMADA FORTE');
  result.cleanup();
  assert.ok(!fs.existsSync(result.bannerTextPath));
});

test('prepareAssets requebra banner longo em várias linhas', () => {
  const dir = tempDir();
  const result = prepareAssets({
    project: createDefaultProject({ banner: { text: { enabled: true, content: 'um título de banner bem longo demais para uma linha só', uppercase: false, maxCharsPerLine: 18 } } }),
    clip: { start: 0, end: 10, duration: 10 },
    tempDir: dir
  });
  const lines = fs.readFileSync(result.bannerTextPath, 'utf8').split('\n');
  assert.ok(lines.length >= 2);
  assert.ok(lines.every((line) => line.length <= 22));
  result.cleanup();
});

test('prepareAssets gera o gradiente apenas para fit-solid com gradient ligado', () => {
  const dir = tempDir();
  const enabled = prepareAssets({
    project: createDefaultProject({ output: { layout: 'fit-solid', background: { gradient: true, color: '#1A0033' } } }),
    clip: { start: 0, end: 10, duration: 10 },
    tempDir: dir
  });
  assert.ok(enabled.backgroundPath);
  const png = fs.readFileSync(enabled.backgroundPath);
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  enabled.cleanup();

  const disabled = prepareAssets({
    project: createDefaultProject({ output: { layout: 'fit-solid', background: { gradient: false } } }),
    clip: { start: 0, end: 10, duration: 10 },
    tempDir: dir
  });
  assert.equal(disabled.backgroundPath, null);
  disabled.cleanup();
});

test('prepareAssets avisa quando o logo não existe no disco', () => {
  const dir = tempDir();
  const result = prepareAssets({
    project: createDefaultProject({ banner: { logo: { enabled: true, path: '/caminho/inexistente/logo.png' } } }),
    clip: { start: 0, end: 10, duration: 10 },
    tempDir: dir
  });
  assert.equal(result.logoPath, null);
  assert.ok(result.warnings.some((warning) => /Logo não encontrado/i.test(warning)));
  result.cleanup();
});

test('prepareAssets informa o fontsdir quando há arquivo de fonte personalizado', () => {
  const dir = tempDir();
  const result = prepareAssets({
    project: createDefaultProject({ subtitles: { enabled: true, style: { fontFile: '/fontes/Impact.ttf' }, cues: [{ start: 1, end: 3, text: 'x' }] } }),
    clip: { start: 0, end: 10, duration: 10 },
    tempDir: dir
  });
  assert.equal(result.fontsDir, path.dirname('/fontes/Impact.ttf'));
  result.cleanup();
});

test('prepareAssets cria o diretório temporário quando ele não existe', () => {
  const dir = path.join(tempDir(), 'sub', 'dir');
  const result = prepareAssets({
    project: createDefaultProject(),
    clip: { start: 0, end: 10, duration: 10 },
    tempDir: dir
  });
  assert.ok(fs.existsSync(dir));
  result.cleanup();
});

test('gradientColors clareia o topo e escurece a base', () => {
  const { top, bottom } = gradientColors('#1A0033');
  const value = (hex) => parseInt(hex.replace('#', '').slice(0, 2), 16);
  assert.ok(value(top) > value('#1A0033'), 'topo mais claro');
  assert.ok(value(bottom) <= value('#1A0033'), 'base mais escura');
  assert.match(top, /^#[0-9a-f]{6}$/);
});

test('gradientColors aceita hex curto e inválido sem quebrar', () => {
  assert.match(gradientColors('#fff').top, /^#[0-9a-f]{6}$/);
  assert.match(gradientColors('').top, /^#[0-9a-f]{6}$/);
  assert.match(gradientColors(null).bottom, /^#[0-9a-f]{6}$/);
});

test('parseFilterNames lê a saída real do ffmpeg -filters', () => {
  const output = `Filters:
  T.. = Timeline support
  .S. = Slice threading
  ..C = Command support
      A = Audio input/output
 ... crop              V->V       Crop the input video.
 T.C drawtext          V->V       Draw text on top of video frames using libfreetype.
 ... subtitles         V->V       Render text subtitles onto input video.
`;
  const names = parseFilterNames(output);
  assert.ok(names.has('crop'));
  assert.ok(names.has('drawtext'));
  assert.ok(names.has('subtitles'));
  assert.ok(!names.has('Timeline'));
});

test('parseEncoderNames lê a saída real do ffmpeg -encoders', () => {
  const output = `Encoders:
 V..... = Video
 VFS.D. aac                  AAC (Advanced Audio Coding) (codec aac)
 V..... libx264              H.264 / AVC / MPEG-4 AVC
 A..... libmp3lame           MP3 (MPEG audio layer 3) (codec mp3)
`;
  const names = parseEncoderNames(output);
  assert.ok(names.has('aac'));
  assert.ok(names.has('libx264'));
  assert.ok(names.has('libmp3lame'));
  assert.ok(!names.has('Video'));
});
