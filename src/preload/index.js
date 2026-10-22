/**
 * Preload: expõe uma API mínima e explícita ao renderer via contextBridge.
 * Nada de `require` ou Node na página — só estes métodos.
 */

const { contextBridge, ipcRenderer } = require('electron');
const { IPC } = require('../common/ipc');
const { PROTOCOL, toMediaUrl } = require('../common/media-url');

/**
 * Registra um listener e devolve a função de cancelamento
 * (evita vazamento de listeners ao trocar de tela).
 */
function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

const api = {
  protocol: PROTOCOL,
  mediaUrl: (absolutePath) => toMediaUrl(absolutePath),

  app: {
    info: () => invoke(IPC.APP_INFO),
    getSettings: () => invoke(IPC.APP_SETTINGS_GET),
    setSettings: (patch) => invoke(IPC.APP_SETTINGS_SET, patch),
    openPath: (target, mode) => invoke(IPC.APP_OPEN_PATH, target, mode),
    quit: () => invoke(IPC.APP_QUIT),
    constants: () => invoke(IPC.CONSTANTS_GET)
  },

  dialog: {
    openMedia: () => invoke(IPC.DIALOG_OPEN_MEDIA),
    openImage: () => invoke(IPC.DIALOG_OPEN_IMAGE),
    openSubtitle: () => invoke(IPC.DIALOG_OPEN_SUBTITLE),
    openFont: () => invoke(IPC.DIALOG_OPEN_FONT),
    chooseDir: (title) => invoke(IPC.DIALOG_CHOOSE_DIR, title),
    saveProject: (name) => invoke(IPC.DIALOG_SAVE_PROJECT, name),
    openProject: () => invoke(IPC.DIALOG_OPEN_PROJECT)
  },

  tools: {
    status: (force) => invoke(IPC.TOOLS_STATUS, force),
    install: (request) => invoke(IPC.TOOLS_INSTALL, request),
    fonts: (force) => invoke(IPC.FONTS_LIST, force),
    onProgress: (callback) => subscribe(IPC.TOOLS_PROGRESS, callback)
  },

  media: {
    probe: (filePath) => invoke(IPC.MEDIA_PROBE, filePath),
    thumbnail: (request) => invoke(IPC.MEDIA_THUMBNAIL, request)
  },

  url: {
    info: (url) => invoke(IPC.URL_INFO, url),
    download: (request) => invoke(IPC.URL_DOWNLOAD, request),
    cancel: (jobId) => invoke(IPC.URL_DOWNLOAD_CANCEL, jobId),
    onProgress: (callback) => subscribe(IPC.URL_DOWNLOAD_PROGRESS, callback)
  },

  analysis: {
    run: (request) => invoke(IPC.ANALYZE_RUN, request),
    cancel: (jobId) => invoke(IPC.ANALYZE_CANCEL, jobId),
    proposeCuts: (request) => invoke(IPC.CUTS_PROPOSE, request),
    onProgress: (callback) => subscribe(IPC.ANALYZE_PROGRESS, callback)
  },

  subtitles: {
    transcribe: (request) => invoke(IPC.TRANSCRIBE_RUN, request),
    cancel: (jobId) => invoke(IPC.TRANSCRIBE_CANCEL, jobId),
    import: (filePath) => invoke(IPC.SUBTITLES_IMPORT, filePath),
    export: (request) => invoke(IPC.SUBTITLES_EXPORT, request),
    onProgress: (callback) => subscribe(IPC.TRANSCRIBE_PROGRESS, callback)
  },

  templates: {
    list: () => invoke(IPC.TEMPLATES_LIST),
    save: (request) => invoke(IPC.TEMPLATES_SAVE, request),
    delete: (id) => invoke(IPC.TEMPLATES_DELETE, id)
  },

  project: {
    create: () => invoke(IPC.PROJECT_NEW),
    save: (request) => invoke(IPC.PROJECT_SAVE, request),
    load: (filePath) => invoke(IPC.PROJECT_LOAD, filePath)
  },

  render: {
    validate: (request) => invoke(IPC.RENDER_VALIDATE, request),
    inspectCommand: (request) => invoke(IPC.RENDER_INSPECT_COMMAND, request),
    preview: (request) => invoke(IPC.RENDER_PREVIEW, request),
    start: (request) => invoke(IPC.RENDER_START, request),
    cancel: (jobId) => invoke(IPC.RENDER_CANCEL, jobId),
    queue: () => invoke(IPC.RENDER_QUEUE),
    onEvent: (callback) => subscribe(IPC.RENDER_EVENT, callback)
  },

  jobs: {
    list: () => invoke(IPC.RENDER_QUEUE),
    onChange: (callback) => subscribe('job:event', callback)
  },

  metadata: {
    inspect: (filePath) => invoke(IPC.METADATA_INSPECT, filePath)
  }
};

contextBridge.exposeInMainWorld('vcs', api);
