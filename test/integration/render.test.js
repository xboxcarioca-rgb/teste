/**
 * Teste de integração: renderiza DE VERDADE com o FFmpeg e confere o resultado
 * com o ffprobe (resolução, duração, streams e metadados removidos).
 *
 * É o teste que garante que o filtergraph montado é aceito pelo FFmpeg real,
 * não só que a string parece certa.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { FFMPEG, FFPROBE, workDir, createTestVideo, createTestPng, probe, sourceFor } = require('../helpers/media');
const { buildRenderCommand } = require('../../src/engine/ffmpeg-args');
const { renderClip, runFfmpeg } = require('../../src/engine/render');
const { detectCapabilities, serializeCapabilities } = require('../../src/engine/capabilities');
const { createDefaultProject } = require('../../src/common/defaults');
const { inspectMetadata } = require('../../src/engine/metadata');

const dir = workDir('vcs-render');
const sourcePath = path.join(dir, 'fonte.mp4');
const secondPath = path.join(dir, 'segunda.mp4');
const logoPath = path.join(dir, 'logo.png');

let caps = null;

test('preparação: gera mídias de teste', async () => {
  createTestVideo(sourcePath, { duration: 8, width: 1280, height: 720, fps: 30 });
  createTestVideo(secondPath, { duration: 8, width: 640, height: 640, fps: 30 });
  createTestPng(logoPath, 120);
  assert.ok(fs.existsSync(sourcePath));
  assert.ok(fs.existsSync(secondPath));
  assert.ok(fs.existsSync(logoPath));

  caps = await detectCapabilities(FFMPEG);
  assert.ok(caps.ok, 'FFmpeg de teste precisa funcionar');
  assert.ok(caps.hasDrawtext, 'FFmpeg de teste precisa ter drawtext para os testes de banner');
  assert.ok(caps.hasSubtitles, 'FFmpeg de teste precisa ter libass para os testes de legenda');
});

/** Renderiza um projeto e devolve o resultado + o probe do arquivo. */
async function render(projectOverrides, options = {}) {
  const project = createDefaultProject(projectOverrides);
  if (options.cues) project.subtitles.cues = options.cues;
  if (options.bannerText !== undefined) project.banner.text.content = options.bannerText;

  const outputPath = path.join(dir, options.name || `saida_${Math.random().toString(36).slice(2, 8)}.mp4`);
  const tempDir = path.join(dir, `tmp_${Math.random().toString(36).slice(2, 8)}`);

  const assets = {
    assPath: null,
    fontsDir: null,
    bannerTextPath: null,
    backgroundPath: null,
    logoPath: options.logo ? logoPath : null
  };

  // Deixa o renderClip preparar os assets sozinho (é o caminho real de produção).
  const result = await renderClip({
    ffmpegPath: FFMPEG,
    ffprobePath: FFPROBE,
    project,
    clip: options.clip || { start: 1, end: 4, duration: 3 },
    sources: options.sources || [sourceFor(sourcePath)],
    outputPath,
    caps,
    tempDir
  });

  if (!result.ok) {
    assert.fail(`Render falhou (${options.name || 'sem nome'}): ${result.error}\n${result.stderr || ''}`);
  }
  assert.ok(fs.existsSync(outputPath));
  assert.ok(fs.statSync(outputPath).size > 2048, 'arquivo de saída pequeno demais');

  const info = probe(outputPath);
  fs.rmSync(tempDir, { recursive: true, force: true });
  return { result, info, outputPath, project };
}

test('render: 9:16 preenchendo o quadro (crop com foco)', async () => {
  const { info, result } = await render({ output: { formatId: 'vertical', layout: 'fill' } }, { name: 'vertical_fill.mp4' });
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(video.width, 1080);
  assert.equal(video.height, 1920);
  assert.ok(Math.abs(Number(info.format.duration) - 3) < 0.4, `duração ~3s, veio ${info.format.duration}`);
  assert.equal(video.codec_name, 'h264');
  assert.ok(result.sizeBytes > 10000);
});

test('render: 1:1 quadrado', async () => {
  const { info } = await render({ output: { formatId: 'square', layout: 'fill' } }, { name: 'square_fill.mp4' });
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(video.width, 1080);
  assert.equal(video.height, 1080);
});

test('render: 4:5 retrato', async () => {
  const { info } = await render({ output: { formatId: 'portrait', layout: 'fill' } }, { name: 'portrait_fill.mp4' });
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(video.width, 1080);
  assert.equal(video.height, 1350);
});

test('render: 16:9 horizontal', async () => {
  const { info } = await render({ output: { formatId: 'horizontal', layout: 'fill' } }, { name: 'horizontal_fill.mp4' });
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(video.width, 1920);
  assert.equal(video.height, 1080);
});

test('render: metade + fundo desfocado (fit-blur)', async () => {
  const { info } = await render(
    { output: { formatId: 'vertical', layout: 'fit-blur', background: { blurRatio: 0.02, dim: 0.35 } } },
    { name: 'vertical_blur.mp4' }
  );
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(video.width, 1080);
  assert.equal(video.height, 1920);
});

test('render: barras coloridas (fit-solid)', async () => {
  const { info } = await render({ output: { formatId: 'square', layout: 'fit-solid', background: { color: '#1A0033' } } }, { name: 'square_solid.mp4' });
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(video.width, 1080);
  assert.equal(video.height, 1080);
});

test('render: gradiente de fundo usa a imagem PNG gerada', async () => {
  const { info } = await render(
    { output: { formatId: 'portrait', layout: 'fit-solid', background: { gradient: true, color: '#1A0033' } } },
    { name: 'portrait_gradient.mp4' }
  );
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(video.width, 1080);
  assert.equal(video.height, 1350);
});

test('render: tela dividida empilhada com 2 vídeos e áudio mixado', async () => {
  const { info } = await render(
    { output: { formatId: 'vertical', layout: 'split-v', split: { gapRatio: 0.01, audioFrom: 'mix' } } },
    { name: 'vertical_split_v.mp4', sources: [sourceFor(sourcePath), sourceFor(secondPath)] }
  );
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(video.width, 1080);
  assert.equal(video.height, 1920);
  assert.ok(info.streams.some((stream) => stream.codec_type === 'audio'));
});

test('render: tela dividida lado a lado (16:9)', async () => {
  const { info } = await render(
    { output: { formatId: 'horizontal', layout: 'split-h', split: { audioFrom: 'primary' } } },
    { name: 'horizontal_split_h.mp4', sources: [sourceFor(sourcePath), sourceFor(secondPath)] }
  );
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(video.width, 1920);
  assert.equal(video.height, 1080);
});

test('render: triplo (3 faixas) repete a fonte quando falta vídeo', async () => {
  const { info, result } = await render({ output: { formatId: 'vertical', layout: 'split-v-triple' } }, { name: 'vertical_triple.mp4' });
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(video.width, 1080);
  assert.equal(video.height, 1920);
  assert.ok(result.warnings.some((warning) => /repetir o vídeo principal/i.test(warning)));
});

test('render: legendas queimadas com karaoke', async () => {
  const cues = [
    { start: 1.2, end: 2.4, text: 'primeira fala', words: [{ start: 1.2, end: 1.8, text: 'primeira' }, { start: 1.8, end: 2.4, text: 'fala' }] },
    { start: 2.6, end: 3.8, text: 'segunda fala' }
  ];
  const { info, result } = await render(
    { subtitles: { enabled: true, style: { animation: 'karaoke', sizeRatio: 0.06 } } },
    { name: 'vertical_subs.mp4', cues, clip: { start: 1, end: 4, duration: 3 } }
  );
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(video.width, 1080);
  assert.equal(result.cues.length, 2, 'as duas legendas caem dentro do clipe');
});

test('render: legendas em caixa (box) com animação pop', async () => {
  const { info } = await render(
    { subtitles: { enabled: true, style: { animation: 'pop', box: true, boxColor: '#7B2CFF', boxOpacity: 0.8, align: 'center' } } },
    { name: 'subs_box.mp4', cues: [{ start: 1.5, end: 3.5, text: 'texto em caixa' }] }
  );
  assert.equal(info.streams.find((stream) => stream.codec_type === 'video').width, 1080);
});

test('render: banner de texto com faixa colorida no topo', async () => {
  const { info } = await render(
    { banner: { text: { enabled: true, content: 'O SEGREDO DO ALGORITMO', position: 'top', backgroundColor: '#FF2D55', animation: 'slide' } } },
    { name: 'banner_texto.mp4' }
  );
  assert.equal(info.streams.find((stream) => stream.codec_type === 'video').height, 1920);
});

test('render: banner em modo caixa ao redor do texto', async () => {
  const { info } = await render(
    { banner: { text: { enabled: true, content: 'Título curto', barWidthMode: 'hug', position: 'bottom', animation: 'fade' } } },
    { name: 'banner_hug.mp4' }
  );
  assert.ok(info.streams.some((stream) => stream.codec_type === 'video'));
});

test('render: banner com acentos, emoji e quebra de linha não quebra o drawtext', async () => {
  const { info } = await render(
    { banner: { text: { enabled: true, content: 'Atenção: 100% grátis — café ☕\nsegunda linha: %teste% e [colchetes]', uppercase: false, maxCharsPerLine: 40 } } },
    { name: 'banner_acentos.mp4' }
  );
  assert.ok(info.streams.some((stream) => stream.codec_type === 'video'));
});

test('render: logo sobreposto com fade e opacidade', async () => {
  const { info } = await render(
    { banner: { logo: { enabled: true, path: logoPath, anchor: 'top-right', widthRatio: 0.18, opacity: 0.85, animation: 'fade' } } },
    { name: 'logo_overlay.mp4', logo: true }
  );
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(video.width, 1080);
});

test('render: tudo junto (banner + legenda + logo + barra de progresso)', async () => {
  const { info, result } = await render(
    {
      output: { formatId: 'vertical', layout: 'fit-blur' },
      subtitles: { enabled: true, style: { animation: 'karaoke', sizeRatio: 0.055 } },
      banner: {
        text: { enabled: true, content: 'CORTE VIRAL', position: 'top', animation: 'fade' },
        logo: { enabled: true, path: logoPath, anchor: 'bottom-right', widthRatio: 0.16, animation: 'slide' },
        progressBar: { enabled: true, color: '#FFFFFF', heightRatio: 0.006 }
      }
    },
    {
      name: 'tudo_junto.mp4',
      logo: true,
      cues: [
        { start: 1.1, end: 2.2, text: 'fala um', words: [{ start: 1.1, end: 1.6, text: 'fala' }, { start: 1.6, end: 2.2, text: 'um' }] },
        { start: 2.4, end: 3.6, text: 'fala dois' }
      ]
    }
  );
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(video.width, 1080);
  assert.equal(video.height, 1920);
  assert.ok(info.streams.some((stream) => stream.codec_type === 'audio'));
  assert.ok(result.sizeBytes > 20000);
});

test('render: remove todos os metadados do arquivo final', async () => {
  // A fonte tem comment/creation_time/encoder de propósito.
  const sourceProbe = probe(sourcePath);
  const sourceTags = sourceProbe.format.tags || {};
  assert.ok(Object.keys(sourceTags).length > 0, 'a fonte de teste precisa ter metadados para o teste fazer sentido');

  const { info } = await render({ output: { stripMetadata: true, stripChapters: true } }, { name: 'sem_metadados.mp4' });
  const report = inspectMetadata(info);

  assert.equal(report.formatTags.comment, undefined, 'comment deve sumir');
  assert.equal(report.formatTags.creation_time, undefined, 'creation_time deve sumir');
  assert.equal(report.formatTags.encoder, undefined, 'encoder (Lavf) deve sumir por causa do +bitexact');
  assert.equal(report.chapters, 0);
  assert.equal(report.metadataTags, 0, `arquivo final não deveria ter tag de metadados, tem: ${JSON.stringify(report.formatTags)} / ${JSON.stringify(report.streamTags)}`);
  assert.equal(report.riskItems.length, 0, `nenhum item sensível deveria restar: ${report.riskItems.join(' | ')}`);
  assert.equal(report.clean, true);

  // As tags que sobrevivem são apenas as estruturais do container MP4
  // (major_brand/minor_version/compatible_brands e defaults do muxer),
  // que -map_metadata -1 não remove — nem deveria, pois definem o formato.
  assert.ok(report.totalTags > 0, 'o MP4 sempre carrega seus campos estruturais');
  assert.equal(report.totalTags, report.structuralTags.length, 'só devem restar tags estruturais');
  for (const key of Object.keys(report.formatTags)) {
    assert.ok(['major_brand', 'minor_version', 'compatible_brands'].includes(key), `tag de formato inesperada: ${key}`);
  }

  // Nenhum valor da fonte pode vazar para a saída (verificação no JSON cru).
  const raw = JSON.stringify(info).toLowerCase();
  for (const forbidden of ['metadado-que-deve-sumir', 'softwareoriginal', '2019-01-02']) {
    assert.ok(!raw.includes(forbidden), `a saída ainda contém "${forbidden}"`);
  }
});

test('render: mantém só o título limpo quando pedido', async () => {
  const project = createDefaultProject({ output: { stripMetadata: true, keepOnlyCleanTitle: true } });
  project.name = 'Meu Corte Viral 01';
  const outputPath = path.join(dir, 'titulo_limpo.mp4');
  const tempDir = path.join(dir, 'tmp_titulo');

  const result = await renderClip({
    ffmpegPath: FFMPEG,
    ffprobePath: FFPROBE,
    project,
    clip: { start: 0.5, end: 2, duration: 1.5 },
    sources: [sourceFor(sourcePath)],
    outputPath,
    caps,
    tempDir
  });
  assert.ok(result.ok, result.error);
  const info = probe(outputPath);
  const tags = info.format.tags || {};
  assert.equal(tags.title, 'Meu Corte Viral 01');
  assert.equal(tags.comment, undefined);
  assert.equal(tags.creation_time, undefined);
});

test('render: H.265 (libx265) quando disponível', async (t) => {
  if (!caps.hasLibx265) return t.skip('libx265 indisponível neste build de teste');
  const { info } = await render({ output: { videoCodec: 'h265', crf: 28 } }, { name: 'h265.mp4' });
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(video.codec_name, 'hevc');
});

test('render: áudio normalizado com loudnorm e estéreo 48 kHz', async () => {
  const { info } = await render(
    { output: { audio: { normalize: true, targetLoudness: -14, truePeak: -1, bitrateKbps: 192, sampleRate: 48000, channels: 2 } } },
    { name: 'audio_norm.mp4' }
  );
  const audio = info.streams.find((stream) => stream.codec_type === 'audio');
  assert.equal(audio.codec_name, 'aac');
  assert.equal(audio.sample_rate, '48000');
  assert.equal(audio.channels, 2);
});

test('render: fonte sem áudio ganha faixa silenciosa e o arquivo tem áudio', async () => {
  const silentSource = path.join(dir, 'sem_audio.mp4');
  createTestVideo(silentSource, { duration: 4, audio: false });
  const source = sourceFor(silentSource);
  assert.equal(source.hasAudio, false);

  const { info, result } = await render({}, { name: 'audio_silencioso.mp4', sources: [source] });
  assert.ok(info.streams.some((stream) => stream.codec_type === 'audio'));
  assert.ok(result.warnings.some((warning) => /faixa silenciosa/i.test(warning)));
});

test('render: fps 60 é aplicado na saída', async () => {
  const { info } = await render({ output: { fps: 60 } }, { name: 'fps60.mp4' });
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  const [numerator, denominator] = String(video.avg_frame_rate).split('/').map(Number);
  assert.ok(Math.abs(numerator / denominator - 60) < 0.5, `fps deveria ser 60, veio ${numerator / denominator}`);
});

test('render: faststart coloca o moov no início do arquivo', async () => {
  const { outputPath } = await render({ output: { faststart: true } }, { name: 'faststart.mp4' });
  const buffer = Buffer.alloc(4096);
  const handle = fs.openSync(outputPath, 'r');
  fs.readSync(handle, buffer, 0, 4096, 0);
  fs.closeSync(handle);
  const head = buffer.toString('latin1');
  const moovPosition = head.indexOf('moov');
  const mdatPosition = head.indexOf('mdat');
  assert.ok(moovPosition !== -1, 'moov deveria estar no início');
  assert.ok(moovPosition < mdatPosition || mdatPosition === -1, 'moov deve vir antes de mdat');
});

test('render: corte manual em qualquer ponto mantém a duração pedida', async () => {
  const { info } = await render({}, { name: 'corte_meio.mp4', clip: { start: 3.25, end: 5.75, duration: 2.5 } });
  const duration = Number(info.format.duration);
  assert.ok(Math.abs(duration - 2.5) < 0.25, `duração esperada ~2.5s, veio ${duration}`);
});

test('render: preview reduz a resolução e acelera', async () => {
  const project = createDefaultProject({ output: { formatId: 'vertical', preview: { enabled: true, seconds: 2, heightRatio: 0.3 } } });
  const outputPath = path.join(dir, 'previa.mp4');
  const tempDir = path.join(dir, 'tmp_previa');
  const { buildPreviewCommand } = require('../../src/engine/ffmpeg-args');
  const command = buildPreviewCommand({
    project,
    clip: { start: 1, end: 6, duration: 5 },
    sources: [sourceFor(sourcePath)],
    assets: {},
    caps,
    outputPath
  });
  const run = await runFfmpeg({ ffmpegPath: FFMPEG, args: command.args, totalDuration: command.duration });
  assert.ok(run.ok, run.error);
  const info = probe(outputPath);
  const video = info.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(video.height, 576); // 1920 * 0.3 -> par
  assert.ok(Math.abs(Number(info.format.duration) - 2) < 0.4);
});

test('render: progresso é reportado durante a execução', async () => {
  const events = [];
  const project = createDefaultProject();
  const outputPath = path.join(dir, 'com_progresso.mp4');
  const tempDir = path.join(dir, 'tmp_progresso');
  await renderClip({
    ffmpegPath: FFMPEG,
    ffprobePath: FFPROBE,
    project,
    clip: { start: 0, end: 5, duration: 5 },
    sources: [sourceFor(sourcePath)],
    outputPath,
    caps,
    tempDir,
    onProgress: (event) => events.push(event)
  });
  assert.ok(events.length > 0, 'deveria receber ao menos um evento de progresso');
  const last = events[events.length - 1];
  assert.ok(last.percent >= 90, `progresso final deveria chegar perto de 100%, veio ${last.percent}`);
});

test('render: cancelamento interrompe de verdade', async () => {
  const controller = new AbortController();
  const project = createDefaultProject({ output: { crf: 16, preset: 'veryslow' } });
  const outputPath = path.join(dir, 'cancelado.mp4');
  const tempDir = path.join(dir, 'tmp_cancelado');

  const promise = renderClip({
    ffmpegPath: FFMPEG,
    project,
    clip: { start: 0, end: 8, duration: 8 },
    sources: [sourceFor(sourcePath)],
    outputPath,
    caps,
    tempDir,
    signal: controller.signal,
    onProgress: () => controller.abort()
  });

  const result = await promise;
  assert.equal(result.ok, false);
  assert.equal(result.cancelled, true);
  assert.match(result.error, /cancelado/i);
});

test('render: limpa os arquivos temporários ao final', async () => {
  const tempDir = path.join(dir, 'tmp_limpeza');
  const project = createDefaultProject({ banner: { text: { enabled: true, content: 'limpeza' } } });
  project.subtitles.cues = [{ start: 1.2, end: 2.5, text: 'teste de limpeza' }];

  const result = await renderClip({
    ffmpegPath: FFMPEG,
    ffprobePath: FFPROBE,
    project,
    clip: { start: 1, end: 3, duration: 2 },
    sources: [sourceFor(sourcePath)],
    outputPath: path.join(dir, 'limpeza.mp4'),
    caps,
    tempDir
  });
  assert.ok(result.ok, result.error);
  const leftovers = fs.existsSync(tempDir) ? fs.readdirSync(tempDir).filter((name) => /\.(ass|txt|png)$/i.test(name)) : [];
  assert.deepEqual(leftovers, [], `arquivos temporários não foram limpos: ${leftovers.join(', ')}`);
});

test('render: serialização de capacidades é JSON-friendly', () => {
  const serialized = serializeCapabilities(caps);
  const roundTrip = JSON.parse(JSON.stringify(serialized));
  assert.ok(Array.isArray(roundTrip.filterList));
  assert.ok(roundTrip.filterList.includes('scale'));
  assert.equal(roundTrip.filters, undefined);
});
