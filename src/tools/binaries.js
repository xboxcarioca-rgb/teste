/**
 * Gerenciador de binários externos: download com progresso, verificação de
 * SHA-256, extração de arquivos e resolução de releases do GitHub.
 *
 * Nada aqui depende de Electron — quem chama informa os caminhos.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');

/** Cria diretórios recursivamente e devolve o caminho. */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** SHA-256 de um arquivo. */
async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

/**
 * Baixa um arquivo com progresso.
 *
 * @param {object} params
 * @param {string} params.url
 * @param {string} params.destPath
 * @param {string} [params.expectedSha256]
 * @param {(event:{received:number,total:number,percent:number,speedBps:number})=>void} [params.onProgress]
 * @param {AbortSignal} [params.signal]
 * @param {number} [params.timeoutMs]
 * @returns {Promise<{path:string,bytes:number,sha256:string}>}
 */
async function downloadFile({ url, destPath, expectedSha256, onProgress, signal, timeoutMs = 0 }) {
  ensureDir(path.dirname(destPath));
  const partial = `${destPath}.part`;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  }
  const timer = timeoutMs > 0 ? setTimeout(abort, timeoutMs) : null;

  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status} ao baixar ${url}`);

    const total = Number(response.headers.get('content-length')) || 0;
    const startedAt = Date.now();
    let received = 0;
    let lastEmit = 0;

    const fileStream = fs.createWriteStream(partial);
    const reader = response.body.getReader();

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      fileStream.write(Buffer.from(value));
      const now = Date.now();
      if (onProgress && (now - lastEmit > 120 || received === total)) {
        lastEmit = now;
        const elapsed = Math.max(0.2, (now - startedAt) / 1000);
        onProgress({
          received,
          total,
          percent: total ? Math.round((received / total) * 100) : 0,
          speedBps: Math.round(received / elapsed)
        });
      }
    }

    await new Promise((resolve, reject) => {
      fileStream.end(() => resolve());
      fileStream.on('error', reject);
    });

    const sha256 = await sha256File(partial);
    if (expectedSha256 && expectedSha256.toLowerCase() !== sha256.toLowerCase()) {
      await fsp.rm(partial, { force: true });
      throw new Error('Verificação de integridade falhou (SHA-256 diferente do publicado).');
    }

    await fsp.rm(destPath, { force: true });
    await fsp.rename(partial, destPath);
    if (process.platform !== 'win32') await fsp.chmod(destPath, 0o755).catch(() => {});

    return { path: destPath, bytes: received, sha256 };
  } finally {
    if (timer) clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', abort);
  }
}

/**
 * Busca o asset de um release do GitHub que casa com um padrão.
 * Usa a API pública (não precisa de token para uso esporádico).
 *
 * @param {object} params
 * @param {string} params.repo "dono/repositorio"
 * @param {RegExp} params.pattern
 * @param {'latest'|'first-with-assets'} [params.releaseStrategy]
 * @returns {Promise<{url:string,name:string,size:number,tag:string,checksumUrl:string|null}>}
 */
async function findGithubAsset({ repo, pattern, releaseStrategy = 'latest' }) {
  const headers = { 'User-Agent': 'ViralCutStudio/1.0', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const releasesUrl = `https://api.github.com/repos/${repo}/releases?per_page=10`;
  const response = await fetch(releaseStrategy === 'latest' ? `https://api.github.com/repos/${repo}/releases/latest` : releasesUrl, { headers });
  if (!response.ok) throw new Error(`GitHub API HTTP ${response.status} para ${repo}`);
  const payload = await response.json();
  const releases = Array.isArray(payload) ? payload : [payload];

  for (const release of releases) {
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const match = assets.find((asset) => pattern.test(asset.name));
    if (match) {
      const checksumAsset = assets.find((asset) => /^SHA2-256SUMS$/i.test(asset.name));
      return {
        url: match.browser_download_url,
        name: match.name,
        size: match.size || 0,
        tag: release.tag_name,
        checksumUrl: checksumAsset ? checksumAsset.browser_download_url : null
      };
    }
    if (releaseStrategy === 'latest') break;
  }
  throw new Error(`Nenhum asset encontrado para o padrão ${pattern} em ${repo}`);
}

/** Baixa o SHA2-256SUMS e devolve o hash do arquivo pedido. */
async function fetchChecksum(checksumUrl, fileName) {
  if (!checksumUrl) return null;
  try {
    const response = await fetch(checksumUrl);
    if (!response.ok) return null;
    const text = await response.text();
    const line = text.split('\n').find((entry) => entry.trim().endsWith(fileName));
    if (!line) return null;
    const hash = line.trim().split(/\s+/)[0];
    return /^[a-f0-9]{64}$/i.test(hash) ? hash : null;
  } catch {
    return null;
  }
}

/**
 * Extrai .zip ou .tar.gz.
 * No Windows usa o `tar` nativo (presente desde o Windows 10 1803) com
 * fallback para PowerShell Expand-Archive; em Linux/macOS usa `tar`.
 *
 * @param {string} archivePath
 * @param {string} destDir
 */
async function extractArchive(archivePath, destDir) {
  ensureDir(destDir);
  const isZip = /\.zip$/i.test(archivePath);

  const runCommand = (bin, args) =>
    new Promise((resolve, reject) => {
      execFile(bin, args, { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) reject(new Error(`${bin} falhou: ${stderr || error.message}`));
        else resolve(stdout);
      });
    });

  if (isZip && process.platform === 'win32') {
    try {
      await runCommand('tar.exe', ['-xf', archivePath, '-C', destDir]);
      return destDir;
    } catch {
      await runCommand('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`
      ]);
      return destDir;
    }
  }

  await runCommand('tar', ['-xf', archivePath, '-C', destDir]);
  return destDir;
}

/** Procura recursivamente um arquivo pelo nome (ou padrão). */
async function findFileRecursive(rootDir, predicate, maxDepth = 4) {
  const queue = [{ dir: rootDir, depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift();
    let entries = [];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && predicate(entry.name, full)) return full;
      if (entry.isDirectory() && depth < maxDepth) queue.push({ dir: full, depth: depth + 1 });
    }
  }
  return null;
}

/** Marca um arquivo como executável (POSIX). */
async function makeExecutable(filePath) {
  if (process.platform === 'win32') return;
  await fsp.chmod(filePath, 0o755).catch(() => {});
}

/** Testa se um binário responde. */
function testBinary(binPath, args = ['--version'], timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!binPath || !fs.existsSync(binPath)) {
      resolve(false);
      return;
    }
    const child = spawn(binPath, args, { windowsHide: true });
    let finished = false;
    const done = (value) => {
      if (finished) return;
      finished = true;
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      resolve(value);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    child.on('error', () => {
      clearTimeout(timer);
      done(false);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      done(code === 0);
    });
  });
}

module.exports = {
  ensureDir,
  sha256File,
  downloadFile,
  findGithubAsset,
  fetchChecksum,
  extractArchive,
  findFileRecursive,
  makeExecutable,
  testBinary
};
