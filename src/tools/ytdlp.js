/**
 * Integração com yt-dlp: informação do link e download do vídeo.
 *
 * O binário não é embutido no instalador (licença/tamanho): o app baixa a
 * versão oficial do GitHub na primeira vez que o usuário usa um link, mostra o
 * progresso e guarda em <userData>/bin. Também aceita um yt-dlp que o usuário
 * já tenha instalado.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
  ensureDir,
  downloadFile,
  findGithubAsset,
  fetchChecksum,
  makeExecutable,
  testBinary,
  findFileRecursive
} = require('./binaries');

const REPO = 'yt-dlp/yt-dlp';

/** Nome do asset correto para a plataforma atual. */
function assetPattern() {
  if (process.platform === 'win32') {
    return process.arch === 'arm64' ? /^yt-dlp_arm64\.exe$/i : /^yt-dlp(_x86)?\.exe$/i;
  }
  if (process.platform === 'darwin') return /^yt-dlp_macos$/i;
  return /^yt-dlp_linux$/i;
}

/** Nome do arquivo final dentro do diretório de binários. */
function binaryName() {
  return process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
}

/**
 * Procura um yt-dlp utilizável.
 * @param {{binDir?:string,userPath?:string}} options
 */
async function resolveYtDlp({ binDir, userPath } = {}) {
  const candidates = [];
  if (userPath) candidates.push(userPath);
  if (binDir) candidates.push(path.join(binDir, binaryName()));
  if (process.platform === 'win32') {
    candidates.push(path.join(process.env.USERPROFILE || '', 'yt-dlp.exe'));
  } else {
    candidates.push('/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp');
  }

  for (const candidate of candidates) {
    if (!candidate || !fs.existsSync(candidate)) continue;
    if (await testBinary(candidate, ['--version'], 10000)) return candidate;
  }

  // PATH do sistema.
  const pathDirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of pathDirs) {
    const candidate = path.join(dir, binaryName());
    if (fs.existsSync(candidate) && (await testBinary(candidate, ['--version'], 10000))) return candidate;
  }
  if (binDir) {
    const found = await findFileRecursive(binDir, (name) => name.toLowerCase().startsWith('yt-dlp'), 3);
    if (found && (await testBinary(found, ['--version'], 10000))) return found;
  }
  return null;
}

/**
 * Baixa/instala o yt-dlp oficial.
 * @param {object} params
 * @param {string} params.binDir
 * @param {(event:object)=>void} [params.onProgress]
 * @param {AbortSignal} [params.signal]
 */
async function installYtDlp({ binDir, onProgress, signal }) {
  ensureDir(binDir);
  const asset = await findGithubAsset({ repo: REPO, pattern: assetPattern() });
  const destPath = path.join(binDir, binaryName());
  const checksum = await fetchChecksum(asset.checksumUrl, asset.name);

  if (onProgress) onProgress({ stage: 'download', percent: 0, message: `Baixando ${asset.name} (${asset.tag})…`, total: asset.size });

  await downloadFile({
    url: asset.url,
    destPath,
    expectedSha256: checksum || undefined,
    signal,
    onProgress: (event) => {
      if (onProgress) onProgress({ stage: 'download', ...event, message: `Baixando yt-dlp… ${event.percent}%` });
    }
  });

  await makeExecutable(destPath);
  if (!(await testBinary(destPath, ['--version'], 15000))) {
    throw new Error('O yt-dlp baixado não executou. Baixe manualmente em https://github.com/yt-dlp/yt-dlp/releases.');
  }
  if (onProgress) onProgress({ stage: 'done', percent: 100, message: 'yt-dlp pronto.' });
  return destPath;
}

/** Executa o yt-dlp e devolve stdout/stderr com progresso por linha. */
function runYtDlp(ytDlpPath, args, { onLine, signal } = {}) {
  return new Promise((resolve) => {
    const child = spawn(ytDlpPath, ['--no-warnings', '--newline', ...args], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    let killed = false;

    const onAbort = () => {
      killed = true;
      try {
        child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    const handle = (bucket) => (data) => {
      const text = data.toString();
      if (bucket === 'out') stdout += text;
      else stderr += text;
      if (onLine) {
        text
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .forEach((line) => onLine(line));
      }
    };
    child.stdout.on('data', handle('out'));
    child.stderr.on('data', handle('err'));
    child.on('error', (error) => resolve({ ok: false, code: -1, stdout, stderr: `${stderr}\n${error.message}`, killed }));
    child.on('close', (code) => resolve({ ok: code === 0, code, stdout, stderr, killed }));
  });
}

/**
 * Lê as informações de um link (sem baixar).
 * @returns {Promise<{title:string,duration:number,width:number,height:number,uploader:string,thumbnail:string,formats:Array,webpageUrl:string}>}
 */
async function fetchUrlInfo(ytDlpPath, url) {
  const result = await runYtDlp(ytDlpPath, ['-J', '--no-playlist', '--', url]);
  if (!result.ok) throw new Error(extractYtDlpError(result.stderr) || 'Não foi possível ler o link.');
  const start = result.stdout.indexOf('{');
  if (start === -1) throw new Error('Resposta inesperada do yt-dlp (JSON não encontrado).');
  const info = JSON.parse(result.stdout.slice(start));

  const bestVideo = (info.formats || [])
    .filter((format) => format.vcodec && format.vcodec !== 'none')
    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

  return {
    title: info.title || 'vídeo',
    duration: Number(info.duration) || 0,
    width: Number(info.width || bestVideo?.width) || 0,
    height: Number(info.height || bestVideo?.height) || 0,
    uploader: info.uploader || info.channel || '',
    thumbnail: info.thumbnail || '',
    webpageUrl: info.webpage_url || url,
    extractor: info.extractor_key || info.extractor || '',
    isLive: Boolean(info.is_live),
    formats: (info.formats || [])
      .filter((format) => format.vcodec && format.vcodec !== 'none')
      .map((format) => ({
        id: format.format_id,
        ext: format.ext,
        height: format.height || 0,
        fps: format.fps || 0,
        vbr: format.vbr || 0,
        note: format.format_note || ''
      }))
      .slice(-12)
  };
}

/**
 * Baixa o vídeo do link.
 *
 * @param {object} params
 * @param {string} params.ytDlpPath
 * @param {string} params.url
 * @param {string} params.outputDir
 * @param {{maxHeight?:number,formatId?:string,downloadAudioOnly?:boolean,cookiesFile?:string,subtitles?:boolean}} [params.options]
 * @param {(event:object)=>void} [params.onProgress]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{filePath:string,title:string,duration:number}>}
 */
async function downloadUrl({ ytDlpPath, url, outputDir, options = {}, onProgress, signal }) {
  ensureDir(outputDir);
  const template = path.join(outputDir, '%(title).120B [%(id)s].%(ext)s');
  const args = [
    '--no-playlist',
    '--restrict-filenames',
    '--no-part',
    '-o',
    template,
    '--print',
    'after_move:filepath',
    '--merge-output-format',
    'mp4'
  ];

  if (options.downloadAudioOnly) {
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', '128K');
  } else {
    const maxHeight = Number(options.maxHeight) || 0;
    const heightFilter = maxHeight > 0 ? `[height<=?${maxHeight}]` : '';
    args.push(
      '-f',
      `bestvideo${heightFilter}[ext=mp4]+bestaudio[ext=m4a]/best${heightFilter}[ext=mp4]/best`,
      '--remux-video',
      'mp4'
    );
  }

  if (options.cookiesFile) args.push('--cookies', options.cookiesFile);
  if (options.subtitles) args.push('--write-subs', '--write-auto-subs', '--sub-langs', 'pt.*,en.*', '--convert-subs', 'srt');

  const result = await runYtDlp(ytDlpPath, args.concat(['--', url]), {
    signal,
    onLine: (line) => {
      if (!onProgress) return;
      const percentMatch = /\[download\]\s+([0-9.]+)%/.exec(line);
      const speedMatch = /at\s+([0-9.]+[KMG]?i?B\/s)/.exec(line);
      const etaMatch = /ETA\s+([0-9:]+)/.exec(line);
      if (percentMatch) {
        onProgress({
          stage: 'download',
          percent: Math.min(99, Math.round(parseFloat(percentMatch[1]))),
          message: line,
          speed: speedMatch ? speedMatch[1] : null,
          eta: etaMatch ? etaMatch[1] : null
        });
      } else if (/^\[download\] Destination/.test(line) || /^\[Merger\]/.test(line) || /^\[ExtractAudio\]/.test(line)) {
        onProgress({ stage: 'process', percent: 99, message: line });
      } else if (/^ERROR/i.test(line)) {
        onProgress({ stage: 'error', percent: 0, message: line });
      } else {
        onProgress({ stage: 'log', percent: null, message: line });
      }
    }
  });

  if (result.killed) throw new Error('Download cancelado.');
  if (!result.ok) throw new Error(extractYtDlpError(result.stderr) || 'O download falhou.');

  // O yt-dlp imprime o caminho final graças a --print after_move:filepath.
  const printed = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('['))
    .pop();

  let filePath = printed && fs.existsSync(printed) ? printed : null;
  if (!filePath) {
    const recent = fs
      .readdirSync(outputDir)
      .filter((name) => /\.(mp4|mkv|webm|mov|m4a|mp3)$/i.test(name))
      .map((name) => ({ name, full: path.join(outputDir, name), mtime: fs.statSync(path.join(outputDir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)[0];
    filePath = recent ? recent.full : null;
  }
  if (!filePath) throw new Error('O download terminou, mas o arquivo final não foi encontrado.');

  if (onProgress) onProgress({ stage: 'done', percent: 100, message: 'Download concluído.', filePath });
  return { filePath, title: path.basename(filePath), url };
}

/** Transforma a stderr do yt-dlp em uma mensagem curta e útil. */
function extractYtDlpError(stderr) {
  const text = String(stderr || '');
  const errorLine = text.split('\n').reverse().find((line) => /^ERROR/i.test(line.trim()));
  if (!errorLine) return text.split('\n').filter(Boolean).slice(-2).join(' | ');
  return errorLine.trim();
}

module.exports = {
  REPO,
  assetPattern,
  binaryName,
  resolveYtDlp,
  installYtDlp,
  fetchUrlInfo,
  downloadUrl,
  extractYtDlpError,
  runYtDlp
};
