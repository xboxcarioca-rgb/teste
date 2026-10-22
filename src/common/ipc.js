/**
 * Nomes de canais IPC. Centralizados para evitar strings soltas e typos.
 * Convenção: `dominio:acao`. Canais que emitem eventos do main para o renderer
 * terminam em `:event`.
 */

const IPC = {
  // Aplicativo
  APP_INFO: 'app:info',
  APP_SETTINGS_GET: 'app:settings:get',
  APP_SETTINGS_SET: 'app:settings:set',
  APP_OPEN_PATH: 'app:open-path',
  APP_QUIT: 'app:quit',

  // Diálogos
  DIALOG_OPEN_MEDIA: 'dialog:open-media',
  DIALOG_OPEN_IMAGE: 'dialog:open-image',
  DIALOG_OPEN_SUBTITLE: 'dialog:open-subtitle',
  DIALOG_OPEN_FONT: 'dialog:open-font',
  DIALOG_CHOOSE_DIR: 'dialog:choose-dir',
  DIALOG_SAVE_PROJECT: 'dialog:save-project',
  DIALOG_OPEN_PROJECT: 'dialog:open-project',

  // Ferramentas (ffmpeg / yt-dlp / whisper)
  TOOLS_STATUS: 'tools:status',
  TOOLS_ENSURE: 'tools:ensure',
  TOOLS_INSTALL: 'tools:install',
  TOOLS_PROGRESS: 'tools:progress:event',
  FONTS_LIST: 'fonts:list',

  // Mídia
  MEDIA_PROBE: 'media:probe',
  MEDIA_THUMBNAIL: 'media:thumbnail',
  MEDIA_PREVIEW_FRAME: 'media:preview-frame',

  // Download por link
  URL_INFO: 'url:info',
  URL_DOWNLOAD: 'url:download',
  URL_DOWNLOAD_CANCEL: 'url:download:cancel',
  URL_DOWNLOAD_PROGRESS: 'url:download:event',

  // Análise e cortes virais
  ANALYZE_RUN: 'analyze:run',
  ANALYZE_CANCEL: 'analyze:cancel',
  ANALYZE_PROGRESS: 'analyze:event',
  CUTS_PROPOSE: 'cuts:propose',

  // Transcrição / legendas
  TRANSCRIBE_RUN: 'transcribe:run',
  TRANSCRIBE_CANCEL: 'transcribe:cancel',
  TRANSCRIBE_PROGRESS: 'transcribe:event',
  SUBTITLES_IMPORT: 'subtitles:import',
  SUBTITLES_EXPORT: 'subtitles:export',

  // Templates
  TEMPLATES_LIST: 'templates:list',
  TEMPLATES_SAVE: 'templates:save',
  TEMPLATES_DELETE: 'templates:delete',

  // Projetos
  PROJECT_NEW: 'project:new',
  PROJECT_SAVE: 'project:save',
  PROJECT_LOAD: 'project:load',

  // Renderização
  RENDER_VALIDATE: 'render:validate',
  RENDER_INSPECT_COMMAND: 'render:inspect-command',
  RENDER_PREVIEW: 'render:preview',
  RENDER_START: 'render:start',
  RENDER_CANCEL: 'render:cancel',
  RENDER_EVENT: 'render:event',
  RENDER_QUEUE: 'render:queue',

  // Metadados
  METADATA_INSPECT: 'metadata:inspect',

  // Constantes compartilhadas com o renderer
  CONSTANTS_GET: 'constants:get'
};

module.exports = { IPC };
