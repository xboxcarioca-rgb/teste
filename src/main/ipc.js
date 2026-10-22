/**
 * Registro de todos os handlers IPC.
 *
 * Convenções:
 *  - `ipcMain.handle` para pedidos/respostas;
 *  - eventos de progresso são enviados por `ctx.send(canal, payload)`;
 *  - todo trabalho longo cria um job (cancelável) e emite `job:event`.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { ipcMain, dialog, shell, app } = require('electron');

const { IPC } = require('../common/ipc');
const constants = require('../common/defaults');
const formats = require('../common/formats');
const time = require('../common/time');
const { proposeCuts } = require('../engine/cuts');
const { renderClip } = require('../engine/render');
const { buildRenderCommand } = require('../engine/ffmpeg-args');
const { computeGeometry } = require('../engine/geometry');
const { inspectMetadata, describeMetadata } = require('../engine/metadata');
const { analyzeMedia } = require('../engine/analyze');
const { prepareAssets } = require('../engine/assets');
const { probeMedia, extractThumbnail } = require('../tools/probe');
const { resolveFontFile } = require('../tools/fonts');
const { installYtDlp, fetchUrlInfo, downloadUrl } = require('../tools/ytdlp');
const { installWhisper, downloadModel, transcribe } = require('../tools/whisper');
const { toMediaUrl } = require('../common/media-url');
const { tempDirFor } = require('./services');
const { getLogger } = require('./logger');
const { removeDir } = require('./paths');

const MEDIA_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v', '.mp3', '.m4a', '.wav', '.flac'];

/**
 * @param {object} ctx
 * @param {import('./services').Services} ctx.services
 * @param {import('./settings').SettingsStore} ctx.settings
 * @param {import('./templates').TemplateStore} ctx.templates
 * @param {import('./jobs').JobManager} ctx.jobs
 * @param {object} ctx.paths
 * @param {(channel:string,payload:any)=>void} ctx.send
 */
function registerIpc(ctx) {
  const { services, settings, templates, jobs, paths, send } = ctx;
  const log = getLogger();

  /** Encaminha mudanças de job para a interface. */
  jobs.on('change', (job) => send('job:event', job));

  const requireFfmpeg = async () => {
    const info = await services.ffmpegInfo();
    if (!info.ffmpegPath) {
      throw new Error(
        'FFmpeg não encontrado. Ele vem embutido no instalador; se você apagou a pasta, reinstale o aplicativo ou aponte o caminho em Configurações › Ferramentas.'
      );
    }
    return info;
  };

  // ------------------------------------------------------------ aplicativo --
  ipcMain.handle(IPC.APP_INFO, () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    platform: process.platform,
    arch: process.arch,
    isPortable: Boolean(process.env.PORTABLE_EXECUTABLE_FILE),
    locale: app.getLocale(),
    paths: {
      userData: paths.root,
      downloads: services.downloadsDir(),
      output: services.outputDir(),
      logs: paths.logs,
      bin: paths.bin,
      models: paths.models
    },
    home: os.homedir()
  }));

  ipcMain.handle(IPC.CONSTANTS_GET, () => ({
    formats: formats.FORMATS,
    layouts: formats.LAYOUTS,
    splitRecommended: formats.SPLIT_RECOMMENDED_FORMATS,
    anchors: constants.ANCHORS,
    bannerPositions: constants.BANNER_POSITIONS,
    subtitleAnimations: constants.SUBTITLE_ANIMATIONS,
    whisperModels: constants.WHISPER_MODELS,
    defaults: {
      output: constants.DEFAULT_OUTPUT,
      subtitles: constants.DEFAULT_SUBTITLES,
      bannerText: constants.DEFAULT_BANNER_TEXT,
      bannerLogo: constants.DEFAULT_BANNER_LOGO,
      progressBar: constants.DEFAULT_PROGRESS_BAR,
      cutSettings: constants.DEFAULT_CUT_SETTINGS
    },
    builtinTemplates: constants.BUILTIN_TEMPLATES.map(({ id, name, description }) => ({ id, name, description }))
  }));

  ipcMain.handle(IPC.APP_SETTINGS_GET, () => settings.all());

  ipcMain.handle(IPC.APP_SETTINGS_SET, (_event, patch) => {
    const updated = settings.update(patch || {});
    // Mudanças em ferramentas invalidam os caches.
    if (patch?.tools) {
      services.ffmpeg = null;
      services.ytDlpPath = null;
      services.whisperPath = null;
    }
    return updated;
  });

  ipcMain.handle(IPC.APP_OPEN_PATH, async (_event, target, mode = 'folder') => {
    if (!target) return { ok: false, error: 'Caminho vazio.' };
    try {
      if (mode === 'folder') {
        const finalTarget = fs.existsSync(target) && fs.statSync(target).isFile() ? path.dirname(target) : target;
        await fsp.mkdir(finalTarget, { recursive: true }).catch(() => {});
        const result = await shell.openPath(finalTarget);
        return { ok: !result, error: result || null };
      }
      shell.showItemInFolder(target);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error.message || error) };
    }
  });

  ipcMain.handle(IPC.APP_QUIT, () => {
    app.quit();
    return { ok: true };
  });

  // --------------------------------------------------------------- diálogos --
  const openFileDialog = async (options) => {
    const result = await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  };

  ipcMain.handle(IPC.DIALOG_OPEN_MEDIA, async () => {
    const filePath = await openFileDialog({
      title: 'Escolha o vídeo ou áudio',
      properties: ['openFile'],
      filters: [
        { name: 'Mídia', extensions: MEDIA_EXTENSIONS.map((ext) => ext.slice(1)) },
        { name: 'Todos os arquivos', extensions: ['*'] }
      ]
    });
    if (!filePath) return null;
    const info = await services.ffmpegInfo();
    if (!info.ffprobePath) return { path: filePath, probe: null, error: 'ffprobe indisponível' };
    const probe = await probeMedia(info.ffprobePath, filePath);
    return { path: filePath, probe, mediaUrl: toMediaUrl(filePath) };
  });

  ipcMain.handle(IPC.DIALOG_OPEN_IMAGE, async () =>
    openFileDialog({
      title: 'Escolha a imagem do banner/logo',
      properties: ['openFile'],
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] }]
    })
  );

  ipcMain.handle(IPC.DIALOG_OPEN_SUBTITLE, async () =>
    openFileDialog({
      title: 'Importar legendas',
      properties: ['openFile'],
      filters: [{ name: 'Legendas', extensions: ['srt', 'vtt', 'ass', 'txt', 'json'] }]
    })
  );

  ipcMain.handle(IPC.DIALOG_OPEN_FONT, async () =>
    openFileDialog({
      title: 'Escolha o arquivo de fonte',
      properties: ['openFile'],
      filters: [{ name: 'Fontes', extensions: ['ttf', 'otf', 'ttc'] }]
    })
  );

  ipcMain.handle(IPC.DIALOG_CHOOSE_DIR, async (_event, title = 'Escolha a pasta') =>
    openFileDialog({ title, properties: ['openDirectory', 'createDirectory'] })
  );

  ipcMain.handle(IPC.DIALOG_SAVE_PROJECT, async (_event, suggestedName) => {
    const result = await dialog.showSaveDialog({
      title: 'Salvar projeto',
      defaultPath: `${time.sanitizeFilename(suggestedName || 'projeto', 'projeto')}.vcs.json`,
      filters: [{ name: 'Projeto Viral Cut Studio', extensions: ['json'] }]
    });
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle(IPC.DIALOG_OPEN_PROJECT, async () =>
    openFileDialog({
      title: 'Abrir projeto',
      properties: ['openFile'],
      filters: [{ name: 'Projeto Viral Cut Studio', extensions: ['json'] }]
    })
  );

  // ------------------------------------------------------------- ferramentas -
  ipcMain.handle(IPC.TOOLS_STATUS, async (_event, force = false) => {
    if (force) {
      services.ffmpeg = null;
      services.ytDlpPath = null;
      services.whisperPath = null;
    }
    return services.status();
  });

  ipcMain.handle(IPC.FONTS_LIST, (_event, force = false) => services.fonts(force));

  /** Instala uma ferramenta externa como job cancelável. */
  ipcMain.handle(IPC.TOOLS_INSTALL, async (_event, request) => {
    const tool = String(request?.tool || '');
    const job = jobs.create({
      kind: 'tool-install',
      name: `Instalar ${tool}`,
      concurrent: true
    });

    const promise = jobs.run(job.id, async ({ signal, progress }) => {
      progress(2, 'Preparando…');
      if (tool === 'ytdlp') {
        const binaryPath = await installYtDlp({
          binDir: paths.bin,
          signal,
          onProgress: (event) => {
            progress(event.percent ?? 5, event.message);
            send(IPC.TOOLS_PROGRESS, { jobId: job.id, tool, ...event });
          }
        });
        services.ytDlpPath = binaryPath;
        return { tool, path: binaryPath };
      }

      if (tool === 'whisper') {
        const binaryPath = await installWhisper({
          binDir: paths.bin,
          signal,
          onProgress: (event) => {
            progress(event.percent ?? 5, event.message);
            send(IPC.TOOLS_PROGRESS, { jobId: job.id, tool, ...event });
          }
        });
        services.whisperPath = binaryPath;
        return { tool, path: binaryPath };
      }

      if (tool === 'whisper-model') {
        const modelId = String(request.modelId || 'small');
        const modelPath = await downloadModel({
          modelId,
          modelsDir: paths.models,
          signal,
          customUrl: request.customUrl,
          onProgress: (event) => {
            progress(event.percent ?? 5, event.message);
            send(IPC.TOOLS_PROGRESS, { jobId: job.id, tool, ...event });
          }
        });
        settings.set('tools.whisperModelPath', modelPath);
        return { tool, path: modelPath, modelId };
      }

      throw new Error(`Ferramenta desconhecida: ${tool}`);
    });

    return promise
      .then((result) => ({ ok: true, jobId: job.id, result }))
      .catch((error) => ({ ok: false, jobId: job.id, error: String(error.message || error) }));
  });

  // ------------------------------------------------------------------ mídia --
  ipcMain.handle(IPC.MEDIA_PROBE, async (_event, filePath) => {
    const info = await requireFfmpeg();
    if (!info.ffprobePath) throw new Error('ffprobe indisponível — não consigo ler as informações do vídeo.');
    const probe = await probeMedia(info.ffprobePath, filePath);
    return { ...probe, mediaUrl: toMediaUrl(filePath) };
  });

  ipcMain.handle(IPC.MEDIA_THUMBNAIL, async (_event, request) => {
    const info = await requireFfmpeg();
    const { filePath, time: at = 1, width = 420 } = request || {};
    if (!filePath || !fs.existsSync(filePath)) throw new Error('Arquivo de vídeo não encontrado.');
    const hash = `${Buffer.from(filePath).toString('base64url').slice(0, 24)}_${Math.round(at)}_${width}.jpg`;
    const outPath = path.join(paths.cache, hash);
    if (!fs.existsSync(outPath)) await extractThumbnail(info.ffmpegPath, filePath, outPath, { time: at, width });
    return { path: outPath, url: toMediaUrl(outPath) };
  });

  // ------------------------------------------------------- download por link -
  ipcMain.handle(IPC.URL_INFO, async (_event, url) => {
    if (!/^https?:\/\//i.test(String(url || ''))) throw new Error('Informe um link válido (http/https).');
    let ytDlpPath = await services.ytDlp();
    if (!ytDlpPath) {
      if (!settings.get('tools.autoDownloadTools', true)) {
        throw new Error('yt-dlp não instalado. Ative o download automático em Configurações ou instale em Ferramentas.');
      }
      const job = jobs.create({ kind: 'tool-install', name: 'Instalar yt-dlp', concurrent: true });
      await jobs.run(job.id, ({ signal, progress }) =>
        installYtDlp({
          binDir: paths.bin,
          signal,
          onProgress: (event) => progress(event.percent ?? 5, event.message)
        })
      );
      ytDlpPath = await services.ytDlp(true);
    }
    if (!ytDlpPath) throw new Error('Não foi possível obter o yt-dlp.');
    return fetchUrlInfo(ytDlpPath, url);
  });

  ipcMain.handle(IPC.URL_DOWNLOAD, async (_event, request) => {
    const url = String(request?.url || '');
    if (!/^https?:\/\//i.test(url)) throw new Error('Informe um link válido (http/https).');

    const job = jobs.create({ kind: 'download', name: `Baixar ${url.slice(0, 60)}`, concurrent: true });
    const outputDir = request.outputDir || services.downloadsDir();

    const promise = jobs.run(job.id, async ({ signal, progress }) => {
      let ytDlpPath = await services.ytDlp();
      if (!ytDlpPath) {
        progress(1, 'Instalando yt-dlp…');
        ytDlpPath = await installYtDlp({
          binDir: paths.bin,
          signal,
          onProgress: (event) => progress(Math.min(20, event.percent ?? 5), event.message)
        });
        services.ytDlpPath = ytDlpPath;
      }

      progress(5, 'Iniciando download…');
      const result = await downloadUrl({
        ytDlpPath,
        url,
        outputDir,
        options: request.options || {},
        signal,
        onProgress: (event) => {
          progress(event.percent ?? 5, event.message);
          send(IPC.URL_DOWNLOAD_PROGRESS, { jobId: job.id, ...event });
        }
      });

      const info = await services.ffmpegInfo();
      let probe = null;
      if (info.ffprobePath) {
        try {
          probe = await probeMedia(info.ffprobePath, result.filePath);
        } catch (error) {
          log.warn('Falha ao ler o arquivo baixado.', { error: String(error.message || error) });
        }
      }
      settings.addRecentProject({ path: result.filePath, kind: 'download', title: probe?.raw?.format?.tags?.title || path.basename(result.filePath) });
      return { filePath: result.filePath, probe, mediaUrl: toMediaUrl(result.filePath) };
    });

    return promise
      .then((result) => ({ ok: true, jobId: job.id, result }))
      .catch((error) => ({ ok: false, jobId: job.id, error: String(error.message || error) }));
  });

  ipcMain.handle(IPC.URL_DOWNLOAD_CANCEL, (_event, jobId) => ({ ok: jobs.cancel(jobId) }));

  // ------------------------------------------------- análise e cortes virais -
  ipcMain.handle(IPC.ANALYZE_RUN, async (_event, request) => {
    const info = await requireFfmpeg();
    const { filePath, duration, hasAudio = true, cutSettings = {} } = request || {};
    if (!filePath || !fs.existsSync(filePath)) throw new Error('Arquivo não encontrado para análise.');

    const job = jobs.create({ kind: 'analyze', name: `Analisar ${path.basename(filePath)}`, concurrent: true });
    const promise = jobs.run(job.id, async ({ signal, progress }) => {
      const analysis = await analyzeMedia({
        ffmpegPath: info.ffmpegPath,
        filePath,
        duration,
        hasAudio,
        settings: cutSettings,
        signal,
        onProgress: (event) => {
          progress(event.percent, event.message);
          send(IPC.ANALYZE_PROGRESS, { jobId: job.id, ...event });
        }
      });
      const cuts = proposeCuts({
        duration,
        speech: analysis.speech,
        energy: analysis.energy,
        scenes: analysis.scenes,
        settings: cutSettings
      });
      return { analysis, cuts };
    });

    return promise
      .then((result) => ({ ok: true, jobId: job.id, result }))
      .catch((error) => ({ ok: false, jobId: job.id, error: String(error.message || error) }));
  });

  ipcMain.handle(IPC.ANALYZE_CANCEL, (_event, jobId) => ({ ok: jobs.cancel(jobId) }));

  /** Recalcula os cortes a partir de uma análise já pronta (mudou parâmetro). */
  ipcMain.handle(IPC.CUTS_PROPOSE, (_event, request) => {
    const { duration, analysis = {}, cutSettings = {} } = request || {};
    return {
      cuts: proposeCuts({
        duration,
        speech: analysis.speech || [],
        energy: analysis.energy || [],
        scenes: analysis.scenes || [],
        settings: cutSettings
      })
    };
  });

  // --------------------------------------------- transcrição e legendas -----
  ipcMain.handle(IPC.TRANSCRIBE_RUN, async (_event, request) => {
    const info = await requireFfmpeg();
    const { filePath, duration = 0, language = 'pt', modelId = 'small', translate = false } = request || {};
    if (!filePath || !fs.existsSync(filePath)) throw new Error('Arquivo não encontrado para transcrição.');

    const job = jobs.create({ kind: 'transcribe', name: `Transcrever ${path.basename(filePath)}`, concurrent: true });

    const promise = jobs.run(job.id, async ({ signal, progress }) => {
      progress(1, 'Verificando Whisper…');
      let whisperPath = await services.whisper();
      if (!whisperPath) {
        if (!settings.get('tools.autoDownloadTools', true)) {
          throw new Error('Whisper não instalado. Instale em Ferramentas › Legendas automáticas, ou importe um .srt.');
        }
        progress(2, 'Baixando Whisper (whisper.cpp)…');
        whisperPath = await installWhisper({
          binDir: paths.bin,
          signal,
          onProgress: (event) => progress(Math.min(15, event.percent ?? 5), event.message)
        });
        services.whisperPath = whisperPath;
      }

      let modelPath = services.whisperModelPath();
      if (!modelPath || (modelId && !modelPath.toLowerCase().includes(modelId.toLowerCase()))) {
        const wanted = modelId || 'small';
        progress(10, `Baixando modelo ${wanted}…`);
        modelPath = await downloadModel({
          modelId: wanted,
          modelsDir: paths.models,
          signal,
          onProgress: (event) => progress(Math.min(35, 10 + (event.percent ?? 0) * 0.25), event.message)
        });
        settings.set('tools.whisperModelPath', modelPath);
      }

      const workDir = tempDirFor(paths, job.id);
      try {
        const output = await transcribe({
          whisperPath,
          modelPath,
          mediaPath: filePath,
          workDir,
          ffmpegPath: info.ffmpegPath,
          language,
          translate,
          duration,
          signal,
          onProgress: (event) => {
            progress(Math.max(35, Math.min(99, event.percent ?? 40)), event.message);
            send(IPC.TRANSCRIBE_PROGRESS, { jobId: job.id, ...event });
          }
        });

        let cues = [];
        if (output.jsonPath && fs.existsSync(output.jsonPath)) {
          try {
            cues = time.parseWhisperJson(JSON.parse(fs.readFileSync(output.jsonPath, 'utf8')));
          } catch (error) {
            log.warn('JSON do Whisper inválido, usando o SRT.', { error: String(error.message || error) });
          }
        }
        if (!cues.length && output.srtPath && fs.existsSync(output.srtPath)) {
          cues = time.parseSrt(fs.readFileSync(output.srtPath, 'utf8'));
        }
        if (!cues.length) throw new Error('A transcrição não gerou legendas.');

        return { cues, srtPath: output.srtPath, jsonPath: output.jsonPath, modelPath };
      } finally {
        removeDir(workDir);
      }
    });

    return promise
      .then((result) => ({ ok: true, jobId: job.id, result }))
      .catch((error) => ({ ok: false, jobId: job.id, error: String(error.message || error) }));
  });

  ipcMain.handle(IPC.TRANSCRIBE_CANCEL, (_event, jobId) => ({ ok: jobs.cancel(jobId) }));

  ipcMain.handle(IPC.SUBTITLES_IMPORT, async (_event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) throw new Error('Arquivo de legenda não encontrado.');
    const content = await fsp.readFile(filePath, 'utf8');
    const extension = path.extname(filePath).toLowerCase();
    let cues = [];
    if (extension === '.vtt') cues = time.parseVtt(content);
    else if (extension === '.json') cues = time.parseWhisperJson(JSON.parse(content));
    else cues = time.parseSrt(content);

    if (!cues.length) throw new Error('Nenhuma legenda encontrada no arquivo. Verifique o formato (SRT/VTT).');
    return { cues, path: filePath, extension };
  });

  ipcMain.handle(IPC.SUBTITLES_EXPORT, async (_event, request) => {
    const { cues = [], filePath } = request || {};
    if (!filePath) throw new Error('Informe onde salvar.');
    const extension = path.extname(filePath).toLowerCase();
    const content = extension === '.vtt' ? `WEBVTT\n\n${time.toSrt(cues).replace(/,/g, '.')}` : time.toSrt(cues);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, content, 'utf8');
    return { ok: true, path: filePath, count: cues.length };
  });

  // ------------------------------------------------------------- templates --
  ipcMain.handle(IPC.TEMPLATES_LIST, () => templates.list());

  ipcMain.handle(IPC.TEMPLATES_SAVE, (_event, request) => {
    if (request?.project) return templates.saveFromProject(request.project, { name: request.name, description: request.description });
    return templates.save(request);
  });

  ipcMain.handle(IPC.TEMPLATES_DELETE, (_event, id) => ({ ok: templates.delete(id) }));

  // -------------------------------------------------------------- projetos --
  ipcMain.handle(IPC.PROJECT_NEW, () => {
    const project = constants.createDefaultProject();
    return templates.applyToProject(project, settings.get('defaults.templateId', 'reels-viral'));
  });

  ipcMain.handle(IPC.PROJECT_SAVE, async (_event, request) => {
    const { project, filePath } = request || {};
    if (!project) throw new Error('Projeto vazio.');
    const target = filePath || path.join(paths.projects, `${time.sanitizeFilename(project.name, 'projeto')}.vcs.json`);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    const payload = { ...project, savedAt: new Date().toISOString(), appVersion: app.getVersion() };
    await fsp.writeFile(target, JSON.stringify(payload, null, 2), 'utf8');
    settings.addRecentProject({ path: target, kind: 'project', title: project.name });
    return { ok: true, path: target };
  });

  ipcMain.handle(IPC.PROJECT_LOAD, async (_event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) throw new Error('Projeto não encontrado.');
    const parsed = JSON.parse(await fsp.readFile(filePath, 'utf8'));
    const project = constants.deepMerge(constants.createDefaultProject(), parsed);
    project.id = parsed.id || project.id;
    settings.addRecentProject({ path: filePath, kind: 'project', title: project.name });
    return project;
  });

  // ----------------------------------------------------------- renderização --
  /** Valida o projeto antes de renderizar e devolve avisos. */
  ipcMain.handle(IPC.RENDER_VALIDATE, async (_event, request) => {
    const { project, sources = [] } = request || {};
    const problems = [];
    const warnings = [];
    const info = await services.ffmpegInfo();

    if (!info.ffmpegPath) problems.push('FFmpeg não encontrado.');
    if (!sources.length) problems.push('Nenhum vídeo de origem carregado.');
    if (!project?.segments?.length) problems.push('Nenhum corte selecionado.');

    const layout = formats.getLayout(project?.output?.layout || 'fill');
    if (layout.needsSecondSource) {
      const available = sources.filter((source) => source.path && fs.existsSync(source.path)).length;
      const needed = project.output.layout === 'split-v-triple' ? 3 : 2;
      if (available < needed) warnings.push(`"${layout.label}" usa ${needed} vídeos; você tem ${available}. Os painéis vazios vão repetir o primeiro vídeo.`);
    }

    if (project?.subtitles?.enabled && !project?.subtitles?.cues?.length) {
      warnings.push('Legendas ativadas, mas não há texto. Transcreva ou importe um .srt.');
    }
    if (project?.banner?.logo?.enabled && project?.banner?.logo?.path && !fs.existsSync(project.banner.logo.path)) {
      warnings.push('Arquivo de logo não encontrado; o render sairá sem logo.');
    }
    if (info.capabilities?.hasDrawtext === false && project?.banner?.text?.enabled) {
      problems.push('Este FFmpeg não tem drawtext (libfreetype); o banner de texto não funciona. Troque o FFmpeg em Configurações.');
    }
    if (info.capabilities?.hasSubtitles === false && project?.subtitles?.enabled) {
      problems.push('Este FFmpeg não tem libass; legendas queimadas não funcionam. Troque o FFmpeg em Configurações.');
    }

    const fonts = services.fonts();
    if (project?.subtitles?.enabled) {
      const resolved = resolveFontFile(project.subtitles.style?.font, { fonts, bold: project.subtitles.style?.bold });
      if (!resolved.matched && resolved.reason) warnings.push(resolved.reason);
    }

    return { ok: !problems.length, problems, warnings, ffmpeg: { path: info.ffmpegPath, version: info.capabilities?.version } };
  });

  /** Monta o comando sem executar (para o painel "ver comando FFmpeg"). */
  ipcMain.handle(IPC.RENDER_INSPECT_COMMAND, async (_event, request) => {
    const info = await requireFfmpeg();
    const { project, clip, sources } = request || {};
    const tempDir = tempDirFor(paths, `inspect_${Date.now()}`);
    try {
      const assets = prepareAssets({ project, clip, tempDir });
      const command = buildRenderCommand({ project, clip, sources, assets, caps: info.capabilities, outputPath: path.join(tempDir, 'saida.mp4') });
      return { args: command.args, warnings: command.warnings, geometry: command.geometry, encoder: command.encoder };
    } finally {
      removeDir(tempDir);
    }
  });

  /** Pré-visualização rápida (resolução baixa, poucos segundos). */
  ipcMain.handle(IPC.RENDER_PREVIEW, async (_event, request) => {
    const info = await requireFfmpeg();
    const { project, clip, sources } = request || {};
    const job = jobs.create({ kind: 'preview', name: 'Pré-visualização', concurrent: true });

    const promise = jobs.run(job.id, async ({ signal, progress }) => {
      const tempDir = tempDirFor(paths, job.id);
      const outputPath = path.join(paths.cache, `preview_${Date.now()}.mp4`);
      try {
        const previewProject = {
          ...project,
          output: {
            ...project.output,
            preview: { ...(project.output.preview || {}), enabled: true }
          }
        };
        const result = await renderClip({
          ffmpegPath: info.ffmpegPath,
          ffprobePath: info.ffprobePath,
          project: previewProject,
          clip,
          sources,
          outputPath,
          caps: info.capabilities,
          tempDir,
          preview: true,
          signal,
          onProgress: (event) => progress(event.percent, `Prévia… ${Math.round(event.percent)}%`)
        });
        if (!result.ok) throw new Error(result.error || 'Falha na pré-visualização.');
        return { outputPath, url: toMediaUrl(outputPath), warnings: result.warnings, durationMs: result.durationMs };
      } finally {
        removeDir(tempDir);
      }
    });

    return promise
      .then((result) => ({ ok: true, jobId: job.id, result }))
      .catch((error) => ({ ok: false, jobId: job.id, error: String(error.message || error) }));
  });

  /** Renderiza a fila de cortes (um por vez, com progresso por item). */
  ipcMain.handle(IPC.RENDER_START, async (_event, request) => {
    const info = await requireFfmpeg();
    const { project, clips = [], sources = [], outputDir } = request || {};
    if (!clips.length) throw new Error('Nenhum corte para renderizar.');

    const destination = outputDir || services.outputDir();
    await fsp.mkdir(destination, { recursive: true });

    const job = jobs.create({ kind: 'render', name: `Renderizar ${clips.length} corte(s)`, concurrent: false });

    const promise = jobs.run(job.id, async ({ signal, progress }) => {
      const results = [];
      for (let index = 0; index < clips.length; index += 1) {
        if (signal.aborted) break;
        const clip = clips[index];
        const baseProgress = (index / clips.length) * 100;
        const slice = 100 / clips.length;

        const filename = `${time.sanitizeFilename(
          require('../engine/cuts').buildFilename(project.output?.filenamePattern || '{title}-{format}-{index}', {
            title: project.name,
            format: project.output?.formatId || 'vertical',
            layout: project.output?.layout || 'fill',
            index: index + 1,
            score: clip.score,
            duration: clip.duration ?? clip.end - clip.start,
            start: clip.start
          }),
          'corte'
        )}.mp4`;
        const outputPath = uniquePath(path.join(destination, filename));
        const tempDir = tempDirFor(paths, `${job.id}_${index}`);

        progress(baseProgress, `Renderizando ${index + 1}/${clips.length}: ${path.basename(outputPath)}`);
        send(IPC.RENDER_EVENT, { jobId: job.id, stage: 'start', index, total: clips.length, outputPath });

        try {
          const result = await renderClip({
            ffmpegPath: info.ffmpegPath,
            ffprobePath: info.ffprobePath,
            project,
            clip,
            sources,
            outputPath,
            caps: info.capabilities,
            tempDir,
            signal,
            onProgress: (event) => {
              progress(baseProgress + slice * (event.percent / 100), `Corte ${index + 1}/${clips.length} — ${Math.round(event.percent)}%`);
              send(IPC.RENDER_EVENT, {
                jobId: job.id,
                stage: 'progress',
                index,
                total: clips.length,
                percent: Math.round(event.percent),
                speed: event.speed,
                fps: event.fps,
                etaSeconds: event.etaSeconds,
                outputPath
              });
            },
            onLog: (line) => log.debug(line.trim())
          });

          results.push({ index, ...result });
          send(IPC.RENDER_EVENT, {
            jobId: job.id,
            stage: result.ok ? 'done' : 'error',
            index,
            total: clips.length,
            outputPath,
            ok: result.ok,
            error: result.error || null,
            warnings: result.warnings || [],
            sizeBytes: result.sizeBytes || 0,
            metadata: result.metadataReport
              ? { clean: result.metadataReport.clean, totalTags: result.metadataReport.totalTags, description: describeMetadata(result.metadataReport) }
              : null,
            url: result.ok ? toMediaUrl(outputPath) : null
          });
        } finally {
          removeDir(tempDir);
        }
      }

      const succeeded = results.filter((result) => result.ok);
      return {
        total: clips.length,
        succeeded: succeeded.length,
        failed: results.length - succeeded.length,
        results: results.map((result) => ({
          index: result.index,
          ok: result.ok,
          outputPath: result.outputPath,
          error: result.error || null,
          warnings: result.warnings || [],
          sizeBytes: result.sizeBytes || 0,
          durationMs: result.durationMs || 0,
          metadataClean: result.metadataReport?.clean ?? null,
          url: result.ok ? toMediaUrl(result.outputPath) : null
        })),
        outputDir: destination
      };
    });

    return promise
      .then((result) => ({ ok: true, jobId: job.id, result }))
      .catch((error) => ({ ok: false, jobId: job.id, error: String(error.message || error) }));
  });

  ipcMain.handle(IPC.RENDER_CANCEL, (_event, jobId) => ({ ok: jobs.cancel(jobId) }));

  ipcMain.handle(IPC.RENDER_QUEUE, () => jobs.list());

  // ------------------------------------------------------------- metadados --
  ipcMain.handle(IPC.METADATA_INSPECT, async (_event, filePath) => {
    const info = await services.ffmpegInfo();
    if (!info.ffprobePath) throw new Error('ffprobe indisponível.');
    const probe = await probeMedia(info.ffprobePath, filePath);
    const report = inspectMetadata(probe.raw);
    return { ...report, description: describeMetadata(report), file: path.basename(filePath) };
  });
}

/** Evita sobrescrever arquivos existentes (nome-1.mp4, nome-2.mp4…). */
function uniquePath(filePath) {
  if (!fs.existsSync(filePath)) return filePath;
  const dir = path.dirname(filePath);
  const extension = path.extname(filePath);
  const base = path.basename(filePath, extension);
  for (let index = 1; index < 1000; index += 1) {
    const candidate = path.join(dir, `${base}-${index}${extension}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  return path.join(dir, `${base}-${Date.now()}${extension}`);
}

module.exports = { registerIpc, uniquePath, MEDIA_EXTENSIONS };
