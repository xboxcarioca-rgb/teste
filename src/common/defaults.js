/**
 * Valores padrão do projeto e templates prontos (identidades visuais).
 *
 * Tamanhos são sempre proporcionais à altura do quadro (0..1), assim o mesmo
 * template funciona em 9:16, 1:1, 4:5 e 16:9 sem recalcular nada na mão.
 */

const { FORMATS } = require('./formats');

/** Estilos de animação de legenda suportados. */
const SUBTITLE_ANIMATIONS = [
  { id: 'none', label: 'Sem animação', description: 'A legenda aparece inteira.' },
  { id: 'pop', label: 'Pop (surgir)', description: 'Cada legenda entra com um leve zoom.' },
  { id: 'karaoke', label: 'Karaoke (palavra a palavra)', description: 'Destaca cada palavra no tempo da fala — exige transcrição com timestamps.' },
  { id: 'typewriter', label: 'Máquina de escrever', description: 'O texto é revelado caractere a caractere.' }
];

/** Posições possíveis para o banner de texto. */
const BANNER_POSITIONS = [
  { id: 'top', label: 'Topo' },
  { id: 'upper-third', label: 'Terço superior' },
  { id: 'center', label: 'Centro' },
  { id: 'lower-third', label: 'Terço inferior' },
  { id: 'bottom', label: 'Rodapé' }
];

/** Âncoras para logo/imagem (grade 3x3). */
const ANCHORS = [
  { id: 'top-left', label: '↖ Superior esquerda' },
  { id: 'top-center', label: '↑ Superior centro' },
  { id: 'top-right', label: '↗ Superior direita' },
  { id: 'middle-left', label: '← Meio esquerda' },
  { id: 'center', label: '• Centro' },
  { id: 'middle-right', label: '→ Meio direita' },
  { id: 'bottom-left', label: '↙ Inferior esquerda' },
  { id: 'bottom-center', label: '↓ Inferior centro' },
  { id: 'bottom-right', label: '↘ Inferior direita' }
];

/** Estilos de legenda padrão (valores proporcionais à altura do vídeo). */
const DEFAULT_SUBTITLE_STYLE = {
  font: 'Montserrat',
  fontFile: '', // caminho opcional para .ttf/.otf; vazio = usa a fonte do sistema
  bold: true,
  italic: false,
  uppercase: true,
  /** Altura da fonte em relação à altura do quadro (6.2% em 1920px ≈ 119px). */
  sizeRatio: 0.062,
  color: '#FFFFFF',
  activeWordColor: '#FFE14D',
  outlineColor: '#000000',
  /** Espessura do contorno em relação à altura do quadro. */
  outlineRatio: 0.0035,
  shadowColor: '#000000',
  shadowRatio: 0.002,
  shadowOpacity: 0.6,
  box: false,
  boxColor: '#000000',
  boxOpacity: 0.55,
  boxPaddingRatio: 0.012,
  align: 'bottom-center', // bottom-center | top-center | center
  marginRatio: 0.16, // distância da borda (16% da altura no caso do rodapé)
  maxCharsPerLine: 22,
  maxLines: 2,
  animation: 'karaoke',
  interlineRatio: 0.008
};

/** Banner de texto padrão. */
const DEFAULT_BANNER_TEXT = {
  enabled: false,
  content: '',
  position: 'top',
  font: 'Montserrat',
  fontFile: '',
  bold: true,
  italic: false,
  uppercase: true,
  sizeRatio: 0.05,
  color: '#FFFFFF',
  background: true,
  backgroundColor: '#FF2D55',
  backgroundOpacity: 1,
  /** Altura da faixa em relação à altura do quadro. */
  barHeightRatio: 0.085,
  barWidthMode: 'full', // full | hug
  barPaddingRatio: 0.02,
  offsetYRatio: 0,
  outlineColor: '#000000',
  outlineRatio: 0.002,
  shadow: true,
  animation: 'fade', // none | fade | slide | expand
  animationDuration: 0.4,
  /** Tempo em que o banner fica visível (0 = o clipe inteiro). */
  visibleSeconds: 0,
  maxCharsPerLine: 34
};

/** Logo/imagem sobreposta padrão. */
const DEFAULT_BANNER_LOGO = {
  enabled: false,
  path: '',
  anchor: 'top-right',
  /** Largura do logo em relação à largura do quadro. */
  widthRatio: 0.18,
  marginRatio: 0.04,
  opacity: 1,
  animation: 'fade', // none | fade | slide | bounce
  animationDuration: 0.5,
  visibleSeconds: 0,
  roundCornersRatio: 0,
  outline: false,
  outlineColor: '#FFFFFF',
  outlineRatio: 0.004
};

/** Marca d'água de progresso (barra superior) — comum em cortes virais. */
const DEFAULT_PROGRESS_BAR = {
  enabled: false,
  color: '#FFFFFF',
  heightRatio: 0.006,
  position: 'top',
  opacity: 0.9
};

/** Configuração padrão de saída. */
const DEFAULT_OUTPUT = {
  formatId: 'vertical',
  width: 1080,
  height: 1920,
  fps: 30,
  layout: 'fill',
  focusX: 0.5,
  focusY: 0.45,
  background: {
    color: '#0B0B0F',
    blurRatio: 0.02, // sigma proporcional à altura
    dim: 0.35,
    gradient: false
  },
  split: {
    gapRatio: 0.012,
    borderColor: '#FFFFFF',
    borderRatio: 0,
    audioFrom: 'primary', // primary | secondary | mix | none
    secondSource: '',
    thirdSource: ''
  },
  videoCodec: 'h264', // h264 | h265
  rateControl: 'crf', // crf | bitrate
  crf: 20,
  preset: 'medium', // ultrafast..veryslow
  videoBitrateKbps: 0, // usado quando rateControl = bitrate
  maxBitrateKbps: 0,
  profile: 'high',
  pixelFormat: 'yuv420p',
  hardwareAcceleration: 'auto', // auto | none | nvenc | qsv | amf | videotoolbox
  audio: {
    codec: 'aac',
    bitrateKbps: 192,
    normalize: true,
    targetLoudness: -14, // LUFS (padrão de plataformas sociais)
    truePeak: -1,
    sampleRate: 48000,
    channels: 2,
    fadeIn: 0,
    fadeOut: 0,
    musicDucking: false
  },
  stripMetadata: true,
  stripChapters: true,
  keepOnlyCleanTitle: false,
  faststart: true,
  filenamePattern: '{title}-{format}-{index}',
  outputDir: '',
  preview: {
    enabled: false,
    seconds: 6,
    heightRatio: 0.35
  }
};

/** Parâmetros padrão da detecção de cortes virais. */
const DEFAULT_CUT_SETTINGS = {
  mode: 'auto', // auto | scenes | speech | fixed | manual
  targetMinSeconds: 15,
  targetMaxSeconds: 60,
  maxCuts: 8,
  sceneThreshold: 0.28,
  silenceThresholdDb: -35,
  silenceMinDuration: 0.45,
  snapToSpeech: true,
  hookWindowSeconds: 3,
  minScore: 0,
  keepOriginalAudio: true
};

/** Configuração padrão de legendas. */
const DEFAULT_SUBTITLES = {
  enabled: true,
  provider: 'whisper', // whisper | srt | none
  language: 'pt',
  modelSize: 'small', // tiny | base | small | medium | large-v3-turbo
  modelPath: '',
  binaryPath: '',
  translateToEnglish: false,
  maxLineLength: 42,
  minCueDuration: 0.6,
  maxCueDuration: 4.5,
  style: { ...DEFAULT_SUBTITLE_STYLE },
  cues: []
};

/** Modelos de Whisper disponíveis para download (whisper.cpp / ggml). */
const WHISPER_MODELS = [
  { id: 'tiny', label: 'Tiny — ~75 MB (rápido, menos preciso)', file: 'ggml-tiny', sizeMb: 75 },
  { id: 'base', label: 'Base — ~142 MB (equilíbrio básico)', file: 'ggml-base', sizeMb: 142 },
  { id: 'small', label: 'Small — ~466 MB (recomendado para PT-BR)', file: 'ggml-small', sizeMb: 466 },
  { id: 'medium', label: 'Medium — ~1.5 GB (alta precisão)', file: 'ggml-medium', sizeMb: 1533 },
  { id: 'large-v3-turbo', label: 'Large v3 Turbo — ~1.6 GB (melhor custo/precisão)', file: 'ggml-large-v3-turbo', sizeMb: 1624 }
];

/**
 * Templates prontos. Cada um sobrescreve partes do projeto.
 * `patch` é aplicado com merge profundo sobre o projeto padrão.
 */
const BUILTIN_TEMPLATES = [
  {
    id: 'reels-viral',
    name: 'Reels Viral',
    description: 'Legenda grande palavra a palavra, banner no topo e marca de progresso. Padrão de cortes que prendem atenção.',
    builtin: true,
    patch: {
      output: { formatId: 'vertical', layout: 'fill', fps: 30, videoCodec: 'h264', crf: 20 },
      subtitles: {
        enabled: true,
        style: {
          sizeRatio: 0.068,
          color: '#FFFFFF',
          activeWordColor: '#FFE14D',
          outlineRatio: 0.0045,
          animation: 'karaoke',
          align: 'center',
          marginRatio: 0,
          maxCharsPerLine: 18
        }
      },
      banner: {
        text: {
          enabled: true,
          position: 'top',
          sizeRatio: 0.046,
          backgroundColor: '#FF2D55',
          barHeightRatio: 0.078,
          animation: 'slide'
        },
        logo: { enabled: true, anchor: 'top-right', widthRatio: 0.14, animation: 'fade' },
        progressBar: { enabled: true, color: '#FFFFFF', heightRatio: 0.005 }
      }
    }
  },
  {
    id: 'podcast-clip',
    name: 'Podcast Clip',
    description: 'Vídeo inteiro no centro com fundo desfocado ("metade"), legenda centralizada e faixa de título.',
    builtin: true,
    patch: {
      output: { formatId: 'vertical', layout: 'fit-blur', background: { blurRatio: 0.026, dim: 0.42 } },
      subtitles: {
        enabled: true,
        style: {
          sizeRatio: 0.055,
          animation: 'karaoke',
          align: 'bottom-center',
          marginRatio: 0.1,
          maxCharsPerLine: 24,
          box: false
        }
      },
      banner: {
        text: { enabled: true, position: 'top', barWidthMode: 'hug', backgroundColor: '#111111', backgroundOpacity: 0.65 },
        logo: { enabled: true, anchor: 'bottom-right', widthRatio: 0.16 }
      }
    }
  },
  {
    id: 'dueto-gaming',
    name: 'Duet / Gaming',
    description: 'Tela dividida empilhada (gameplay + facecam), legenda no meio, sem banner.',
    builtin: true,
    patch: {
      output: { formatId: 'vertical', layout: 'split-v', split: { gapRatio: 0.008, audioFrom: 'mix' } },
      subtitles: {
        enabled: true,
        style: { sizeRatio: 0.05, align: 'center', animation: 'pop', maxCharsPerLine: 26 }
      },
      banner: { text: { enabled: false }, logo: { enabled: true, anchor: 'top-right', widthRatio: 0.12 } }
    }
  },
  {
    id: 'clean-feed',
    name: 'Feed Limpo 1:1',
    description: 'Quadrado, sem legenda queimada, apenas logo discreto. Para quem edita depois.',
    builtin: true,
    patch: {
      output: { formatId: 'square', layout: 'fill' },
      subtitles: { enabled: false },
      banner: { text: { enabled: false }, logo: { enabled: true, anchor: 'bottom-right', widthRatio: 0.12, opacity: 0.9 } }
    }
  },
  {
    id: 'neon-pop',
    name: 'Neon Pop',
    description: 'Alto contraste: legenda em caixa colorida, banner neon e barras laterais coloridas.',
    builtin: true,
    patch: {
      output: { formatId: 'portrait', layout: 'fit-solid', background: { color: '#1A0033', gradient: true } },
      subtitles: {
        enabled: true,
        style: {
          sizeRatio: 0.058,
          color: '#FFFFFF',
          activeWordColor: '#00F5D4',
          box: true,
          boxColor: '#7B2CFF',
          boxOpacity: 0.85,
          animation: 'pop',
          align: 'center'
        }
      },
      banner: {
        text: { enabled: true, position: 'top', backgroundColor: '#00F5D4', color: '#08131A', barWidthMode: 'hug', animation: 'expand' }
      }
    }
  },
  {
    id: 'youtube-short-legenda',
    name: 'Shorts com Legenda',
    description: '9:16 com legenda em caixa preta no rodapé e título no topo.',
    builtin: true,
    patch: {
      output: { formatId: 'vertical', layout: 'fill', fps: 60 },
      subtitles: {
        enabled: true,
        style: {
          sizeRatio: 0.05,
          box: true,
          boxColor: '#000000',
          boxOpacity: 0.7,
          animation: 'typewriter',
          align: 'bottom-center',
          marginRatio: 0.12
        }
      },
      banner: { text: { enabled: true, position: 'top', barWidthMode: 'full', backgroundColor: '#000000', backgroundOpacity: 0.55 } }
    }
  }
];

/** Cria um projeto novo com todos os valores padrão. */
function createDefaultProject(overrides = {}) {
  const base = {
    version: 1,
    id: `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: 'Novo projeto',
    createdAt: new Date().toISOString(),
    templateId: 'reels-viral',
    sources: [],
    segments: [],
    output: JSON.parse(JSON.stringify(DEFAULT_OUTPUT)),
    subtitles: JSON.parse(JSON.stringify(DEFAULT_SUBTITLES)),
    banner: {
      text: JSON.parse(JSON.stringify(DEFAULT_BANNER_TEXT)),
      logo: JSON.parse(JSON.stringify(DEFAULT_BANNER_LOGO)),
      progressBar: JSON.parse(JSON.stringify(DEFAULT_PROGRESS_BAR))
    },
    cutSettings: JSON.parse(JSON.stringify(DEFAULT_CUT_SETTINGS)),
    analysis: null
  };
  return deepMerge(base, overrides || {});
}

/** Merge profundo de objetos simples (arrays são substituídos). */
function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  const output = Array.isArray(target) ? [...target] : { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = deepMerge(output[key] && typeof output[key] === 'object' ? output[key] : {}, value);
    } else if (value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}

/** Aplica um template (builtin ou do usuário) sobre um projeto. */
function applyTemplate(project, template) {
  if (!template || !template.patch) return project;
  return deepMerge(project, template.patch);
}

/** Configurações persistidas do aplicativo. */
function createDefaultSettings() {
  return {
    theme: 'dark',
    language: 'pt-BR',
    downloadsDir: '',
    outputDir: '',
    tools: {
      ffmpegPath: '',
      ffprobePath: '',
      ytDlpPath: '',
      whisperPath: '',
      whisperModelPath: '',
      autoDownloadTools: true,
      allowTelemetry: false
    },
    defaults: {
      formatId: 'vertical',
      layout: 'fill',
      templateId: 'reels-viral',
      stripMetadata: true
    },
    recentProjects: []
  };
}

module.exports = {
  FORMATS,
  SUBTITLE_ANIMATIONS,
  BANNER_POSITIONS,
  ANCHORS,
  WHISPER_MODELS,
  DEFAULT_SUBTITLE_STYLE,
  DEFAULT_BANNER_TEXT,
  DEFAULT_BANNER_LOGO,
  DEFAULT_PROGRESS_BAR,
  DEFAULT_OUTPUT,
  DEFAULT_SUBTITLES,
  DEFAULT_CUT_SETTINGS,
  BUILTIN_TEMPLATES,
  createDefaultProject,
  createDefaultSettings,
  applyTemplate,
  deepMerge
};
