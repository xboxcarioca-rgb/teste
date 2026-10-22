/**
 * Leitura de metadados de mídia via ffprobe (JSON).
 */

const { execFile } = require('child_process');

/**
 * @param {string} ffprobePath
 * @param {string} filePath
 * @returns {Promise<{path:string,duration:number,width:number,height:number,fps:number,hasAudio:boolean,hasVideo:boolean,videoCodec:string,audioCodec:string,sizeBytes:number,raw:object}>}
 */
function probeMedia(ffprobePath, filePath) {
  return new Promise((resolve, reject) => {
    execFile(
      ffprobePath,
      [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        '-show_chapters',
        filePath
      ],
      { maxBuffer: 32 * 1024 * 1024, windowsHide: true, timeout: 60000 },
      (error, stdout) => {
        if (error) {
          reject(new Error(`ffprobe falhou em "${filePath}": ${error.message}`));
          return;
        }
        try {
          const raw = JSON.parse(String(stdout || '{}'));
          const streams = Array.isArray(raw.streams) ? raw.streams : [];
          const video = streams.find((stream) => stream.codec_type === 'video' && !stream.disposition?.attached_pic);
          const audio = streams.find((stream) => stream.codec_type === 'audio');

          let fps = 0;
          const rate = video?.avg_frame_rate || video?.r_frame_rate || '0/1';
          const [numerator, denominator] = String(rate).split('/').map(Number);
          if (numerator && denominator) fps = Math.round((numerator / denominator) * 100) / 100;

          const duration = Number(raw.format?.duration ?? video?.duration ?? audio?.duration ?? 0) || 0;

          resolve({
            path: filePath,
            duration: Math.round(duration * 1000) / 1000,
            width: Number(video?.width) || 0,
            height: Number(video?.height) || 0,
            fps: fps || 30,
            hasVideo: Boolean(video),
            hasAudio: Boolean(audio),
            videoCodec: video?.codec_name || '',
            audioCodec: audio?.codec_name || '',
            sizeBytes: Number(raw.format?.size) || 0,
            bitRateKbps: Math.round((Number(raw.format?.bit_rate) || 0) / 1000),
            raw
          });
        } catch (parseError) {
          reject(new Error(`Saída do ffprobe inválida: ${parseError.message}`));
        }
      }
    );
  });
}

/**
 * Extrai um frame como JPEG (miniatura na interface).
 * @param {string} ffmpegPath
 * @param {string} filePath
 * @param {string} outputPath
 * @param {{time?:number,width?:number}} [options]
 */
function extractThumbnail(ffmpegPath, filePath, outputPath, options = {}) {
  return new Promise((resolve, reject) => {
    const time = Math.max(0, Number(options.time) || 1);
    const width = Math.max(64, Number(options.width) || 480);
    const child = require('child_process').spawn(
      ffmpegPath,
      [
        '-hide_banner',
        '-nostdin',
        '-loglevel',
        'error',
        '-ss',
        String(time),
        '-i',
        filePath,
        '-frames:v',
        '1',
        '-vf',
        `scale=${width}:-2`,
        '-y',
        outputPath
      ],
      { windowsHide: true }
    );
    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(stderr.slice(-400) || `ffmpeg saiu com código ${code}`));
    });
  });
}

module.exports = { probeMedia, extractThumbnail };
