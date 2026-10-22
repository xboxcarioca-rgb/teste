/**
 * Criação e gestão da janela principal.
 */

const path = require('path');
const { BrowserWindow, shell } = require('electron');
const { getLogger } = require('./logger');

/**
 * @param {object} options
 * @param {boolean} [options.dev] abre o DevTools
 * @param {string} [options.preloadPath]
 * @returns {BrowserWindow}
 */
function createMainWindow(options = {}) {
  const log = getLogger();
  const preloadPath = options.preloadPath || path.join(__dirname, '..', 'preload', 'index.js');

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 700,
    show: false,
    backgroundColor: '#0B0B0F',
    title: 'Viral Cut Studio',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      webSecurity: true,
      additionalArguments: [`--vcs-dev=${options.dev ? '1' : '0'}`]
    }
  });

  win.once('ready-to-show', () => {
    win.show();
    if (options.dev) win.webContents.openDevTools({ mode: 'detach' });
  });

  // Links externos abrem no navegador padrão, nunca dentro do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const current = win.webContents.getURL();
    if (url !== current && /^https?:\/\//i.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.on('closed', () => log.info('Janela principal fechada.'));
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  return win;
}

module.exports = { createMainWindow };
