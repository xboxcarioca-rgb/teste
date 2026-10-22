/**
 * Serviços do processo principal: estado resolvido das ferramentas externas
 * (FFmpeg, yt-dlp, Whisper), cache de fontes e capacidades.
 *
 * Tudo é resolvido sob demanda e memoizado — a interface chama `status` e
 * recebe um retrato consistente sem travar a inicialização do app.
 */

const path = require('path');
const fs = require('fs');
const { getFfmpeg, resolveFfmpeg, invalidateFfmpegCache } = require('../tools/ffmpeg');
const { resolveYtDlp } = require('../tools/ytdlp');
const { resolveWhisper, listModels, findLocalModel } = require('../tools/whisper');
const { listSystemFonts } = require('../tools/fonts');
const { getLogger } = require('./logger');

class Services {
  constructor({ paths, settings }) {
    this.paths = paths;
    this.settings = settings;
    this.ffmpeg = null;
    this.ytDlpPath = null;
    this.whisperPath = null;
    this.fonts = null;
    this.fontsLoadedAt = 0;
  }

  /** FFmpeg + ffprobe + capacidades (com cache). */
  async ffmpegInfo(force = false) {
    if (force) invalidateFfmpegCache();
    if (this.ffmpeg && !force && fs.existsSync(this.ffmpeg.ffmpegPath)) return this.ffmpeg;

    const tools = this.settings.get('tools', {});
    const resolved = await resolveFfmpeg({ binDir: this.paths.bin, settings: tools });
    this.ffmpeg = resolved;

    if (!resolved.ffmpegPath) {
      getLogger().warn('Nenhum FFmpeg encontrado. O app não consegue renderizar.');
    } else {
      getLogger().info('FFmpeg resolvido.', {
        path: resolved.ffmpegPath,
        source: resolved.source,
        version: resolved.capabilities?.version,
        drawtext: resolved.capabilities?.hasDrawtext,
        subtitles: resolved.capabilities?.hasSubtitles
      });
    }
    return resolved;
  }

  async ffmpegPath() {
    const info = await this.ffmpegInfo();
    return info.ffmpegPath;
  }

  async ffprobePath() {
    const info = await this.ffmpegInfo();
    return info.ffprobePath;
  }

  async capabilities() {
    const info = await this.ffmpegInfo();
    return info.capabilities || null;
  }

  /** yt-dlp (com cache). */
  async ytDlp(force = false) {
    if (this.ytDlpPath && !force && fs.existsSync(this.ytDlpPath)) return this.ytDlpPath;
    this.ytDlpPath = await resolveYtDlp({
      binDir: this.paths.bin,
      userPath: this.settings.get('tools.ytDlpPath', '')
    });
    return this.ytDlpPath;
  }

  /** whisper-cli (com cache). */
  async whisper(force = false) {
    if (this.whisperPath && !force && fs.existsSync(this.whisperPath)) return this.whisperPath;
    this.whisperPath = await resolveWhisper({
      binDir: this.paths.bin,
      userPath: this.settings.get('tools.whisperPath', '')
    });
    return this.whisperPath;
  }

  /** Modelos de Whisper disponíveis/instalados. */
  whisperModels() {
    return listModels(this.paths.models);
  }

  /** Caminho do modelo configurado (ou o padrão "small" se já baixado). */
  whisperModelPath() {
    const configured = this.settings.get('tools.whisperModelPath', '');
    if (configured && fs.existsSync(configured)) return configured;
    const preferred = findLocalModel(this.paths.models, 'small');
    if (preferred) return preferred;
    for (const modelId of ['base', 'tiny', 'medium', 'large-v3-turbo']) {
      const found = findLocalModel(this.paths.models, modelId);
      if (found) return found;
    }
    return null;
  }

  /** Fontes do sistema (cache de 7 dias em disco + 10 minutos em memória). */
  fonts(force = false) {
    const fresh = Date.now() - this.fontsLoadedAt < 10 * 60 * 1000;
    if (this.fonts && !force && fresh) return this.fonts;
    try {
      this.fonts = listSystemFonts({ cacheFile: this.paths.fontCacheFile });
      this.fontsLoadedAt = Date.now();
    } catch (error) {
      getLogger().warn('Falha ao listar fontes do sistema.', { error: String(error.message || error) });
      this.fonts = [];
    }
    return this.fonts;
  }

  /** Retrato completo para a tela de diagnóstico/ferramentas. */
  async status() {
    const ffmpegInfo = await this.ffmpegInfo();
    const [ytDlpPath, whisperPath] = await Promise.all([this.ytDlp(), this.whisper()]);
    return {
      ffmpeg: {
        available: Boolean(ffmpegInfo.ffmpegPath),
        path: ffmpegInfo.ffmpegPath,
        ffprobePath: ffmpegInfo.ffprobePath,
        source: ffmpegInfo.source,
        version: ffmpegInfo.capabilities?.version || null,
        capabilities: ffmpegInfo.serialized || null
      },
      ytDlp: {
        available: Boolean(ytDlpPath),
        path: ytDlpPath,
        hint: ytDlpPath ? null : 'Necessário para baixar vídeos por link. O app baixa automaticamente no primeiro uso.'
      },
      whisper: {
        available: Boolean(whisperPath),
        path: whisperPath,
        modelPath: this.whisperModelPath(),
        models: this.whisperModels(),
        hint: whisperPath ? null : 'Necessário para legendas automáticas. Você também pode importar um .srt.'
      },
      fonts: {
        count: this.fonts().length,
        families: uniqueFamilies(this.fonts()).slice(0, 400)
      },
      paths: {
        bin: this.paths.bin,
        models: this.paths.models,
        logs: this.paths.logs,
        downloads: this.paths.downloads,
        output: this.paths.output
      }
    };
  }

  /** Diretório de saída padrão (configurável). */
  outputDir() {
    const configured = this.settings.get('downloadsDir', '') || this.settings.get('outputDir', '');
    if (configured && typeof configured === 'string') return configured;
    return this.paths.output;
  }

  downloadsDir() {
    const configured = this.settings.get('downloadsDir', '');
    return configured && typeof configured === 'string' ? configured : this.paths.downloads;
  }
}

function uniqueFamilies(fonts) {
  const seen = new Set();
  const result = [];
  for (const font of fonts || []) {
    if (seen.has(font.family)) continue;
    seen.add(font.family);
    result.push(font.family);
  }
  return result.sort((a, b) => a.localeCompare(b));
}

/** Diretório temporário de um job, já criado. */
function tempDirFor(paths, jobId) {
  const dir = path.join(paths.temp, String(jobId).replace(/[^\w.-]/g, '_'));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { Services, tempDirFor, uniqueFamilies };
