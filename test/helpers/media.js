/**
 * Helpers de teste: cria mídias reais com FFmpeg para os testes de integração.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const FFMPEG = require('@ffmpeg-installer/ffmpeg').path;
const FFPROBE = require('@ffprobe-installer/ffprobe').path;

/** Diretório temporário exclusivo da suíte. */
function workDir(name = 'vcs-test') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Gera um vídeo de teste com áudio (testsrc2 + seno), em 720p.
 * @param {string} filePath
 * @param {{duration?:number,width?:number,height?:number,fps?:number,audio?:boolean}} [options]
 */
function createTestVideo(filePath, options = {}) {
  const duration = options.duration ?? 6;
  const width = options.width ?? 1280;
  const height = options.height ?? 720;
  const fps = options.fps ?? 30;
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `testsrc2=size=${width}x${height}:rate=${fps}:duration=${duration}`
  ];

  if (options.audio !== false) {
    args.push('-f', 'lavfi', '-i', `sine=frequency=440:duration=${duration}:sample_rate=48000`);
  }

  // Metadados precisam vir DEPOIS de todos os -i (são opções de saída).
  args.push(
    '-metadata',
    'comment=METADADO-QUE-DEVE-SUMIR',
    '-metadata',
    'creation_time=2019-01-02T03:04:05.000000Z',
    '-metadata',
    'encoder=SoftwareOriginal',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p'
  );
  if (options.audio !== false) args.push('-c:a', 'aac', '-b:a', '128k', '-shortest');
  args.push(filePath);

  execFileSync(FFMPEG, args, { stdio: 'pipe' });
  return filePath;
}

/** Gera um PNG sólido com alpha (para testar overlay de logo). */
function createTestPng(filePath, size = 64) {
  const { createGradientPng } = require('../../src/engine/png');
  const png = createGradientPng({ width: size, height: Math.round(size / 2), from: '#FF2D55', to: '#7B5CFF', direction: 'horizontal' });
  fs.writeFileSync(filePath, png);
  return filePath;
}

/** ffprobe -print_format json */
function probe(filePath) {
  const output = execFileSync(
    FFPROBE,
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', '-show_chapters', filePath],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
  return JSON.parse(output);
}

/** Executa o ffmpeg com os argumentos dados e devolve {code, stdout, stderr}. */
function runFfmpeg(args) {
  try {
    const stdout = execFileSync(FFMPEG, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
    return { code: 0, stdout, stderr: '' };
  } catch (error) {
    return { code: error.status ?? 1, stdout: String(error.stdout || ''), stderr: String(error.stderr || '') };
  }
}

/** Fonte no formato que o motor espera. */
function sourceFor(filePath, overrides = {}) {
  const info = probe(filePath);
  const video = (info.streams || []).find((stream) => stream.codec_type === 'video');
  const audio = (info.streams || []).find((stream) => stream.codec_type === 'audio');
  return {
    path: filePath,
    width: video?.width || 1280,
    height: video?.height || 720,
    hasAudio: Boolean(audio),
    duration: Number(info.format?.duration) || 6,
    ...overrides
  };
}

module.exports = { FFMPEG, FFPROBE, workDir, createTestVideo, createTestPng, probe, runFfmpeg, sourceFor };
