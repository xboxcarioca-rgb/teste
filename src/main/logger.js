/**
 * Logger simples com nível, carimbo de tempo e gravação em arquivo.
 * Em produção os logs ficam em <userData>/logs/viral-cut-studio.log.
 */

const fs = require('fs');
const path = require('path');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

class Logger {
  constructor(options = {}) {
    this.level = LEVELS[options.level || 'info'] || LEVELS.info;
    this.file = options.file || null;
    this.maxBytes = options.maxBytes || 2 * 1024 * 1024;
    if (this.file) this.#ensureFile();
  }

  #ensureFile() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      if (fs.existsSync(this.file) && fs.statSync(this.file).size > this.maxBytes) {
        fs.renameSync(this.file, `${this.file}.1`);
      }
    } catch {
      this.file = null;
    }
  }

  #write(level, message, meta) {
    if ((LEVELS[level] || 0) < this.level) return;
    const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}${meta ? ` ${safeJson(meta)}` : ''}`;
    if (process.env.VCS_DEBUG || level !== 'debug') {
      const sink = level === 'error' ? console.error : console.log;
      sink(line);
    }
    if (this.file) {
      try {
        fs.appendFileSync(this.file, `${line}\n`, 'utf8');
      } catch {
        /* logging não pode derrubar o app */
      }
    }
  }

  debug(message, meta) {
    this.#write('debug', message, meta);
  }

  info(message, meta) {
    this.#write('info', message, meta);
  }

  warn(message, meta) {
    this.#write('warn', message, meta);
  }

  error(message, meta) {
    this.#write('error', message, meta);
  }

  /** Devolve as últimas linhas do log (para mostrar na tela de diagnóstico). */
  tail(lines = 120) {
    if (!this.file || !fs.existsSync(this.file)) return '';
    try {
      const content = fs.readFileSync(this.file, 'utf8').split('\n');
      return content.slice(-lines).join('\n');
    } catch {
      return '';
    }
  }
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

let instance = null;

/** Inicializa (ou devolve) o logger global. */
function initLogger(options = {}) {
  instance = new Logger(options);
  return instance;
}

function getLogger() {
  if (!instance) instance = new Logger();
  return instance;
}

module.exports = { Logger, initLogger, getLogger, LEVELS };
