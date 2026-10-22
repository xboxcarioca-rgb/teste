/**
 * Viral Cut Studio — processo principal.
 *
 * Responsabilidades: janela, segurança (contextIsolation + protocolo próprio
 * para mídia local), configurações, templates, fila de jobs e registro do IPC.
 */

const path = require('path');
const fs = require('fs');
const { app, protocol, net, session } = require('electron');

const { createPaths, ensurePaths, removeDir } = require('./paths');
const { initLogger, getLogger } = require('./logger');
const { SettingsStore } = require('./settings');
const { TemplateStore } = require('./templates');
const { JobManager } = require('./jobs');
const { Services } = require('./services');
const { registerIpc } = require('./ipc');
const { createMainWindow } = require('./window');
const { PROTOCOL, fromMediaUrl } = require('../common/media-url');

// Registro do esquema precisa acontecer ANTES do app ficar pronto.
protocol.registerSchemesAsPrivileged([
  {
    scheme: PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: false
    }
  }
]);

const isDev = process.argv.includes('--devtools') || process.env.VCS_DEV === '1';

/** Impede múltiplas instâncias. */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  bootstrap();
}

let mainWindow = null;
let context = null;

function getMainWindow() {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
}

function bootstrap() {
  app.setName('Viral Cut Studio');

  app.on('ready', async () => {
    const paths = ensurePaths(createPaths(app.getPath('userData')));
    const log = initLogger({
      level: isDev ? 'debug' : 'info',
      file: path.join(paths.logs, 'viral-cut-studio.log')
    });

    log.info('Iniciando Viral Cut Studio.', { version: app.getVersion(), platform: process.platform, arch: process.arch, isDev });

    // Protocolo de mídia: só serve arquivos de diretórios permitidos.
    const allowedRoots = [
      paths.cache,
      paths.temp,
      paths.downloads,
      paths.output,
      paths.projects,
      require('os').homedir()
    ].map((dir) => path.resolve(dir));

    protocol.handle(PROTOCOL, (request) => {
      try {
        const url = new URL(request.url);
        const filePath = fromMediaUrl(`${PROTOCOL}://file/${url.pathname.replace(/^\/+/, '')}`);
        if (!filePath) return new Response('Caminho inválido', { status: 400 });

        const resolved = path.resolve(filePath);
        const allowed = allowedRoots.some((root) => resolved === root || resolved.startsWith(root + path.sep));
        if (!allowed) {
          log.warn('Acesso negado pelo protocolo de mídia.', { resolved });
          return new Response('Acesso negado', { status: 403 });
        }
        if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
          return new Response('Arquivo não encontrado', { status: 404 });
        }
        return net.fetch(`file://${resolved}`);
      } catch (error) {
        log.error('Erro no protocolo de mídia.', { error: String(error.message || error) });
        return new Response('Erro interno', { status: 500 });
      }
    });

    const settings = new SettingsStore(paths.settingsFile);
    settings.update({ downloadsDir: settings.get('downloadsDir') || paths.downloads, outputDir: settings.get('outputDir') || paths.output });

    const templates = new TemplateStore(paths.templates);
    const jobs = new JobManager();
    const services = new Services({ paths, settings });

    context = {
      paths,
      settings,
      templates,
      jobs,
      services,
      send: (channel, payload) => {
        const win = getMainWindow();
        if (win) win.webContents.send(channel, payload);
      }
    };

    registerIpc(context);

    // CSP restritiva para a página local.
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
              `img-src 'self' data: ${PROTOCOL}:; ` +
              `media-src 'self' ${PROTOCOL}: blob:; ` +
              "style-src 'self' 'unsafe-inline'; " +
              "script-src 'self'; " +
              "connect-src 'self' https:; " +
              "font-src 'self' data:; " +
              "worker-src 'self' blob:"
          ]
        }
      });
    });

    mainWindow = createMainWindow({ dev: isDev });
    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    // Resolve o FFmpeg em segundo plano (a UI mostra o status quando chegar).
    services
      .ffmpegInfo()
      .then((info) => {
        if (!info.ffmpegPath) {
          log.error('FFmpeg não encontrado no sistema nem embutido.');
          return;
        }
        log.info('FFmpeg pronto.', { version: info.capabilities?.version, source: info.source });
      })
      .catch((error) => log.error('Falha ao detectar FFmpeg.', { error: String(error.message || error) }));

    // Limpa temporários de execuções anteriores.
    try {
      for (const entry of fs.readdirSync(paths.temp)) removeDir(path.join(paths.temp, entry));
    } catch {
      /* nada a limpar */
    }

    jobs.on('change', () => jobs.prune(40));
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (!getMainWindow() && context) {
      mainWindow = createMainWindow({ dev: isDev });
    }
  });

  app.on('before-quit', () => {
    try {
      context?.settings.saveNow();
      for (const job of context?.jobs.list() || []) {
        if (job.status === 'running' || job.status === 'queued') context.jobs.cancel(job.id);
      }
    } catch {
      /* saída limpa é melhor esforço */
    }
  });

  process.on('uncaughtException', (error) => {
    getLogger().error('Exceção não capturada.', { error: String(error?.stack || error) });
  });
  process.on('unhandledRejection', (reason) => {
    getLogger().error('Promessa rejeitada sem tratamento.', { reason: String(reason?.message || reason) });
  });
}
