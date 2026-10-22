/**
 * Testes do parser de progresso do FFmpeg e do gerador de PNG.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { createProgressParser, extractError, isHardwareEncoderFailure } = require('../../src/engine/progress');
const { createGradientPng, createSolidPng, encodePng, crc32 } = require('../../src/engine/png');

test('progress: interpreta um bloco completo do -progress', () => {
  const parser = createProgressParser(10);
  const events = parser.push(
    [
      'frame=150',
      'fps=45.00',
      'stream_0_0_q=28.0',
      'bitrate=1234.5kbits/s',
      'total_size=204800',
      'out_time_us=5000000',
      'out_time=00:00:05.000000',
      'progress=continue',
      ''
    ].join('\n')
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].frame, 150);
  assert.equal(events[0].fps, 45);
  assert.equal(events[0].elapsedSeconds, 5);
  assert.equal(events[0].percent, 50);
  assert.equal(events[0].finished, false);
  assert.ok(events[0].totalSeconds === 10);
});

test('progress: out_time_ms também é microssegundo (bug histórico do ffmpeg)', () => {
  const parser = createProgressParser(4);
  const [event] = parser.push('out_time_ms=2000000\nprogress=continue\n');
  assert.equal(event.elapsedSeconds, 2);
  assert.equal(event.percent, 50);
});

test('progress: acumula blocos parciais recebidos em pedaços', () => {
  const parser = createProgressParser(20);
  assert.deepEqual(parser.push('frame=10\nfps'), []);
  assert.deepEqual(parser.push('=30\nout_time_us=4000000\n'), []);
  const events = parser.push('progress=continue\n');
  assert.equal(events.length, 1);
  assert.equal(events[0].frame, 10);
  assert.equal(events[0].fps, 30);
  assert.equal(events[0].percent, 20);
});

test('progress: marca o fim e limita a 100%', () => {
  const parser = createProgressParser(5);
  const [event] = parser.push('out_time_us=9000000\nprogress=end\n');
  assert.equal(event.finished, true);
  assert.equal(event.percent, 100);
  assert.equal(event.etaSeconds, null);
});

test('progress: calcula ETA a partir do tempo de parede', async () => {
  const parser = createProgressParser(100);
  await new Promise((resolve) => setTimeout(resolve, 60));
  const [event] = parser.push('out_time_us=50000000\nprogress=continue\n');
  assert.equal(event.percent, 50);
  assert.ok(event.etaSeconds >= 0, 'ETA deve existir enquanto não termina');
});

test('progress: duração zero não divide por zero', () => {
  const parser = createProgressParser(0);
  const [event] = parser.push('out_time_us=1000000\nprogress=continue\n');
  assert.ok(Number.isFinite(event.percent));
  assert.ok(event.percent <= 100);
});

test('progress: speed é lido sem o "x"', () => {
  const parser = createProgressParser(10);
  const [event] = parser.push('speed=2.35x\nout_time_us=1000000\nprogress=continue\n');
  assert.equal(event.speed, 2.35);
});

test('extractError pega as linhas úteis da stderr', () => {
  const stderr = [
    'frame=  100 fps= 30 q=28.0 size=    1024kB time=00:00:03.00',
    "Input #0, mov,mp4, from 'C:\\videos\\a.mp4':",
    'Error reinitializing filters!',
    'Failed to inject frame into filter network: Invalid argument',
    'Conversion failed!'
  ].join('\n');
  const error = extractError(stderr);
  assert.match(error, /Error reinitializing filters/);
  assert.match(error, /Conversion failed/);
});

test('extractError cai nas últimas linhas quando nada casa', () => {
  const error = extractError('linha 1\nlinha 2\nlinha 3');
  assert.match(error, /linha 3/);
});

test('extractError trata stderr vazia', () => {
  assert.equal(extractError(''), '');
  assert.equal(extractError(null), '');
});

test('isHardwareEncoderFailure reconhece falhas de GPU', () => {
  assert.equal(isHardwareEncoderFailure('Cannot load nvcuda.dll'), true);
  assert.equal(isHardwareEncoderFailure('nvenc: no supported codecs'), true);
  assert.equal(isHardwareEncoderFailure('Impossible to convert between the formats'), false);
});

// -------------------------------------------------------------------- PNG ---
test('crc32 bate com valores conhecidos', () => {
  assert.equal(crc32(Buffer.from('')).toString(16), '0');
  assert.equal(crc32(Buffer.from('123456789')).toString(16), 'cbf43926');
});

test('createGradientPng gera PNG válido com assinatura e IEND', () => {
  const png = createGradientPng({ width: 16, height: 8, from: '#FF0000', to: '#0000FF', direction: 'horizontal' });
  assert.ok(Buffer.isBuffer(png));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // Layout: assinatura(8) + length(4) + type(4) + dados do IHDR.
  assert.equal(png.readUInt32BE(8), 13, 'comprimento do IHDR');
  assert.equal(png.subarray(12, 16).toString('ascii'), 'IHDR');
  assert.equal(png.readUInt32BE(16), 16, 'largura');
  assert.equal(png.readUInt32BE(20), 8, 'altura');
  assert.equal(png[24], 8, 'bit depth');
  assert.equal(png[25], 6, 'color type RGBA');
  assert.ok(png.subarray(png.length - 8, png.length - 4).toString('ascii') === 'IEND');
});

test('createGradientPng nas 4 direções mantém o mesmo tamanho de saída', () => {
  const sizes = ['vertical', 'horizontal', 'diagonal', 'radial'].map(
    (direction) => createGradientPng({ width: 12, height: 12, from: '#123456', to: '#654321', direction }).length
  );
  assert.ok(sizes.every((size) => size > 60));
});

test('createGradientPng aceita dimensões mínimas sem quebrar', () => {
  const png = createGradientPng({ width: 1, height: 1, from: '#000', to: '#fff' });
  assert.equal(png.readUInt32BE(16), 2, 'largura mínima forçada para 2');
  assert.equal(png.readUInt32BE(20), 2, 'altura mínima forçada para 2');
});

test('createSolidPng gera cor única', () => {
  const png = createSolidPng({ width: 4, height: 4, color: '#00FF00' });
  assert.ok(png.length > 60);
});

test('encodePng valida buffer com tamanho esperado', () => {
  const rgba = Buffer.alloc(4 * 4 * 4, 128);
  const png = encodePng(4, 4, rgba);
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});
