/**
 * Construção do filtergraph do FFmpeg.
 *
 * Tudo aqui é função pura: recebe um spec e devolve as cadeias de filtros.
 * Quem executa é o render.js. Isso permite testar sem abrir o Electron e sem
 * tocar em arquivos reais.
 *
 * Ordem das camadas (de baixo para cima):
 *   1. base      -> enquadramento (cover / fundo desfocado / barras / dividido)
 *   2. banner    -> faixa de texto no topo/rodapé
 *   3. legendas  -> ASS queimado (libass)
 *   4. logo      -> imagem sobreposta
 *   5. progresso -> barra de progresso do clipe
 */

const { toFfmpegColor, escapeFilterPath, anchorToRatio } = require('./escaping');
const { clamp, round3 } = require('../common/time');
const { even } = require('../common/formats');

/** Expressão de corte com ponto de foco, usando as dimensões reais pós-escala. */
function focusCropExpression(width, height, focus) {
  const fx = clamp(focus?.x ?? 0.5, 0, 1).toFixed(4);
  const fy = clamp(focus?.y ?? 0.5, 0, 1).toFixed(4);
  const x = `'min(max((in_w-${width})*${fx},0),max(in_w-${width},0))'`;
  const y = `'min(max((in_h-${height})*${fy},0),max(in_h-${height},0))'`;
  return { x, y };
}

/** Filtro de desfoque disponível no build em uso. */
function blurFilter(caps, sigma) {
  const strength = Math.max(1, Math.round(sigma));
  if (caps?.hasGblur !== false && (caps?.hasGblur || !caps)) return `gblur=sigma=${strength}`;
  const radius = Math.max(2, Math.round(strength / 3));
  return `boxblur=luma_radius=${radius}:luma_power=2:chroma_radius=${radius}:chroma_power=2`;
}

/** Expressão de alpha para animação de entrada/saída de uma camada. */
function alphaExpression({ animation, animationDuration = 0.4, visibleSeconds = 0, clipDuration }) {
  const duration = Math.max(0.05, Number(animationDuration) || 0.4);
  const until = visibleSeconds > 0 ? Math.min(visibleSeconds, clipDuration) : clipDuration;
  if (animation === 'none') {
    return until < clipDuration ? `'if(lt(t,${round3(until)}),1,0)'` : null;
  }
  const fadeIn = `min(t/${round3(duration)},1)`;
  if (until >= clipDuration) return `'${fadeIn}'`;
  return `'if(lt(t,${round3(until)}),${fadeIn},0)'`;
}

/**
 * Constrói o grafo de vídeo.
 *
 * @param {object} spec
 * @param {import('./geometry').ReturnType} spec.geometry
 * @param {number} spec.fps
 * @param {number} spec.clipDuration
 * @param {{panes:number[],background?:number|null,logo?:number|null}} spec.roles índices de input
 * @param {object} [spec.caps] capacidades detectadas
 * @param {{assPath:string,fontsDir?:string}|null} [spec.subtitles]
 * @param {object|null} [spec.bannerText]
 * @param {object|null} [spec.logo]
 * @param {object|null} [spec.progressBar]
 * @returns {{chains:string[],label:string,warnings:string[]}}
 */
function buildVideoGraph(spec) {
  const { geometry, fps, clipDuration, roles, caps = {} } = spec;
  const chains = [];
  const warnings = [];
  const { width: tw, height: th } = geometry.target;
  const focus = { x: spec.focus?.x ?? 0.5, y: spec.focus?.y ?? 0.45 };
  const duration = round3(Math.max(0.1, clipDuration));

  // ---------------------------------------------------------------- base ----
  if (geometry.mode === 'cover') {
    const crop = focusCropExpression(tw, th, focus);
    chains.push(
      `[${roles.panes[0]}:v]fps=${fps},scale=${tw}:${th}:force_original_aspect_ratio=increase:flags=lanczos,` +
        `crop=${tw}:${th}:${crop.x}:${crop.y},setsar=1[base0]`
    );
  } else if (geometry.mode === 'blur-pad') {
    const sigma = clamp((spec.background?.blurRatio ?? 0.02) * th, 4, 80);
    const dim = clamp(spec.background?.dim ?? 0.35, 0, 0.95);
    const dimColor = `black@${dim.toFixed(2)}`;
    chains.push(`[${roles.panes[0]}:v]fps=${fps},split=2[blurbg][blurfg]`);
    chains.push(
      `[blurbg]scale=${tw}:${th}:force_original_aspect_ratio=increase,crop=${tw}:${th},` +
        `${blurFilter(caps, sigma)},drawbox=x=0:y=0:w=${tw}:h=${th}:color=${dimColor}:t=fill,setsar=1[blurcanvas]`
    );
    chains.push(`[blurfg]scale=${tw}:${th}:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1[blurfitted]`);
    chains.push(`[blurcanvas][blurfitted]overlay=(W-w)/2:(H-h)/2:format=auto,setsar=1[base0]`);
  } else if (geometry.mode === 'solid-pad') {
    const color = toFfmpegColor(spec.background?.color || '#0B0B0F');
    chains.push(`[${roles.panes[0]}:v]fps=${fps},scale=${tw}:${th}:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1[solidfg]`);
    if (roles.background != null) {
      // Fundo em gradiente: imagem PNG gerada pelo app (funciona em qualquer build).
      chains.push(`[${roles.background}:v]fps=${fps},scale=${tw}:${th}:force_original_aspect_ratio=increase,crop=${tw}:${th},setsar=1[solidcanvas]`);
      chains.push(`[solidcanvas][solidfg]overlay=(W-w)/2:(H-h)/2:format=auto,setsar=1[base0]`);
    } else {
      chains.push(
        `[solidfg]pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2:${color},setsar=1[base0]`
      );
    }
  } else if (geometry.mode === 'split') {
    const canvasColor = toFfmpegColor(spec.background?.color || '#0B0B0F');
    chains.push(`color=c=${canvasColor}:s=${tw}x${th}:r=${fps}:d=${duration},setsar=1[splitcanvas]`);
    let previousLabel = 'splitcanvas';
    geometry.panes.forEach((pane, index) => {
      const inputIndex = roles.panes[index] ?? roles.panes[0];
      const crop = focusCropExpression(pane.width, pane.height, index === 0 ? focus : { x: 0.5, y: 0.5 });
      const paneLabel = `pane${index}`;
      chains.push(
        `[${inputIndex}:v]fps=${fps},scale=${pane.width}:${pane.height}:force_original_aspect_ratio=increase:flags=lanczos,` +
          `crop=${pane.width}:${pane.height}:${crop.x}:${crop.y},setsar=1[${paneLabel}]`
      );
      const outLabel = index === geometry.panes.length - 1 ? 'base0' : `splitmix${index}`;
      chains.push(`[${previousLabel}][${paneLabel}]overlay=${pane.x}:${pane.y}:format=auto[${outLabel}]`);
      previousLabel = outLabel;
    });
    if (spec.split?.borderRatio > 0 && spec.split?.borderColor && geometry.panes.length > 1) {
      const borderWidth = Math.max(1, even(spec.split.borderRatio * th));
      const borderColor = toFfmpegColor(spec.split.borderColor);
      const separatorY = geometry.panes[0].y + geometry.panes[0].height;
      chains.push(`[base0]drawbox=x=0:y=${separatorY}:w=${tw}:h=${borderWidth}:color=${borderColor}:t=fill[base0b]`);
      return finalize({ chains, warnings, caps, spec, labelIn: 'base0b', tw, th, duration });
    }
  } else {
    warnings.push(`Layout desconhecido ("${geometry.mode}"); usando preenchimento total.`);
    const crop = focusCropExpression(tw, th, focus);
    chains.push(
      `[${roles.panes[0]}:v]fps=${fps},scale=${tw}:${th}:force_original_aspect_ratio=increase,crop=${tw}:${th}:${crop.x}:${crop.y},setsar=1[base0]`
    );
  }

  return finalize({ chains, warnings, caps, spec, labelIn: 'base0', tw, th, duration });
}

/** Aplica banner, legendas, logo, barra de progresso e o formato final de pixels. */
function finalize({ chains, warnings, caps, spec, labelIn, tw, th, duration }) {
  let current = labelIn;
  let step = 0;
  const next = (prefix) => `${prefix}${(step += 1)}`;

  // ------------------------------------------------------------- banner ----
  const banner = spec.bannerText;
  if (banner?.enabled && banner.content && String(banner.content).trim()) {
    if (caps.hasDrawtext === false) {
      warnings.push('Banner de texto ignorado: este FFmpeg foi compilado sem libfreetype (drawtext).');
    } else if (!banner.textFilePath) {
      warnings.push('Banner de texto ignorado: caminho do arquivo de texto não foi informado.');
    } else {
      const fontSize = Math.max(10, Math.round((banner.sizeRatio ?? 0.05) * th));
      const barHeight = Math.max(fontSize + 8, Math.round((banner.barHeightRatio ?? 0.085) * th));
      const offsetY = Math.round((banner.offsetYRatio || 0) * th);
      const margin = Math.round(th * 0.04);
      const position = banner.position || 'top';
      const animDuration = Math.max(0.05, Number(banner.animationDuration) || 0.4);
      const visible = banner.visibleSeconds > 0 ? Math.min(banner.visibleSeconds, duration) : duration;

      // Y de referência da faixa (para o modo "full") ou do texto (modo "hug").
      const barYBase = {
        top: 0,
        'upper-third': Math.round(th * 0.16),
        center: Math.round((th - barHeight) / 2),
        'lower-third': Math.round(th * 0.66),
        bottom: th - barHeight
      }[position] ?? 0;

      const textColor = toFfmpegColor(banner.color || '#FFFFFF');
      const outlineWidth = Math.max(0, Math.round((banner.outlineRatio ?? 0.002) * th));
      const outlineColor = toFfmpegColor(banner.outlineColor || '#000000');
      const fontFilePart = banner.fontFile ? `fontfile='${escapeFilterPath(banner.fontFile)}':` : '';
      const textFile = escapeFilterPath(banner.textFilePath);
      const animation = banner.animation || 'fade';

      if (banner.background && banner.barWidthMode !== 'hug') {
        const barColor = toFfmpegColor(banner.backgroundColor || '#FF2D55', banner.backgroundOpacity ?? 1);
        let barY = barYBase + offsetY;
        let boxWidth = `w=${tw}`;
        if (animation === 'slide' && position !== 'bottom') {
          barY = `'${barYBase + offsetY}-(1-min(t/${round3(animDuration)},1))*${barHeight}'`;
        } else if (animation === 'slide') {
          barY = `'${barYBase + offsetY}+(1-min(t/${round3(animDuration)},1))*${barHeight}'`;
        }
        if (animation === 'expand') boxWidth = `w='min(${tw},${tw}*min(t/${round3(animDuration)},1))'`;
        const enable = visible < duration ? `:enable='lte(t,${round3(visible)})'` : '';
        const barOut = next('bar');
        chains.push(`[${current}]drawbox=x=0:y=${barY}:${boxWidth}:h=${barHeight}:color=${barColor}:t=fill${enable}[${barOut}]`);
        current = barOut;
      }

      const textY =
        banner.background && banner.barWidthMode !== 'hug'
          ? `'${barYBase + offsetY}+(${barHeight}-text_h)/2'`
          : {
              top: `${margin + offsetY}`,
              'upper-third': `${Math.round(th * 0.18) + offsetY}`,
              center: `'(h-text_h)/2+${offsetY}'`,
              'lower-third': `${Math.round(th * 0.68) + offsetY}-text_h`,
              bottom: `h-text_h-${margin - offsetY}`
            }[position] ?? `${margin + offsetY}`;

      const boxParts =
        banner.background && banner.barWidthMode === 'hug'
          ? `:box=1:boxcolor=${toFfmpegColor(banner.backgroundColor || '#111111', banner.backgroundOpacity ?? 0.8)}:boxborderw=${Math.round((banner.barPaddingRatio ?? 0.02) * th)}`
          : '';

      const alpha = alphaExpression({
        animation: animation === 'expand' || animation === 'slide' ? 'none' : animation,
        animationDuration: animDuration,
        visibleSeconds: banner.visibleSeconds || 0,
        clipDuration: duration
      });

      const enable = visible < duration ? `:enable='lte(t,${round3(visible)})'` : '';
      const textOut = next('banner');
      chains.push(
        `[${current}]drawtext=${fontFilePart}textfile='${textFile}':fontsize=${fontSize}:fontcolor=${textColor}` +
          `:borderw=${outlineWidth}:bordercolor=${outlineColor}:line_spacing=${Math.round(fontSize * 0.12)}` +
          `:x='(w-text_w)/2':y=${textY}${boxParts}${alpha ? `:alpha=${alpha}` : ''}${enable}[${textOut}]`
      );
      current = textOut;
    }
  }

  // ----------------------------------------------------------- legendas ----
  if (spec.subtitles?.assPath) {
    if (caps.hasSubtitles === false && caps.hasAss === false) {
      warnings.push('Legendas ignoradas: este FFmpeg não tem libass (filtros subtitles/ass).');
    } else {
      const assPath = escapeFilterPath(spec.subtitles.assPath);
      const fontsDir = spec.subtitles.fontsDir ? `:fontsdir='${escapeFilterPath(spec.subtitles.fontsDir)}'` : '';
      const subOut = next('sub');
      chains.push(`[${current}]subtitles='${assPath}'${fontsDir}[${subOut}]`);
      current = subOut;
    }
  }

  // --------------------------------------------------------------- logo ----
  const logo = spec.logo;
  if (logo?.enabled && logo.path && rolesHasLogo(spec)) {
    const logoWidth = even(Math.max(16, (logo.widthRatio ?? 0.18) * tw));
    const margin = Math.round((logo.marginRatio ?? 0.04) * Math.min(tw, th));
    const { x: ax, y: ay } = anchorToRatio(logo.anchor || 'top-right');
    const overlayX = Math.round(ax * (tw - logoWidth) + (ax === 0 ? margin : ax === 1 ? -margin : 0));
    const overlayY = Math.round(ay * (th - logoWidth * (logo.aspect || 0.4)) + (ay === 0 ? margin : ay === 1 ? -margin : 0));
    const opacity = clamp(logo.opacity ?? 1, 0.05, 1);
    const visible = logo.visibleSeconds > 0 ? Math.min(logo.visibleSeconds, duration) : duration;
    const animDuration = Math.max(0.05, Number(logo.animationDuration) || 0.5);

    const logoParts = [`[${spec.roles.logo}:v]scale=${logoWidth}:-1:flags=lanczos`];
    if (opacity < 1 && caps.hasColorChannelMixer !== false) logoParts.push('format=rgba', `colorchannelmixer=aa=${opacity.toFixed(2)}`);
    if (logo.animation === 'fade' && caps.hasFade !== false) logoParts.push(`fade=t=in:st=0:d=${round3(animDuration)}:alpha=1`);
    logoParts.push('format=rgba[logoimg]');
    chains.push(logoParts.join(','));

    let xExpr = `${overlayX}`;
    let yExpr = `${overlayY}`;
    if (logo.animation === 'slide') {
      const travel = Math.round(th * 0.08);
      yExpr = `'${overlayY}+(1-min(t/${round3(animDuration)},1))*${travel}'`;
    } else if (logo.animation === 'bounce') {
      yExpr = `'${overlayY}+abs(sin(t*3))*${Math.round(th * 0.01)}`;
    }
    const enable = visible < duration ? `:enable='lte(t,${round3(visible)})'` : '';
    const logoOut = next('logo');
    chains.push(`[${current}][logoimg]overlay=${xExpr}:${yExpr}:format=auto${enable}[${logoOut}]`);
    current = logoOut;
  } else if (logo?.enabled && logo.path) {
    warnings.push('Logo ignorado: o arquivo de imagem não foi carregado como entrada.');
  }

  // ---------------------------------------------- barra de progresso -------
  const progress = spec.progressBar;
  if (progress?.enabled) {
    const height = Math.max(2, even((progress.heightRatio ?? 0.006) * th));
    const color = toFfmpegColor(progress.color || '#FFFFFF', progress.opacity ?? 0.9);
    const y = progress.position === 'bottom' ? th - height : 0;
    const progressOut = next('prog');
    chains.push(
      `[${current}]drawbox=x=0:y=${y}:w='min(iw,iw*t/${round3(duration)})':h=${height}:color=${color}:t=fill[${progressOut}]`
    );
    current = progressOut;
  }

  // ---------------------------------------------------------- pixel format --
  const pixelFormat = spec.pixelFormat || 'yuv420p';
  const finalOut = 'vout';
  chains.push(`[${current}]format=${pixelFormat},setpts=PTS-STARTPTS[${finalOut}]`);

  return { chains, label: finalOut, warnings };
}

function rolesHasLogo(spec) {
  return spec.roles?.logo != null && spec.roles.logo >= 0;
}

/**
 * Constrói o grafo de áudio.
 *
 * Notas de compatibilidade (testadas contra builds antigos e novos):
 *  - `loudnorm` não pode ser seguido de `aresample` em builds antigos
 *    ("Error reinitializing filters"); usamos `-ar` na saída em vez disso.
 *  - `amix=normalize=0` não existe em builds antigos; compensamos o ganho
 *    com `volume=N`, que funciona em todos.
 *
 * @param {object} spec
 * @param {number[]} spec.audioInputs índices de input que têm áudio
 * @param {{from?:'primary'|'secondary'|'mix'|'none'}} spec.mode
 * @returns {{chains:string[],label:string|null,warnings:string[],silent:boolean}}
 */
function buildAudioGraph(spec) {
  const chains = [];
  const warnings = [];
  const audio = spec.audio || {};
  const inputs = Array.isArray(spec.audioInputs) ? spec.audioInputs : [];
  const duration = round3(Math.max(0.1, spec.clipDuration || 1));

  if (spec.mode === 'none' || !inputs.length) {
    return { chains, label: null, warnings, silent: true };
  }

  const sampleRate = Number(audio.sampleRate) || 48000;
  const chosen = (() => {
    if (spec.mode === 'secondary' && inputs.length > 1) return [inputs[1]];
    if (spec.mode === 'primary') return [inputs[0]];
    if (spec.mode === 'mix') return inputs;
    return [inputs[0]];
  })();

  let current;
  if (chosen.length === 1) {
    current = `${chosen[0]}:a`;
    // Normaliza a taxa antes do loudnorm (evita o bug de reinitialização).
    const resampled = 'ares0';
    chains.push(`[${current}]aresample=${sampleRate},asetpts=PTS-STARTPTS[${resampled}]`);
    current = resampled;
  } else {
    const labels = chosen.map((inputIndex, position) => {
      const label = `amixin${position}`;
      chains.push(`[${inputIndex}:a]aresample=${sampleRate},asetpts=PTS-STARTPTS[${label}]`);
      return label;
    });
    const mixed = 'amixed';
    chains.push(`[${labels.join('][')}]amix=inputs=${labels.length}:duration=first:dropout_transition=0,volume=${labels.length}[${mixed}]`);
    current = mixed;
  }

  if (audio.normalize && spec.caps?.hasLoudnorm !== false) {
    const loudness = Number.isFinite(Number(audio.targetLoudness)) ? Number(audio.targetLoudness) : -14;
    const truePeak = Number.isFinite(Number(audio.truePeak)) ? Number(audio.truePeak) : -1;
    const normalized = 'aloud';
    chains.push(`[${current}]loudnorm=I=${loudness}:TP=${truePeak}:LRA=11[${normalized}]`);
    current = normalized;
  } else if (audio.normalize) {
    warnings.push('Normalização de volume ignorada: filtro loudnorm indisponível neste FFmpeg.');
  }

  const fadeIn = Number(audio.fadeIn) || 0;
  const fadeOut = Number(audio.fadeOut) || 0;
  if (fadeIn > 0) {
    const label = 'afadein';
    chains.push(`[${current}]afade=t=in:st=0:d=${round3(fadeIn)}[${label}]`);
    current = label;
  }
  if (fadeOut > 0) {
    const label = 'afadeout';
    const start = Math.max(0, duration - fadeOut);
    chains.push(`[${current}]afade=t=out:st=${round3(start)}:d=${round3(fadeOut)}[${label}]`);
    current = label;
  }

  const finalLabel = 'aout';
  chains.push(`[${current}]aformat=sample_fmts=fltp:channel_layouts=stereo[${finalLabel}]`);
  return { chains, label: finalLabel, warnings, silent: false };
}

module.exports = {
  buildVideoGraph,
  buildAudioGraph,
  focusCropExpression,
  blurFilter,
  alphaExpression
};
