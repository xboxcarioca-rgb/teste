/**
 * Preparação dos arquivos auxiliares de um render: legenda ASS, texto do
 * banner e fundo em gradiente. Tudo gravado em um diretório temporário e
 * removido ao final (o objeto devolvido traz um `cleanup()`).
 */

const fs = require('fs');
const path = require('path');
const { buildAssForClip } = require('./subtitles');
const { createGradientPng } = require('./png');
const { resolveDimensions } = require('../common/formats');

/** Garante que o diretório existe. */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Deriva duas cores para o gradiente a partir da cor base. */
function gradientColors(baseColor) {
  const hex = String(baseColor || '#0B0B0F').replace('#', '');
  const full = (hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex).padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const lighten = (value, amount) => Math.min(255, Math.round(value + (255 - value) * amount));
  const top = `#${[lighten(r, 0.28), lighten(g, 0.22), lighten(b, 0.34)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const bottom = `#${[Math.round(r * 0.35), Math.round(g * 0.35), Math.round(b * 0.4)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  return { top, bottom };
}

/**
 * Grava os assets temporários de um clipe.
 *
 * @param {object} params
 * @param {object} params.project
 * @param {{start:number,end:number,duration:number}} params.clip
 * @param {string} params.tempDir
 * @param {{width:number,height:number}} [params.logoSize] dimensões reais do logo
 * @returns {{assPath:string|null,fontsDir:string|null,bannerTextPath:string|null,backgroundPath:string|null,logoPath:string|null,cues:any[],cleanup:()=>void}}
 */
function prepareAssets({ project, clip, tempDir, logoSize = null }) {
  const dir = ensureDir(tempDir);
  const created = [];
  const output = project.output || {};
  const { width, height } = resolveDimensions(output);
  const target = { width, height };
  const warnings = [];

  // ------------------------------------------------------------ legendas ---
  let assPath = null;
  let cues = [];
  if (project.subtitles?.enabled && Array.isArray(project.subtitles.cues) && project.subtitles.cues.length) {
    const built = buildAssForClip({
      cues: project.subtitles.cues,
      clipStart: clip.start,
      clipEnd: clip.end,
      style: project.subtitles.style || {},
      target,
      limits: {
        minCueDuration: project.subtitles.minCueDuration,
        maxCueDuration: project.subtitles.maxCueDuration
      },
      meta: { title: project.name }
    });
    cues = built.cues;
    if (!cues.length) {
      warnings.push('Nenhuma legenda cai dentro deste trecho; o vídeo sairá sem legendas.');
    } else {
      assPath = path.join(dir, `legendas_${clip.start.toFixed(3).replace('.', '_')}.ass`);
      fs.writeFileSync(assPath, built.ass, 'utf8');
      created.push(assPath);
    }
  }

  // -------------------------------------------------------------- banner ---
  let bannerTextPath = null;
  const banner = project.banner?.text;
  if (banner?.enabled && String(banner.content || '').trim()) {
    const { wrapText } = require('../common/time');
    const lines = wrapText(banner.content, banner.maxCharsPerLine || 34);
    const content = (banner.uppercase ? lines.join('\n').toUpperCase() : lines.join('\n'));
    bannerTextPath = path.join(dir, `banner_${clip.start.toFixed(3).replace('.', '_')}.txt`);
    // drawtext lê o arquivo como UTF-8; evita BOM.
    fs.writeFileSync(bannerTextPath, content, { encoding: 'utf8' });
    created.push(bannerTextPath);
  }

  // ------------------------------------------------------------- gradiente --
  let backgroundPath = null;
  if (output.layout === 'fit-solid' && output.background?.gradient) {
    const { top, bottom } = gradientColors(output.background.color);
    backgroundPath = path.join(dir, 'fundo_gradiente.png');
    // Resolução reduzida: o FFmpeg amplia sem perda perceptível e o arquivo fica leve.
    fs.writeFileSync(backgroundPath, createGradientPng({ width: 270, height: 480, from: top, to: bottom, direction: 'diagonal' }));
    created.push(backgroundPath);
  }

  // ---------------------------------------------------------------- logo ---
  let logoPath = null;
  if (project.banner?.logo?.enabled && project.banner?.logo.path && fs.existsSync(project.banner.logo.path)) {
    logoPath = project.banner.logo.path;
  } else if (project.banner?.logo?.enabled && project.banner?.logo.path) {
    warnings.push(`Logo não encontrado em "${project.banner.logo.path}"; o vídeo sairá sem logo.`);
  }

  return {
    assPath,
    fontsDir: project.subtitles?.style?.fontFile ? path.dirname(project.subtitles.style.fontFile) : null,
    bannerTextPath,
    backgroundPath,
    logoPath,
    logoSize,
    cues,
    warnings,
    cleanup() {
      for (const file of created) {
        try {
          fs.rmSync(file, { force: true });
        } catch {
          /* melhor esforço */
        }
      }
    }
  };
}

module.exports = { prepareAssets, gradientColors, ensureDir };
