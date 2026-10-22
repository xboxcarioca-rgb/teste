/**
 * Fila de trabalhos (renders, downloads, análises, transcrições).
 *
 * Um trabalho por vez para render (FFmpeg já usa todos os núcleos), com
 * cancelamento real via AbortController e eventos para a interface.
 */

const { EventEmitter } = require('events');
const { getLogger } = require('./logger');

const JOB_KINDS = {
  RENDER: 'render',
  PREVIEW: 'preview',
  DOWNLOAD: 'download',
  ANALYZE: 'analyze',
  TRANSCRIBE: 'transcribe',
  TOOL_INSTALL: 'tool-install'
};

const JOB_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

class JobManager extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map();
    this.queue = [];
    this.running = null;
  }

  /**
   * Cria um trabalho.
   * @param {{kind:string,name:string,payload?:object,concurrent?:boolean}} options
   * @returns {{id:string,kind:string,name:string,status:string,createdAt:string}}
   */
  create({ kind, name, payload = {}, concurrent = false }) {
    const id = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const job = {
      id,
      kind,
      name,
      payload,
      concurrent,
      status: JOB_STATUS.QUEUED,
      progress: 0,
      message: 'Na fila…',
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      result: null,
      error: null,
      controller: new AbortController()
    };
    this.jobs.set(id, job);
    this.emitChange(job);
    return this.public(job);
  }

  /** Versão serializável (sem AbortController). */
  public(job) {
    if (!job) return null;
    const { controller, payload, ...rest } = job;
    return { ...rest, payload: undefined };
  }

  /** Lista todos os trabalhos (mais recentes primeiro). */
  list() {
    return [...this.jobs.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((job) => this.public(job));
  }

  get(id) {
    return this.public(this.jobs.get(id));
  }

  /** Sinal de cancelamento do trabalho. */
  signalFor(id) {
    return this.jobs.get(id)?.controller.signal || null;
  }

  emitChange(job, extra = {}) {
    this.emit('change', { ...this.public(job), ...extra });
  }

  update(id, patch) {
    const job = this.jobs.get(id);
    if (!job) return null;
    Object.assign(job, patch);
    this.emitChange(job);
    return this.public(job);
  }

  /** Reporta progresso (0..100) e mensagem. */
  progress(id, percent, message) {
    const job = this.jobs.get(id);
    if (!job) return;
    job.progress = Math.max(0, Math.min(100, Math.round(percent)));
    if (message) job.message = message;
    this.emitChange(job);
  }

  /**
   * Executa uma função assíncrona como trabalho.
   * Trabalhos `concurrent` (download/análise) rodam imediatamente; renders
   * entram na fila sequencial.
   *
   * @param {string} id
   * @param {(context:{job:object,signal:AbortSignal,progress:(p:number,m?:string)=>void})=>Promise<any>} task
   */
  async run(id, task) {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Trabalho ${id} não existe.`);

    const progress = (percent, message) => this.progress(id, percent, message);
    const context = { job, signal: job.controller.signal, progress };

    if (job.concurrent) {
      return this.#execute(job, context, task);
    }

    // Fila sequencial para renders.
    await new Promise((resolve) => {
      this.queue.push({ job, resolve });
      this.#pump();
    });

    // Cancelado enquanto esperava na fila: nem chega a executar.
    if (job.status === JOB_STATUS.CANCELLED) return null;
    return this.#execute(job, context, task);
  }

  #pump() {
    if (this.running || !this.queue.length) return;
    const next = this.queue.shift();
    this.running = next.job.id;
    next.resolve();
  }

  async #execute(job, context, task) {
    job.status = JOB_STATUS.RUNNING;
    job.startedAt = new Date().toISOString();
    this.emitChange(job);
    getLogger().info(`Job iniciado: ${job.kind} ${job.name}`, { id: job.id });

    try {
      const result = await task(context);
      job.result = result;
      job.status = JOB_STATUS.DONE;
      job.progress = 100;
      job.message = 'Concluído.';
      getLogger().info(`Job concluído: ${job.id}`);
      this.emitChange(job);
      return result;
    } catch (error) {
      const cancelled = context.signal.aborted || /cancelad/i.test(String(error?.message || ''));
      job.status = cancelled ? JOB_STATUS.CANCELLED : JOB_STATUS.FAILED;
      job.error = String(error?.message || error);
      job.message = cancelled ? 'Cancelado.' : job.error;
      getLogger().warn(`Job ${cancelled ? 'cancelado' : 'falhou'}: ${job.id}`, { error: job.error });
      this.emitChange(job);
      if (!cancelled) throw error;
      return null;
    } finally {
      job.finishedAt = new Date().toISOString();
      if (this.running === job.id) {
        this.running = null;
        this.#pump();
      }
    }
  }

  /** Cancela um trabalho (e o remove da fila, se ainda não começou). */
  cancel(id) {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.status === JOB_STATUS.DONE || job.status === JOB_STATUS.FAILED) return false;
    job.controller.abort();
    const queuedIndex = this.queue.findIndex((item) => item.job.id === id);
    if (queuedIndex !== -1) {
      const [removed] = this.queue.splice(queuedIndex, 1);
      removed.job.status = JOB_STATUS.CANCELLED;
      removed.job.message = 'Cancelado antes de iniciar.';
      this.emitChange(removed.job);
      removed.resolve();
    }
    return true;
  }

  /** Remove trabalhos finalizados (mantém os últimos N). */
  prune(keep = 30) {
    const finished = [...this.jobs.values()]
      .filter((job) => [JOB_STATUS.DONE, JOB_STATUS.FAILED, JOB_STATUS.CANCELLED].includes(job.status))
      .sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1));
    finished.slice(keep).forEach((job) => this.jobs.delete(job.id));
    return this.list();
  }
}

module.exports = { JobManager, JOB_KINDS, JOB_STATUS };
