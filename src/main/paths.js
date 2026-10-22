/**
 * Caminhos usados pelo aplicativo.
 *
 * Tudo derivado de um único "diretório de dados" para funcionar igual no
 * instalador (Windows), no modo portable e em testes automatizados.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * @param {string} userDataDir diretório de dados do app (app.getPath('userData'))
 * @returns {object} mapa de caminhos
 */
function createPaths(userDataDir) {
  const root = userDataDir;
  const paths = {
    root,
    bin: path.join(root, 'bin'),
    models: path.join(root, 'models'),
    logs: path.join(root, 'logs'),
    cache: path.join(root, 'cache'),
    temp: path.join(root, 'temp'),
    templates: path.join(root, 'templates'),
    settingsFile: path.join(root, 'settings.json'),
    fontCacheFile: path.join(root, 'cache', 'fonts.json'),
    downloads: path.join(os.homedir(), 'Downloads', 'ViralCutStudio'),
    output: path.join(os.homedir(), 'Videos', 'ViralCutStudio'),
    projects: path.join(root, 'projects')
  };
  return paths;
}

/** Cria todos os diretórios gerenciados. */
function ensurePaths(paths) {
  for (const key of ['root', 'bin', 'models', 'logs', 'cache', 'temp', 'templates', 'downloads', 'output', 'projects']) {
    try {
      fs.mkdirSync(paths[key], { recursive: true });
    } catch {
      /* diretório pode ser inacessível; o app continua */
    }
  }
  return paths;
}

/** Diretório temporário exclusivo de um job (evita colisão entre renders). */
function jobTempDir(paths, jobId) {
  const dir = path.join(paths.temp, String(jobId).replace(/[^\w.-]/g, '_'));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Remove um diretório temporário (melhor esforço). */
function removeDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

module.exports = { createPaths, ensurePaths, jobTempDir, removeDir };
