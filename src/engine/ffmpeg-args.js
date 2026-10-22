/**
 * Montagem completa do comando FFmpeg para renderizar um corte.
 *
 * Ordem dos inputs (importante — os rótulos do filtergraph dependem dela):
 *   [0..n-1] vídeos dos painéis (com -ss/-t para busca rápida e precisa)
 *   [n]      imagem de fundo em gradiente (quando aplicável)
 *   [n+1]    logo/banner em imagem (loop)
 *   [n+2]    anullsrc (quando o vídeo não tem áudio)
 */

const { computeGeometry } = require('./geometry');
const { buildVideoGraph, buildAudioGraph } = require('./filters');
const { metadataArgs } = require('./metadata');
const { evenDimension } = require('../common/formats');
const { clamp, round3 } = require('../common/time');

/**
 * Escolhe o encoder de vídeo com base na preferência e no que existe no build.
 * @param {{videoCodec?:string,hardwareAcceleration?:string,rateControl?:string,crf?:number,videoBitrateKbps?:number,maxBitrateKbps?:number,preset?:string,profile?:string}} output
 * @param {object} caps
 * @returns {{name:string,args:string[],hardware:boolean,warnings:string[]}}
 */
function selectVideoEncoder(output = {}, caps = {}) {
  const warnings = [];
  const codec = output.videoCodec === 'h265' ? 'h265' : 'h264';
  const crf = clamp(Number(output.crf) || 20, 12, 40);
  const bitrate = Number(output.videoBitrateKbps) || 0;
  const maxBitrate = Number(output.maxBitrateKbps) || 0;
  const rateControl = bitrate > 0 ? 'bitrate' : output.rateControl || 'crf';
  const preset = output.preset || 'medium';
  const hardwareEncoders = caps.hardwareEncoders || [];
  const hwPreference = output.hardwareAcceleration || 'auto';

  const wantsHardware = hwPreference !== 'none' && hardwareEncoders.length > 0;
  if (wantsHardware) {
    const nvenc = codec === 'h265' ? 'hevc_nvenc' : 'h264_nvenc';
    const qsv = codec === 'h265' ? 'hevc_qsv' : 'h264_qsv';
    if (hardwareEncoders.includes(nvenc)) {
      const args = rateControl === 'bitrate'
        ? ['-b:v', `${bitrate}k`, ...(maxBitrate ? ['-maxrate', `${maxBitrate}k`, '-bufsize', `${bitrate * 2}k`] : [])]
        : ['-rc', 'vbr', '-cq', String(crf), '-b:v', '0'];
      return { name: nvenc, args: ['-preset', 'p5', '-tune', 'hq', ...args], hardware: true, warnings };
    }
    if (hardwareEncoders.includes(qsv)) {
      const args = rateControl === 'bitrate'
        ? ['-b:v', `${bitrate}k`]
        : ['-global_quality', String(crf)];
      return { name: qsv, args: ['-preset', preset, ...args], hardware: true, warnings };
    }
    if (hardwareEncoders.includes('h264_videotoolbox') && codec === 'h264') {
      return {
        name: 'h264_videotoolbox',
        args: rateControl === 'bitrate' ? ['-b:v', `${bitrate}k`] : ['-q:v', String(Math.round(crf / 2))],
        hardware: true,
        warnings
      };
    }
  }

  if (hwPreference !== 'none' && hwPreference !== 'auto' && !hardwareEncoders.length) {
    warnings.push(`Aceleração "${hwPreference}" indisponível neste FFmpeg; usando CPU (${codec === 'h265' ? 'libx265' : 'libx264'}).`);
  }

  if (codec === 'h265') {
    if (caps.hasLibx265 === false) {
      warnings.push('HEVC indisponível neste FFmpeg; usando H.264.');
      return {
        name: 'libx264',
        args: ['-preset', preset, ...(rateControl === 'bitrate' ? ['-b:v', `${bitrate}k`] : ['-crf', String(crf)]), '-profile:v', 'high'],
        hardware: false,
        warnings
      };
    }
    return {
      name: 'libx265',
      args: [
        '-preset',
        preset,
        ...(rateControl === 'bitrate' ? ['-b:v', `${bitrate}k`] : ['-crf', String(crf)]),
        '-tag:v',
        'hvc1'
      ],
      hardware: false,
      warnings
    };
  }

  return {
    name: 'libx264',
    args: [
      '-preset',
      preset,
      ...(rateControl === 'bitrate'
        ? ['-b:v', `${bitrate}k`, ...(maxBitrate ? ['-maxrate', `${maxBitrate}k`, '-bufsize', `${maxBitrate * 2}k`] : [])]
        : ['-crf', String(crf)]),
      ...(output.profile ? ['-profile:v', output.profile] : [])
    ],
    hardware: false,
    warnings
  };
}

/**
 * Monta os argumentos completos do FFmpeg.
 *
 * @param {object} params
 * @param {object} params.project projeto (output/subtitles/banner)
 * @param {{start:number,end:number,duration:number,panes?:{start:number,end:number}[]}} params.clip
 * @param {{path:string,width:number,height:number,hasAudio:boolean,duration:number}[]} params.sources
 * @param {{assPath?:string|null,fontsDir?:string|null,bannerTextPath?:string|null,logoPath?:string|null,backgroundPath?:string|null}} params.assets
 * @param {object} params.caps
 * @param {string} params.outputPath
 * @returns {{args:string[],warnings:string[],geometry:object,roles:object,duration:number}}
 */
function buildRenderCommand(params) {
  const { project, clip, sources, assets = {}, caps = {}, outputPath } = params;
  const warnings = [];
  const output = project.output || {};
  const fps = clamp(Number(output.fps) || 30, 10, 240);
  const duration = round3(Math.max(0.1, clip?.duration || (clip?.end - clip?.start) || 1));

  const geometry = computeGeometry({ output, sources });
  warnings.push(...geometry.warnings);

  // ------------------------------------------------------------- inputs ----
  const args = ['-hide_banner', '-nostdin', '-y', '-loglevel', 'info'];
  const roles = { panes: [], background: null, logo: null, silence: null };
  const audioInputs = [];
  let inputIndex = 0;

  const paneTrims = geometry.panes.map((pane, index) => {
    const custom = Array.isArray(clip?.panes) ? clip.panes[index] : null;
    return {
      start: custom ? Math.max(0, custom.start) : Math.max(0, clip?.start || 0),
      duration: custom ? Math.max(0.1, custom.end - custom.start) : duration,
      sourceIndex: pane.sourceIndex
    };
  });

  const paneInputs = [];
  paneTrims.forEach((trim, index) => {
    const source = sources[trim.sourceIndex] || sources[0];
    if (!source) {
      warnings.push(`Painel ${index + 1} sem vídeo de origem; o render pode falhar.`);
      return;
    }
    if (trim.start > 0) args.push('-ss', String(round3(trim.start)));
    args.push('-t', String(round3(trim.duration)));
    args.push('-i', source.path);
    paneInputs.push(inputIndex);
    if (source.hasAudio) audioInputs.push(inputIndex);
    inputIndex += 1;
  });

  // Cada painel aponta para o input correspondente (ou repete o primeiro).
  roles.panes = geometry.panes.map((pane, index) => paneInputs[index] ?? paneInputs[0] ?? 0);

  const needsBackgroundImage = geometry.mode === 'solid-pad' && Boolean(assets.backgroundPath) && Boolean(output.background?.gradient);
  if (needsBackgroundImage) {
    args.push('-loop', '1', '-framerate', String(fps), '-t', String(duration), '-i', assets.backgroundPath);
    roles.background = inputIndex;
    inputIndex += 1;
  } else if (geometry.mode === 'solid-pad' && output.background?.gradient) {
    warnings.push('Gradiente indisponível (arquivo de fundo não gerado); usando cor sólida.');
  }

  const logoLayer = project.banner?.logo;
  const logoEnabled = Boolean(logoLayer?.enabled && logoLayer.path && assets.logoPath);
  if (logoEnabled) {
    args.push('-loop', '1', '-framerate', String(fps), '-t', String(duration), '-i', assets.logoPath);
    roles.logo = inputIndex;
    inputIndex += 1;
  }

  // Áudio: se nenhuma fonte tem áudio, cria silêncio para o arquivo não ficar mudo.
  const audioMode = output.split?.audioFrom || 'primary';
  if (!audioInputs.length) {
    args.push('-f', 'lavfi', '-t', String(duration), '-i', `anullsrc=r=${Number(output.audio?.sampleRate) || 48000}:cl=stereo`);
    roles.silence = inputIndex;
    audioInputs.push(inputIndex);
    inputIndex += 1;
    warnings.push('O vídeo de origem não tem áudio: foi gerada uma faixa silenciosa.');
  }

  // ------------------------------------------------------------- filtro ----
  const videoGraph = buildVideoGraph({
    geometry,
    fps,
    clipDuration: duration,
    roles,
    caps,
    focus: { x: output.focusX ?? 0.5, y: output.focusY ?? 0.45 },
    background: output.background || {},
    split: output.split || {},
    pixelFormat: output.pixelFormat || 'yuv420p',
    subtitles: assets.assPath ? { assPath: assets.assPath, fontsDir: assets.fontsDir || null } : null,
    bannerText: project.banner?.text ? { ...project.banner.text, textFilePath: assets.bannerTextPath || null } : null,
    logo: logoEnabled
      ? {
          ...logoLayer,
          path: assets.logoPath,
          aspect: (sources[0]?.height || 9) / (sources[0]?.width || 16)
        }
      : null,
    progressBar: project.banner?.progressBar || null
  });
  warnings.push(...videoGraph.warnings);

  const audioGraph = buildAudioGraph({
    audioInputs,
    mode: audioMode,
    clipDuration: duration,
    audio: output.audio || {},
    caps
  });
  warnings.push(...audioGraph.warnings);

  const chains = [...videoGraph.chains, ...audioGraph.chains];
  args.push('-filter_complex', chains.join(';'));

  // -------------------------------------------------------------- saída ----
  args.push('-map', `[${videoGraph.label}]`);
  if (audioGraph.label) args.push('-map', `[${audioGraph.label}]`);

  const encoder = selectVideoEncoder(output, caps);
  warnings.push(...encoder.warnings);
  args.push('-c:v', encoder.name, ...encoder.args);
  args.push('-pix_fmt', output.pixelFormat || 'yuv420p');
  args.push('-r', String(fps));
  args.push('-g', String(Math.round(fps * 2)));
  args.push('-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709');

  if (audioGraph.label) {
    const audioSettings = output.audio || {};
    const audioCodec = audioSettings.codec === 'mp3' ? 'libmp3lame' : 'aac';
    args.push('-c:a', audioCodec);
    args.push('-b:a', `${clamp(Number(audioSettings.bitrateKbps) || 192, 64, 320)}k`);
    args.push('-ar', String(Number(audioSettings.sampleRate) || 48000));
    args.push('-ac', String(Number(audioSettings.channels) || 2));
  } else {
    args.push('-an');
  }

  args.push(...metadataArgs({
    stripMetadata: output.stripMetadata !== false,
    stripChapters: output.stripChapters !== false,
    keepOnlyCleanTitle: Boolean(output.keepOnlyCleanTitle),
    title: project.name
  }));

  args.push('-avoid_negative_ts', 'make_zero');
  if (output.faststart !== false && /\.mp4$/i.test(outputPath)) args.push('-movflags', '+faststart');
  if (output.faststart !== false && /\.mov$/i.test(outputPath)) args.push('-movflags', '+faststart');
  args.push('-t', String(duration));
  args.push('-progress', 'pipe:1', '-nostats');
  args.push(outputPath);

  return { args, warnings, geometry, roles, duration, encoder: encoder.name, hardware: encoder.hardware };
}

/**
 * Monta um comando de pré-visualização rápida (baixa resolução, poucos segundos).
 * Reaproveita todo o pipeline, só muda tamanho/velocidade.
 */
function buildPreviewCommand(params) {
  const preview = params.project?.output?.preview || {};
  const ratio = clamp(Number(preview.heightRatio) || 0.35, 0.15, 0.6);
  const seconds = clamp(Number(preview.seconds) || 6, 1, 30);
  const project = {
    ...params.project,
    output: {
      ...params.project.output,
      width: evenDimension(params.project.output.width * ratio),
      height: evenDimension(params.project.output.height * ratio),
      formatId: 'custom',
      crf: 28,
      preset: 'ultrafast',
      hardwareAcceleration: 'none'
    }
  };
  const clip = {
    ...params.clip,
    end: params.clip.start + seconds,
    duration: seconds
  };
  return buildRenderCommand({ ...params, project, clip });
}

module.exports = { buildRenderCommand, buildPreviewCommand, selectVideoEncoder };
