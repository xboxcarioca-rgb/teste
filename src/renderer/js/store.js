/**
 * Store do renderer: estado do projeto + fontes + cortes + assinatura de mudanças.
 *
 * O estado "verdadeiro" vive aqui; os painéis só leem e pedem mudanças.
 * Nada é enviado ao processo principal sem passar por `Store`.
 */
(function () {
  'use strict';

  const listeners = new Set();
  const state = {
    ready: false,
    constants: null,
    appInfo: null,
    settings: null,
    tools: null,
    fonts: [],
    templates: [],
    project: null,
    /** Fonte primária (arquivo local já baixado ou escolhido). */
    source: null,
    /** Fontes adicionais para tela dividida. */
    extraSources: [],
    /** Informações do link antes de baixar. */
    urlInfo: null,
    /** Resultado da análise (cenas, silêncios, energia, waveform). */
    analysis: null,
    /** Cortes propostos (podem ser ligados/desligados pelo usuário). */
    cuts: [],
    /** Resultados de render. */
    results: [],
    jobs: [],
    activeJobId: null,
    previewUrl: null,
    busy: {}
  };

  function emit(reason) {
    for (const listener of listeners) {
      try {
        listener(state, reason);
      } catch (error) {
        console.error('listener falhou', error);
      }
    }
  }

  const Store = {
    state,

    /** Assina mudanças. Devolve função para cancelar. */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Atualiza o estado (merge raso) e notifica. */
    set(patch, reason = 'set') {
      Object.assign(state, patch);
      emit(reason);
      return state;
    },

    /**
     * Atualiza uma parte aninhada do projeto por caminho ("output.crf").
     * @param {string} pathStr
     * @param {*} value
     */
    setProject(pathStr, value, reason = 'project') {
      if (!state.project) return null;
      const keys = String(pathStr).split('.');
      let cursor = state.project;
      for (let index = 0; index < keys.length - 1; index += 1) {
        const key = keys[index];
        if (typeof cursor[key] !== 'object' || cursor[key] === null) cursor[key] = {};
        cursor = cursor[key];
      }
      cursor[keys[keys.length - 1]] = value;
      emit(reason);
      return state.project;
    },

    getProject() {
      return state.project;
    },

    /** Substitui o projeto inteiro (novo/aberto/template). */
    setProjectWhole(project, reason = 'project:replace') {
      state.project = project;
      emit(reason);
    },

    /** Marca uma operação como em andamento (para desabilitar botões). */
    setBusy(key, value) {
      state.busy = { ...state.busy, [key]: value };
      emit('busy');
    },

    isBusy(key) {
      return Boolean(state.busy[key]);
    },

    // ------------------------------------------------------------- fontes ---
    setSource(source) {
      state.source = source;
      state.analysis = null;
      state.cuts = [];
      state.results = [];
      if (source?.probe) {
        state.project.sources = [
          {
            kind: 'file',
            path: source.path,
            title: source.title || '',
            duration: source.probe.duration,
            width: source.probe.width,
            height: source.probe.height,
            fps: source.probe.fps,
            hasAudio: source.probe.hasAudio
          },
          ...(state.extraSources || [])
        ];
        // Ajusta o fps do projeto para o da fonte (evita conversão desnecessária).
        if (source.probe.fps && Math.abs(source.probe.fps - state.project.output.fps) < 0.6) {
          state.project.output.fps = Math.round(source.probe.fps);
        }
      }
      emit('source');
    },

    addExtraSource(source) {
      state.extraSources = [...(state.extraSources || []), source].slice(0, 2);
      state.project.sources = [
        ...(state.project.sources || []).slice(0, 1),
        ...state.extraSources.map((item) => ({
          kind: 'file',
          path: item.path,
          duration: item.probe?.duration || 0,
          width: item.probe?.width || 0,
          height: item.probe?.height || 0,
          fps: item.probe?.fps || 30,
          hasAudio: Boolean(item.probe?.hasAudio)
        }))
      ];
      emit('source');
    },

    removeExtraSource(index) {
      state.extraSources = (state.extraSources || []).filter((_, position) => position !== index);
      state.project.sources = [
        ...(state.project.sources || []).slice(0, 1),
        ...state.extraSources.map((item) => ({
          kind: 'file',
          path: item.path,
          duration: item.probe?.duration || 0,
          width: item.probe?.width || 0,
          height: item.probe?.height || 0,
          fps: item.probe?.fps || 30,
          hasAudio: Boolean(item.probe?.hasAudio)
        }))
      ];
      emit('source');
    },

    /** Lista de fontes no formato que o motor espera. */
    sourcesForRender() {
      const all = [state.source, ...(state.extraSources || [])].filter((item) => item?.path);
      return all.map((item) => ({
        path: item.path,
        width: item.probe?.width || 1920,
        height: item.probe?.height || 1080,
        hasAudio: item.probe ? Boolean(item.probe.hasAudio) : true,
        duration: item.probe?.duration || 0
      }));
    },

    // -------------------------------------------------------------- cortes ---
    setCuts(cuts) {
      state.cuts = cuts || [];
      state.project.segments = state.cuts;
      emit('cuts');
    },

    updateCut(id, patch) {
      state.cuts = state.cuts.map((cut) => (cut.id === id ? { ...cut, ...patch } : cut));
      state.project.segments = state.cuts;
      emit('cuts');
    },

    selectedCuts() {
      return state.cuts.filter((cut) => cut.selected !== false);
    },

    // ----------------------------------------------------------- legendas ---
    setCues(cues) {
      state.project.subtitles.cues = cues || [];
      emit('cues');
    },

    updateCue(index, patch) {
      const cues = [...(state.project.subtitles.cues || [])];
      cues[index] = { ...cues[index], ...patch };
      state.project.subtitles.cues = cues;
      emit('cues');
    },

    removeCue(index) {
      const cues = (state.project.subtitles.cues || []).filter((_, position) => position !== index);
      state.project.subtitles.cues = cues;
      emit('cues');
    },

    // -------------------------------------------------------------- jobs ---
    upsertJob(job) {
      const existing = state.jobs.findIndex((item) => item.id === job.id);
      if (existing === -1) state.jobs = [job, ...state.jobs].slice(0, 40);
      else state.jobs = state.jobs.map((item) => (item.id === job.id ? { ...item, ...job } : item));
      emit('jobs');
    },

    cancelJob(jobId) {
      state.jobs = state.jobs.map((job) => (job.id === jobId ? { ...job, status: 'cancelled' } : job));
      emit('jobs');
    }
  };

  window.Store = Store;
})();
