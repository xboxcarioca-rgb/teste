/**
 * Transcrição local com whisper.cpp (legendas automáticas).
 *
 * Detalhes importantes descobertos na prática:
 *  - Os binários do whisper.cpp são publicados em releases de BUILD (ex.:
 *    "b5454"), não nas tags "v1.9.x" (essas não têm assets). Por isso a busca
 *    percorre os últimos releases até achar um com o asset certo.
 *  - O executável chama-se `whisper-cli` (releases novos) ou `main` (antigos).
 *  - Os modelos ficam no Hugging Face e podem ter extensão `.pt` (novos) ou
 *    `.bin` (antigos); testamos as duas URLs em vez de chutar.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
  ensureDir,
  downloadFile,
  findGithubAsset,
  extractArchive,
  findFileRecursive,
  makeExecutable,
  testBinary
} = require('./binaries');
const { WHISPER_MODELS } = require('../common/defaults');

const REPO = 'ggml-org/whisper.cpp';
const MODEL_BASE_URLS = [
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main',
  'https://huggingface.co/gpt-community/whisper.cpp/resolve/main'
];

/** Padrão do asset para a plataforma atual. */
function assetPattern() {
  if (process.platform === 'win32') return /^whisper-bin-x64\.zip$/i;
  if (process.platform === 'darwin') return /^whisper-bin-macos-x64\.zip$/i;
  return /^whisper-bin-ubuntu-x64\.tar\.gz$/i;
}

/** Nomes possíveis do executável. */
function executableNames() {
  return process.platform === 'win32' ? ['whisper-cli.exe', 'whisper.exe', 'main.exe'] : ['whisper-cli', 'whisper', 'main'];
}

/**
 * Procura um whisper-cli utilizável.
 * @param {{binDir?:string,userPath?:string}} options
 */
async function resolveWhisper({ binDir, userPath } = {}) {
  const names = executableNames();
  const candidates = [];
  if (userPath) candidates.push(userPath);
  if (binDir) names.forEach((name) => candidates.push(path.join(binDir, name)));

  for (const candidate of candidates) {
    if (!candidate || !fs.existsSync(candidate)) continue;
    if (await testBinary(candidate, ['--help'], 12000)) return candidate;
  }

  if (binDir) {
    for (const name of names) {
      const found = await findFileRecursive(binDir, (fileName) => fileName.toLowerCase() === name.toLowerCase(), 4);
      if (found && (await testBinary(found, ['--help'], 12000))) return found;
    }
  }
  return null;
}

/**
 * Baixa e instala o whisper.cpp.
 * @param {{binDir:string,onProgress?:Function,signal?:AbortSignal}} params
 */
async function installWhisper({ binDir, onProgress, signal }) {
  ensureDir(binDir);
  const asset = await findGithubAsset({ repo: REPO, pattern: assetPattern(), releaseStrategy: 'first-with-assets' });
  const archivePath = path.join(binDir, asset.name);

  if (onProgress) onProgress({ stage: 'download', percent: 0, message: `Baixando ${asset.name} (${asset.tag})…`, total: asset.size });

  await downloadFile({
    url: asset.url,
    destPath: archivePath,
    signal,
    onProgress: (event) => {
      if (onProgress) onProgress({ stage: 'download', ...event, message: `Baixando Whisper… ${event.percent}%` });
    }
  });

  const extractDir = path.join(binDir, 'whisper');
  if (onProgress) onProgress({ stage: 'extract', percent: 95, message: 'Extraindo…' });
  await extractArchive(archivePath, extractDir);
  await fs.promises.rm(archivePath, { force: true });

  const executable = await resolveWhisper({ binDir: extractDir });
  if (!executable) throw new Error('O pacote do Whisper foi baixado, mas o executável não foi encontrado.');
  await makeExecutable(executable);
  if (onProgress) onProgress({ stage: 'done', percent: 100, message: 'Whisper pronto.', path: executable });
  return executable;
}

/** Lista os modelos conhecidos com o status local (baixado ou não). */
function listModels(modelsDir) {
  return WHISPER_MODELS.map((model) => {
    const localPath = findLocalModel(modelsDir, model.id);
    return { ...model, localPath, installed: Boolean(localPath) };
  });
}

/** Procura um modelo já baixado (.pt ou .bin). */
function findLocalModel(modelsDir, modelId) {
  if (!modelsDir || !fs.existsSync(modelsDir)) return null;
  const definition = WHISPER_MODELS.find((model) => model.id === modelId);
  const base = definition?.file || `ggml-${modelId}`;
  for (const extension of ['.pt', '.bin']) {
    const candidate = path.join(modelsDir, `${base}${extension}`);
    if (fs.existsSync(candidate) && fs.statSync(candidate).size > 1024 * 1024) return candidate;
  }
  const found = fs.readdirSync(modelsDir).find((name) => name.toLowerCase().includes(modelId.toLowerCase()));
  return found ? path.join(modelsDir, found) : null;
}

/**
 * Baixa um modelo ggml.
 * @param {{modelId:string,modelsDir:string,onProgress?:Function,signal?:AbortSignal,customUrl?:string}} params
 */
async function downloadModel({ modelId, modelsDir, onProgress, signal, customUrl }) {
  ensureDir(modelsDir);
  const existing = findLocalModel(modelsDir, modelId);
  if (existing) {
    if (onProgress) onProgress({ stage: 'done', percent: 100, message: 'Modelo já estava baixado.', path: existing });
    return existing;
  }

  const definition = WHISPER_MODELS.find((model) => model.id === modelId);
  const base = definition?.file || `ggml-${modelId}`;
  const urls = customUrl
    ? [customUrl]
    : MODEL_BASE_URLS.flatMap((baseUrl) => [`${baseUrl}/${base}.pt`, `${baseUrl}/${base}.bin`]);

  let lastError = null;
  for (const url of urls) {
    const fileName = path.basename(new URL(url).pathname);
    const destPath = path.join(modelsDir, fileName);
    try {
      if (onProgress) onProgress({ stage: 'download', percent: 0, message: `Baixando modelo ${modelId}…`, url });
      const result = await downloadFile({
        url,
        destPath,
        signal,
        onProgress: (event) => {
          if (onProgress) {
            onProgress({
              stage: 'download',
              ...event,
              message: `Baixando modelo ${modelId}… ${event.percent}% (${Math.round(event.received / 1048576)} MB)`
            });
          }
        }
      });
      if (result.bytes < 1024 * 1024) throw new Error('Arquivo pequeno demais — provavelmente uma página de erro.');
      if (onProgress) onProgress({ stage: 'done', percent: 100, message: 'Modelo pronto.', path: destPath });
      return destPath;
    } catch (error) {
      lastError = error;
      await fs.promises.rm(destPath, { force: true }).catch(() => {});
      if (signal?.aborted) throw new Error('Download do modelo cancelado.');
    }
  }
  throw new Error(
    `Não consegui baixar o modelo "${modelId}". ${lastError?.message || ''} Baixe manualmente em https://huggingface.co/ggerganov/whisper.cpp/tree/main e aponte o caminho nas configurações.`
  );
}

/**
 * Converte qualquer mídia em WAV 16 kHz mono (formato exigido pelo Whisper).
 * @param {string} ffmpegPath
 * @param {string} inputPath
 * @param {string} wavPath
 */
function toWav16k(ffmpegPath, inputPath, wavPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpegPath,
      ['-hide_banner', '-nostdin', '-loglevel', 'error', '-i', inputPath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', '-y', wavPath],
      { windowsHide: true }
    );
    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(wavPath) : reject(new Error(stderr.slice(-300) || 'falha ao converter áudio'))));
  });
}

/**
 * Transcreve um arquivo de áudio/vídeo.
 *
 * @param {object} params
 * @param {string} params.whisperPath
 * @param {string} params.modelPath
 * @param {string} params.mediaPath
 * @param {string} params.workDir
 * @param {string} [params.ffmpegPath] necessário para converter em WAV 16k
 * @param {string} [params.language='pt']
 * @param {boolean} [params.translate]
 * @param {number} [params.duration] duração total (para calcular o progresso)
 * @param {(event:object)=>void} [params.onProgress]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{srtPath:string,jsonPath:string,txtPath:string}>}
 */
async function transcribe(params) {
  const { whisperPath, modelPath, mediaPath, workDir, ffmpegPath, language = 'pt', translate = false, duration = 0, onProgress, signal } = params;
  ensureDir(workDir);

  if (!fs.existsSync(modelPath)) throw new Error(`Modelo do Whisper não encontrado: ${modelPath}`);

  const wavPath = path.join(workDir, 'audio_16k.wav');
  if (onProgress) onProgress({ stage: 'prepare', percent: 2, message: 'Extraindo áudio (16 kHz mono)…' });
  if (ffmpegPath) await toWav16k(ffmpegPath, mediaPath, wavPath);
  else throw new Error('FFmpeg é necessário para preparar o áudio da transcrição.');

  const outputPrefix = path.join(workDir, 'transcricao');
  const args = [
    '-m',
    modelPath,
    '-f',
    wavPath,
    '-l',
    language || 'auto',
    '-otxt',
    '-osrt',
    '-oj',
    '-of',
    outputPrefix,
    '-pp',
    '--prompt-initial-timestamp',
    '0'
  ];
  if (translate) args.push('-tr');
  // Word-level timestamps alimentam o karaoke das legendas.
  args.push('-ml', '1', '-sow');

  if (onProgress) onProgress({ stage: 'transcribe', percent: 5, message: 'Transcrevendo (isso pode demorar no primeiro uso)…' });

  await new Promise((resolve, reject) => {
    const child = spawn(whisperPath, args, { windowsHide: true });
    let stderr = '';
    let killed = false;
    const total = Math.max(1, duration || 1);

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

    const handleOutput = (data) => {
      const text = data.toString();
      stderr += text.length > 100000 ? text.slice(-50000) : text;
      // whisper-cli imprime trechos como "[00:00:12.340 --> 00:00:15.000]  texto"
      const timeMatches = [...text.matchAll(/\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->/g)];
      if (timeMatches.length && onProgress) {
        const last = timeMatches[timeMatches.length - 1];
        const seconds = Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]) + Number(last[4]) / 1000;
        const percent = Math.min(97, Math.round((seconds / total) * 100));
        onProgress({ stage: 'transcribe', percent, message: `Transcrevendo… ${percent}%` });
      }
      if (/whisper_full_with_state: failed to load model/i.test(text)) reject(new Error('O modelo não pôde ser carregado.'));
    };

    child.stdout.on('data', handleOutput);
    child.stderr.on('data', handleOutput);
    child.on('error', reject);
    child.on('close', (code) => {
      if (killed) {
        reject(new Error('Transcrição cancelada.'));
        return;
      }
      if (code === 0) resolve();
      else reject(new Error(stderr.split('\n').filter(Boolean).slice(-3).join(' | ') || `whisper saiu com código ${code}`));
    });
  });

  const srtPath = `${outputPrefix}.srt`;
  const jsonPath = `${outputPrefix}.json`;
  const txtPath = `${outputPrefix}.txt`;
  if (!fs.existsSync(srtPath) && !fs.existsSync(jsonPath)) {
    throw new Error('A transcrição terminou, mas nenhum arquivo de saída foi gerado.');
  }
  if (onProgress) onProgress({ stage: 'done', percent: 100, message: 'Transcrição concluída.' });

  await fs.promises.rm(wavPath, { force: true }).catch(() => {});
  return { srtPath, jsonPath, txtPath };
}

module.exports = {
  REPO,
  assetPattern,
  executableNames,
  resolveWhisper,
  installWhisper,
  listModels,
  findLocalModel,
  downloadModel,
  transcribe,
  toWav16k,
  MODEL_BASE_URLS
};
