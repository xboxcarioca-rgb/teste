/**
 * Execução do FFmpeg: progresso, cancelamento e fallback automático.
 *
 * Se o encoder de hardware (NVENC/QSV/VideoToolbox) falhar — comum quando o
 * driver está desatualizado — o render é repetido em CPU sem o usuário perder
 * o trabalho.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { buildRenderCommand, buildPreviewCommand } = require('./ffmpeg-args');
const { prepareAssets } = require('./assets');
const { createProgressParser, extractError, isHardwareEncoderFailure } = require('./progress');
const { inspectMetadata } = require('./metadata');

/**
 * Executa o FFmpeg e reporta progresso.
 *
 * @param {object} params
 * @param {string} params.ffmpegPath
 * @param {string[]} params.args
 * @param {number} params.totalDuration
 * @param {(event:object)=>void} [params.onProgress]
 * @param {(line:string)=>void} [params.onLog]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{ok:boolean,code:number,error:string,stderr:string,percent:number}>}
 */
function runFfmpeg({ ffmpegPath, args, totalDuration, onProgress, onLog, signal }) {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    const parser = createProgressParser(totalDuration);
    let stderr = '';
    let killed = false;
    let lastPercent = -1;

    const onAbort = () => {
      killed = true;
      try {
        child.kill('SIGTERM');
      } catch {
        /* já finalizado */
      }
      setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* ignore */
        }
      }, 1500).unref?.();
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    child.stdout.on('data', (data) => {
      const events = parser.push(data.toString());
      for (const event of events) {
        if (event.percent !== lastPercent) {
          lastPercent = event.percent;
          if (onProgress) onProgress(event);
        }
      }
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text.length > 200000 ? text.slice(-100000) : text;
      if (stderr.length > 400000) stderr = stderr.slice(-200000);
      if (onLog) onLog(text);
    });

    child.on('error', (error) => {
      resolve({ ok: false, code: -1, error: String(error.message || error), stderr, percent: 0 });
    });

    child.on('close', (code) => {
      if (signal) signal.removeEventListener('abort', onAbort);
      const snapshot = parser.snapshot();
      if (killed) {
        resolve({ ok: false, code, error: 'Render cancelado pelo usuário.', stderr, percent: snapshot.percent, cancelled: true });
        return;
      }
      if (code === 0) {
        resolve({ ok: true, code, error: '', stderr, percent: 100 });
      } else {
        resolve({ ok: false, code, error: extractError(stderr), stderr, percent: snapshot.percent });
      }
    });
  });
}

/**
 * Renderiza um corte completo.
 *
 * @param {object} params
 * @param {string} params.ffmpegPath
 * @param {string} [params.ffprobePath]
 * @param {object} params.project
 * @param {{start:number,end:number,duration:number,panes?:{start:number,end:number}[]}} params.clip
 * @param {{path:string,width:number,height:number,hasAudio:boolean,duration:number}[]} params.sources
 * @param {string} params.outputPath
 * @param {object} params.caps
 * @param {string} params.tempDir
 * @param {(event:object)=>void} [params.onProgress]
 * @param {(line:string)=>void} [params.onLog]
 * @param {AbortSignal} [params.signal]
 * @param {boolean} [params.preview]
 * @returns {Promise<object>}
 */
async function renderClip(params) {
  const { project, clip, sources, outputPath, caps, tempDir, onProgress, onLog, signal, ffprobePath } = params;
  const startedAt = Date.now();

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const assets = prepareAssets({ project, clip, tempDir });
  const warnings = [...assets.warnings];

  const build = project.output?.preview?.enabled && params.preview ? buildPreviewCommand : buildRenderCommand;
  let command = build({
    project,
    clip,
    sources,
    assets,
    caps,
    outputPath
  });
  warnings.push(...command.warnings);

  if (onLog) onLog(`ffmpeg ${command.args.join(' ')}\n`);

  let result = await runFfmpeg({
    ffmpegPath: params.ffmpegPath,
    args: command.args,
    totalDuration: command.duration,
    onProgress,
    onLog,
    signal
  });

  // Fallback: GPU -> CPU.
  if (!result.ok && !result.cancelled && command.hardware && isHardwareEncoderFailure(result.stderr)) {
    warnings.push('Encoder de hardware falhou; repetindo em CPU (libx264).');
    const cpuProject = {
      ...project,
      output: { ...project.output, hardwareAcceleration: 'none' }
    };
    command = build({ project: cpuProject, clip, sources, assets, caps: { ...caps, hardwareEncoders: [] }, outputPath });
    result = await runFfmpeg({
      ffmpegPath: params.ffmpegPath,
      args: command.args,
      totalDuration: command.duration,
      onProgress,
      onLog,
      signal
    });
  }

  assets.cleanup();

  if (!result.ok) {
    return {
      ok: false,
      cancelled: Boolean(result.cancelled),
      error: result.error,
      stderr: result.stderr.slice(-4000),
      warnings,
      outputPath,
      durationMs: Date.now() - startedAt
    };
  }

  // Verificação final: arquivo existe, tem tamanho e está limpo de metadados.
  let metadataReport = null;
  let mediaInfo = null;
  try {
    const stats = fs.statSync(outputPath);
    if (stats.size < 1024) throw new Error('Arquivo de saída muito pequeno — o render provavelmente falhou.');
    if (ffprobePath) {
      const { probeMedia } = require('../tools/probe');
      mediaInfo = await probeMedia(ffprobePath, outputPath);
      if (project.output?.stripMetadata !== false) metadataReport = inspectMetadata(mediaInfo.raw);
    }
  } catch (error) {
    return {
      ok: false,
      error: String(error.message || error),
      warnings,
      outputPath,
      durationMs: Date.now() - startedAt
    };
  }

  return {
    ok: true,
    outputPath,
    warnings,
    cues: assets.cues,
    geometry: command.geometry,
    encoder: command.encoder,
    metadataReport,
    mediaInfo,
    sizeBytes: fs.statSync(outputPath).size,
    durationMs: Date.now() - startedAt
  };
}

module.exports = { runFfmpeg, renderClip };
