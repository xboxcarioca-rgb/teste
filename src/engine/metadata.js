/**
 * Remoção de metadados.
 *
 * Cortes virais costumam ser republicados; metadados revelam autor original,
 * data/hora, GPS, software usado e capítulos — além de entregarem o arquivo
 * para o detector de "conteúdo não original" das plataformas.
 *
 * Estratégia: `-map_metadata -1` + flags bitexact (que impedem o FFmpeg de
 * gravar a tag `encoder=Lavf...`) + `-map_chapters -1` + reencodagem.
 */

/**
 * Argumentos de saída que removem metadados.
 * @param {{stripMetadata?:boolean,stripChapters?:boolean,keepOnlyCleanTitle?:boolean,title?:string}} options
 * @returns {string[]}
 */
function metadataArgs(options = {}) {
  const args = [];
  const strip = options.stripMetadata !== false;

  if (strip) {
    // Remove metadados globais e por stream.
    args.push('-map_metadata', '-1');
    args.push('-map_metadata:s:v', '-1');
    args.push('-map_metadata:s:a', '-1');
    if (options.stripChapters !== false) args.push('-map_chapters', '-1');
    // bitexact impede gravação de tags de encoder, datas e UUIDs do muxer.
    args.push('-fflags', '+bitexact');
    args.push('-flags:v', '+bitexact');
    args.push('-flags:a', '+bitexact');
  }

  if (options.keepOnlyCleanTitle && options.title) {
    args.push('-metadata', `title=${sanitizeTagValue(options.title)}`);
  }

  return args;
}

/**
 * Remove apenas o que quebra tags/containers (controles e quebras de linha),
 * preservando acentos e símbolos — o MP4 guarda tags em UTF-8.
 */
function sanitizeTagValue(value) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

/**
 * Tags que o muxer grava por conta própria e que NÃO são metadados do usuário:
 * `major_brand`/`minor_version`/`compatible_brands` são campos estruturais das
 * boxes do MP4 (definem compatibilidade do container) e `language=und`,
 * `handler_name=VideoHandler` e `vendor_id=[0][0][0][0]` são os defaults que o
 * próprio FFmpeg escreve ao remontar o arquivo. Nenhuma delas pode ser removida
 * por `-map_metadata -1` — e nenhuma delas identifica o autor ou o dispositivo.
 */
const STRUCTURAL_FORMAT_TAGS = new Set(['major_brand', 'minor_version', 'compatible_brands']);
const STRUCTURAL_STREAM_TAGS = new Set(['language', 'handler_name', 'vendor_id']);

/** Valores "em branco" que o muxer usa por padrão (não carregam informação). */
const NEUTRAL_VALUES = new Set(['und', '[0][0][0][0]', '0']);
const DEFAULT_HANDLER_NAMES = /^(video|sound|data|text|timecode|subtitle|closed caption)\s*handles?r?$/i;

/**
 * Diz se uma tag é estrutural do container (inofensiva e não removível).
 * @param {string} key
 * @param {string} value
 * @param {boolean} streamLevel
 * @returns {boolean}
 */
function isStructuralTag(key, value, streamLevel) {
  const lower = String(key).toLowerCase();
  const raw = String(value ?? '').trim();
  if (!streamLevel) return STRUCTURAL_FORMAT_TAGS.has(lower);
  // `language` é propriedade do stream (código ISO-639), não metadado de autor:
  // nunca identifica ninguém e o app não tem como forçar outro valor.
  if (lower === 'language') return true;
  if (!STRUCTURAL_STREAM_TAGS.has(lower)) return false;
  if (NEUTRAL_VALUES.has(raw)) return true;
  // handler_name só é estrutural quando é o default genérico do muxer;
  // um nome customizado (ex.: "Core Media Data Handler") ainda é rastreável.
  // O mesmo vale para vendor_id: "[0][0][0][0]" é vazio, "appl" identifica o fabricante.
  return lower === 'handler_name' && DEFAULT_HANDLER_NAMES.test(raw);
}

/**
 * Interpreta a saída JSON do ffprobe e devolve um relatório de metadados.
 *
 * `clean` considera apenas o que importa para privacidade/rastreio: tags de
 * usuário, capítulos e itens sensíveis. As tags estruturais do container são
 * relatadas à parte em `structuralTags`, para a interface poder explicar que
 * elas são obrigatórias pelo formato (e não um resquício do vídeo original).
 *
 * @param {any} probeResult saída de `ffprobe -print_format json -show_format -show_streams -show_chapters`
 * @returns {{clean:boolean,totalTags:number,metadataTags:number,chapters:number,formatTags:Record<string,string>,streamTags:object[],riskItems:string[],structuralTags:string[]}}
 */
function inspectMetadata(probeResult) {
  const formatTags = probeResult?.format?.tags || {};
  const streams = Array.isArray(probeResult?.streams) ? probeResult.streams : [];
  const streamTags = streams.map((stream) => ({
    index: stream.index,
    codecType: stream.codec_type,
    tags: stream.tags || {}
  }));
  const chapters = Array.isArray(probeResult?.chapters) ? probeResult.chapters.length : 0;

  const riskItems = [];
  const structuralTags = [];
  const sensitiveKeys = [
    'comment',
    'description',
    'synopsis',
    'encoder',
    'encoded_by',
    'creation_time',
    'location',
    'gps',
    'copyright',
    'author',
    'artist',
    'album',
    'title',
    'handler_name',
    'vendor_id',
    'com.apple.quicktime',
    'purl',
    'episode_id',
    'network'
  ];

  let metadataTags = 0;

  /** Classifica cada tag: estrutural (ignora), sensível (alerta) ou metadado (conta). */
  const scan = (tags, where, streamLevel) => {
    for (const [key, value] of Object.entries(tags || {})) {
      if (isStructuralTag(key, value, streamLevel)) {
        structuralTags.push(`${where}: ${key}`);
        continue;
      }
      metadataTags += 1;
      const lower = key.toLowerCase();
      if (sensitiveKeys.some((needle) => lower.includes(needle))) {
        riskItems.push(`${where}: ${key}="${String(value).slice(0, 60)}"`);
      }
    }
  };

  scan(formatTags, 'formato', false);
  streamTags.forEach((stream) => scan(stream.tags, `stream ${stream.index} (${stream.codecType})`, true));

  const totalTags = Object.keys(formatTags).length + streamTags.reduce((sum, s) => sum + Object.keys(s.tags).length, 0);

  return {
    clean: metadataTags === 0 && chapters === 0 && riskItems.length === 0,
    totalTags,
    metadataTags,
    chapters,
    formatTags,
    streamTags,
    riskItems,
    structuralTags
  };
}

/** Texto curto e humano para exibir na interface. */
function describeMetadata(report) {
  if (report.clean) {
    return report.structuralTags?.length
      ? 'Limpo: nenhum metadado do vídeo original. Restam só os campos técnicos obrigatórios do MP4.'
      : 'Limpo: nenhum metadado ou capítulo no arquivo.';
  }
  const parts = [`${report.metadataTags} tag(s) de metadados`];
  if (report.chapters) parts.push(`${report.chapters} capítulo(s)`);
  const risks = report.riskItems.length ? ` Risco: ${report.riskItems.slice(0, 3).join(' | ')}.` : '';
  return `Encontrado: ${parts.join(', ')}.${risks}`;
}

module.exports = { metadataArgs, sanitizeTagValue, inspectMetadata, describeMetadata };
