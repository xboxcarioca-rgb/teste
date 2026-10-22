/**
 * Testes da montagem do comando FFmpeg e da escolha de encoder.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRenderCommand, buildPreviewCommand, selectVideoEncoder } = require('../../src/engine/ffmpeg-args');
const { createDefaultProject } = require('../../src/common/defaults');

const CAPS = {
  hasDrawtext: true,
  hasSubtitles: true,
  hasAss: true,
  hasGblur: true,
  hasBoxblur: true,
  hasLoudnorm: true,
  hasFade: true,
  hasColorChannelMixer: true,
  hasAmix: true,
  hasLibx264: true,
  hasLibx265: true,
  hardwareEncoders: []
};

const SOURCES = [{ path: '/videos/fonte.mp4', width: 1920, height: 1080, hasAudio: true, duration: 120 }];

function commandFor(projectOverrides = {}, params = {}) {
  const project = createDefaultProject(projectOverrides);
  return buildRenderCommand({
    project,
    clip: params.clip || { start: 10, end: 25, duration: 15 },
    sources: params.sources || SOURCES,
    assets: params.assets || {},
    caps: params.caps ?? CAPS,
    outputPath: params.outputPath || '/saida/corte-1.mp4'
  });
}

test('comando básico: input com -ss/-t, filtro, mapas e saída', () => {
  const { args } = commandFor();
  assert.equal(args[0], '-hide_banner');
  assert.ok(args.includes('-nostdin'));
  assert.ok(args.includes('-y'));

  // Busca rápida no input: -ss vem ANTES de -i.
  const ssIndex = args.indexOf('-ss');
  const inputIndex = args.indexOf('-i');
  assert.ok(ssIndex !== -1 && ssIndex < inputIndex, '-ss deve vir antes de -i');
  assert.equal(args[ssIndex + 1], '10');
  assert.equal(args[inputIndex + 1], '/videos/fonte.mp4');
  const tIndex = args.indexOf('-t');
  assert.equal(args[tIndex + 1], '15');

  assert.ok(args.includes('-filter_complex'));
  assert.ok(args.includes('[vout]'));
  assert.ok(args.includes('[aout]'));
  assert.equal(args[args.length - 1], '/saida/corte-1.mp4');
  assert.ok(args.includes('-progress'));
  assert.equal(args[args.indexOf('-progress') + 1], 'pipe:1');
});

test('comando remove metadados por padrão', () => {
  const { args } = commandFor();
  assert.ok(args.includes('-map_metadata'));
  assert.equal(args[args.indexOf('-map_metadata') + 1], '-1');
  assert.ok(args.includes('-map_chapters'));
  assert.ok(args.includes('+bitexact'));
});

test('comando mantém metadados quando o usuário desliga a remoção', () => {
  const { args } = commandFor({ output: { stripMetadata: false, stripChapters: false } });
  assert.ok(!args.includes('-map_metadata'));
  assert.ok(!args.includes('-map_chapters'));
  assert.ok(!args.includes('+bitexact'));
});

test('comando aplica faststart só para mp4/mov', () => {
  assert.ok(commandFor({}, { outputPath: '/a/b.mp4' }).args.includes('+faststart'));
  assert.ok(commandFor({}, { outputPath: '/a/b.mov' }).args.includes('+faststart'));
  assert.ok(!commandFor({}, { outputPath: '/a/b.mkv' }).args.includes('+faststart'));
});

test('comando usa CRF por padrão e bitrate quando configurado', () => {
  const crf = commandFor({ output: { crf: 22 } });
  assert.equal(crf.args[crf.args.indexOf('-crf') + 1], '22');

  const bitrate = commandFor({ output: { rateControl: 'bitrate', videoBitrateKbps: 9000 } });
  assert.equal(bitrate.args[bitrate.args.indexOf('-b:v') + 1], '9000k');
  assert.ok(!bitrate.args.includes('-crf'));
});

test('comando limita a duração na saída com -t', () => {
  const { args } = commandFor();
  const lastT = args.lastIndexOf('-t');
  assert.equal(args[lastT + 1], '15');
});

test('áudio: codec, bitrate, sample rate e canais', () => {
  const { args } = commandFor({ output: { audio: { codec: 'aac', bitrateKbps: 256, sampleRate: 44100, channels: 1, normalize: true } } });
  assert.equal(args[args.indexOf('-c:a') + 1], 'aac');
  assert.equal(args[args.indexOf('-b:a') + 1], '256k');
  assert.equal(args[args.indexOf('-ar') + 1], '44100');
  assert.equal(args[args.indexOf('-ac') + 1], '1');
});

test('áudio: fonte sem áudio ganha anullsrc e aviso', () => {
  const { args, warnings } = commandFor({}, { sources: [{ path: '/v.mp4', width: 1920, height: 1080, hasAudio: false, duration: 60 }] });
  assert.ok(args.includes('anullsrc=r=48000:cl=stereo'));
  assert.ok(warnings.some((warning) => /faixa silenciosa/i.test(warning)));
});

test('áudio: modo none remove a faixa de áudio (-an)', () => {
  const { args } = commandFor({ output: { split: { audioFrom: 'none' } } });
  assert.ok(args.includes('-an'));
  assert.ok(!args.includes('[aout]'));
});

test('legendas: passa o caminho do ASS e o fontsdir para o filtro', () => {
  const { args } = commandFor({}, { assets: { assPath: 'C:\\temp\\leg.ass', fontsDir: 'C:\\Windows\\Fonts' } });
  const graph = args[args.indexOf('-filter_complex') + 1];
  assert.match(graph, /subtitles='C\\:\/temp\/leg\.ass'/);
  assert.match(graph, /fontsdir='C\\:\/Windows\/Fonts'/);
});

test('banner: só entra no grafo quando há texto e arquivo', () => {
  const without = commandFor({ banner: { text: { enabled: true, content: 'OI' } } });
  assert.ok(!without.args.join(' ').includes('drawtext'));

  const withText = commandFor({ banner: { text: { enabled: true, content: 'OI' } } }, { assets: { bannerTextPath: '/tmp/banner.txt' } });
  const graph = withText.args[withText.args.indexOf('-filter_complex') + 1];
  assert.match(graph, /drawtext/);
});

test('logo: vira input com -loop 1 e ganha overlay', () => {
  const { args } = commandFor({ banner: { logo: { enabled: true, path: '/img/logo.png', widthRatio: 0.2 } } }, { assets: { logoPath: '/img/logo.png' } });
  const loopIndexes = args.reduce((list, value, index) => (value === '-loop' ? [...list, index] : list), []);
  assert.equal(loopIndexes.length, 1, 'exatamente um input de imagem em loop');
  // Sequência: -loop 1 -framerate F -t D -i <caminho>
  const start = loopIndexes[0];
  assert.equal(args[start + 1], '1');
  assert.equal(args[start + 2], '-framerate');
  assert.equal(args[start + 4], '-t');
  assert.equal(args[start + 6], '-i');
  assert.equal(args[start + 7], '/img/logo.png');
  const graph = args[args.indexOf('-filter_complex') + 1];
  assert.match(graph, /\[1:v\]scale=216:-1/);
  assert.match(graph, /overlay=/);
});

test('logo ausente no disco não entra no comando e gera aviso', () => {
  const { args, warnings } = commandFor({ banner: { logo: { enabled: true, path: '/img/nao-existe.png' } } }, { assets: {} });
  assert.ok(!args.includes('/img/nao-existe.png'));
  assert.ok(!args.includes('logoimg'));
  assert.ok(Array.isArray(warnings));
});

test('tela dividida: duas entradas de vídeo com recortes próprios', () => {
  const sources = [
    { path: '/a.mp4', width: 1920, height: 1080, hasAudio: true, duration: 60 },
    { path: '/b.mp4', width: 1280, height: 720, hasAudio: true, duration: 60 }
  ];
  const { args } = commandFor(
    { output: { layout: 'split-v', formatId: 'vertical', split: { audioFrom: 'mix' } } },
    { sources, clip: { start: 0, end: 10, duration: 10, panes: [{ start: 0, end: 10 }, { start: 20, end: 30 }] } }
  );
  const inputPaths = args.filter((value, index) => args[index - 1] === '-i');
  assert.deepEqual(inputPaths, ['/a.mp4', '/b.mp4']);
  // O segundo painel tem seu próprio -ss.
  const ssValues = args.filter((value, index) => args[index - 1] === '-ss');
  assert.deepEqual(ssValues, ['0', '20'].filter((value) => ssValues.includes(value)));
  assert.ok(ssValues.includes('20'));
  // Mix de áudio.
  assert.match(args[args.indexOf('-filter_complex') + 1], /amix=inputs=2/);
});

test('gradiente em fit-solid adiciona input de imagem de fundo', () => {
  const { args } = commandFor({ output: { layout: 'fit-solid', background: { gradient: true, color: '#1A0033' } } }, { assets: { backgroundPath: '/tmp/fundo.png' } });
  assert.ok(args.includes('/tmp/fundo.png'));
  const graph = args[args.indexOf('-filter_complex') + 1];
  assert.match(graph, /\[solidcanvas\]/);
});

test('gradiente sem arquivo gerado cai em cor sólida com aviso', () => {
  const { args, warnings } = commandFor({ output: { layout: 'fit-solid', background: { gradient: true } } }, { assets: {} });
  assert.ok(!args.includes('/tmp/fundo.png'));
  assert.match(args[args.indexOf('-filter_complex') + 1], /pad=1080:1920/);
  assert.ok(warnings.some((warning) => /Gradiente indisponível/i.test(warning)));
});

test('fps e GOP são derivados do projeto', () => {
  const { args } = commandFor({ output: { fps: 60 } });
  assert.equal(args[args.indexOf('-r') + 1], '60');
  assert.equal(args[args.indexOf('-g') + 1], '120');
});

test('cores são marcadas como BT.709', () => {
  const { args } = commandFor();
  assert.equal(args[args.indexOf('-colorspace') + 1], 'bt709');
  assert.ok(args.includes('-color_primaries'));
  assert.ok(args.includes('-color_trc'));
});

test('aviso quando o layout dividido tem menos vídeos que o necessário', () => {
  const { warnings } = commandFor({ output: { layout: 'split-v' } }, { sources: [SOURCES[0]] });
  assert.ok(warnings.some((warning) => /repetir o vídeo principal/i.test(warning)));
});

test('buildPreviewCommand reduz resolução, encurta o clipe e usa ultrafast', () => {
  const project = createDefaultProject({ output: { preview: { enabled: true, seconds: 4, heightRatio: 0.35 } } });
  const result = buildPreviewCommand({
    project,
    clip: { start: 30, end: 90, duration: 60 },
    sources: SOURCES,
    assets: {},
    caps: CAPS,
    outputPath: '/tmp/previa.mp4'
  });
  assert.equal(result.duration, 4);
  assert.equal(result.args[result.args.indexOf('-t') + 1], '4');
  const graph = result.args[result.args.indexOf('-filter_complex') + 1];
  assert.match(graph, /scale=378:672/); // 1080*0.35 arredondado para par
  assert.equal(result.args[result.args.indexOf('-preset') + 1], 'ultrafast');
});

test('selectVideoEncoder usa libx264 por padrão', () => {
  const result = selectVideoEncoder({ videoCodec: 'h264', crf: 21, preset: 'slow' }, CAPS);
  assert.equal(result.name, 'libx264');
  assert.equal(result.hardware, false);
  assert.ok(result.args.includes('-crf'));
  assert.equal(result.args[result.args.indexOf('-crf') + 1], '21');
  assert.equal(result.args[result.args.indexOf('-preset') + 1], 'slow');
});

test('selectVideoEncoder usa libx265 com tag hvc1 (compatível com Apple)', () => {
  const result = selectVideoEncoder({ videoCodec: 'h265', crf: 24 }, CAPS);
  assert.equal(result.name, 'libx265');
  assert.ok(result.args.includes('hvc1'));
});

test('selectVideoEncoder cai em libx264 quando HEVC não existe no build', () => {
  const result = selectVideoEncoder({ videoCodec: 'h265' }, { ...CAPS, hasLibx265: false });
  assert.equal(result.name, 'libx264');
  assert.ok(result.warnings.some((warning) => /HEVC indisponível/i.test(warning)));
});

test('selectVideoEncoder prefere NVENC quando disponível e em modo auto', () => {
  const result = selectVideoEncoder({ hardwareAcceleration: 'auto', crf: 23 }, { ...CAPS, hardwareEncoders: ['h264_nvenc'] });
  assert.equal(result.name, 'h264_nvenc');
  assert.equal(result.hardware, true);
  assert.ok(result.args.includes('-cq'));
});

test('selectVideoEncoder respeita hardwareAcceleration=none mesmo com GPU', () => {
  const result = selectVideoEncoder({ hardwareAcceleration: 'none' }, { ...CAPS, hardwareEncoders: ['h264_nvenc', 'h264_qsv'] });
  assert.equal(result.name, 'libx264');
  assert.equal(result.hardware, false);
});

test('selectVideoEncoder usa QSV quando NVENC não existe', () => {
  const result = selectVideoEncoder({}, { ...CAPS, hardwareEncoders: ['h264_qsv'] });
  assert.equal(result.name, 'h264_qsv');
  assert.ok(result.args.includes('-global_quality'));
});

test('selectVideoEncoder avisa quando a GPU pedida não existe', () => {
  const result = selectVideoEncoder({ hardwareAcceleration: 'nvenc' }, { ...CAPS, hardwareEncoders: [] });
  assert.equal(result.name, 'libx264');
  assert.ok(result.warnings.some((warning) => /Aceleração/i.test(warning)));
});

test('selectVideoEncoder limita o CRF a valores válidos', () => {
  assert.equal(selectVideoEncoder({ crf: 99 }, CAPS).args[selectVideoEncoder({ crf: 99 }, CAPS).args.indexOf('-crf') + 1], '40');
  assert.equal(selectVideoEncoder({ crf: -5 }, CAPS).args[selectVideoEncoder({ crf: -5 }, CAPS).args.indexOf('-crf') + 1], '12');
});
