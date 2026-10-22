/**
 * Boot, navegação e amarração geral da interface.
 */
(function () {
  'use strict';

  const { el, $, $$, toast, status, modal, shortTime, bytes, debounce } = window.U;
  const Panels = window.Panels || {};

  const STEP_RENDERERS = {
    source: () => Panels.source?.render($('#panel-source')),
    cuts: () => Panels.cuts?.render($('#panel-cuts')),
    format: () => Panels.format?.render($('#panel-format')),
    subs: () => Panels.subs?.render($('#panel-subs')),
    banner: () => Panels.banner?.render($('#panel-banner')),
    output: () => Panels.output?.render($('#panel-output')),
    tools: () => Panels.tools?.render($('#panel-tools'))
  };

  let currentStep = 'source';

  // ------------------------------------------------------------------ boot --
  async function boot() {
    status('Iniciando…');
    try {
      const [constants, appInfo, settings, project] = await Promise.all([
        window.vcs.app.constants(),
        window.vcs.app.info(),
        window.vcs.app.getSettings(),
        window.vcs.project.create()
      ]);

      window.Store.set({ constants, appInfo, settings, project, ready: true });

      wireTopbar();
      wireNavigation();
      wireSidebar();
      wireEvents();
      wireJobs();

      renderSidebar();
      goto(settings.defaults?.startStep || 'source');

      // Ferramentas em segundo plano para não atrasar a abertura.
      const tools = await window.vcs.tools.status(false);
      window.Store.set({ tools });
      updateFfmpegBadge();
      renderSidebar();
      if (currentStep === 'tools') STEP_RENDERERS.tools();

      if (!tools.ffmpeg?.available) {
        toast('FFmpeg não encontrado. Reinstale o aplicativo ou aponte o caminho em Ferramentas.', 'err', 'Atenção', 9000);
      }
      status('Pronto.');
    } catch (error) {
      console.error(error);
      status('Falha ao iniciar.');
      toast(String(error.message || error), 'err', 'Erro na inicialização', 12000);
    }
  }

  /** Badge do FFmpeg no topo. */
  function updateFfmpegBadge() {
    const badge = $('#ffmpeg-badge');
    const tools = window.Store.state.tools;
    if (!badge) return;
    if (!tools) {
      badge.className = 'badge badge-muted';
      badge.textContent = 'verificando FFmpeg…';
      return;
    }
    if (tools.ffmpeg?.available) {
      const missing = [];
      if (!tools.ffmpeg.capabilities?.hasDrawtext) missing.push('drawtext');
      if (!tools.ffmpeg.capabilities?.hasSubtitles) missing.push('libass');
      badge.className = `badge ${missing.length ? 'badge-warn' : 'badge-ok'}`;
      badge.textContent = missing.length ? `FFmpeg sem ${missing.join('/')}` : `FFmpeg ${tools.ffmpeg.version || 'ok'}`;
    } else {
      badge.className = 'badge badge-err';
      badge.textContent = 'FFmpeg ausente';
    }
    badge.title = tools.ffmpeg?.path || '';
  }

  // ----------------------------------------------------------- navegação ----
  function wireNavigation() {
    $$('#steps .step').forEach((button) => {
      button.addEventListener('click', () => goto(button.dataset.step));
    });
  }

  function goto(step) {
    if (!STEP_RENDERERS[step]) return;
    currentStep = step;
    $$('#steps .step').forEach((button) => button.classList.toggle('is-active', button.dataset.step === step));
    $$('.panel').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === step));
    // O painel de ferramentas não está na lista de passos; liga o botão do topo.
    $('#btn-tools')?.classList.toggle('btn-secondary', step === 'tools');
    STEP_RENDERERS[step]();
    $('#content').scrollTop = 0;
    renderSidebar();
  }

  // -------------------------------------------------------------- topbar ----
  function wireTopbar() {
    $('#btn-tools').addEventListener('click', () => goto(currentStep === 'tools' ? 'source' : 'tools'));

    $('#btn-new-project').addEventListener('click', async () => {
      const proceed = await window.U.confirmDialog('Novo projeto', 'Descartar o projeto atual e começar do zero?');
      if (!proceed) return;
      const project = await window.vcs.project.create();
      window.Store.set({ project, source: null, extraSources: [], analysis: null, cuts: [], results: [], previewUrl: null, urlInfo: null });
      applyTemplateId(project.templateId);
      goto('source');
      toast('Novo projeto criado.', 'ok');
    });

    $('#btn-save-project').addEventListener('click', saveProject);
    $('#btn-open-project').addEventListener('click', openProject);

    const nameNode = $('#project-name');
    nameNode.addEventListener('click', async () => {
      const value = await window.U.promptDialog('Nome do projeto', 'Como você quer chamar este projeto?', window.Store.state.project?.name || '');
      if (value) {
        window.Store.setProject('name', value);
        renderSidebar();
      }
    });
  }

  async function saveProject() {
    try {
      const filePath = await window.vcs.dialog.saveProject(window.Store.state.project?.name || 'projeto');
      if (!filePath) return;
      const target = filePath.endsWith('.json') ? filePath : `${filePath}.vcs.json`;
      await window.vcs.project.save({ project: window.Store.state.project, filePath: target });
      toast('Projeto salvo.', 'ok');
    } catch (error) {
      toast(String(error.message || error), 'err', 'Falha ao salvar');
    }
  }

  async function openProject() {
    try {
      const filePath = await window.vcs.dialog.openProject();
      if (!filePath) return;
      const project = await window.vcs.project.load(filePath);
      window.Store.set({ project, source: null, extraSources: [], analysis: null, cuts: project.segments || [], results: [] });
      if (project.sources?.[0]?.path) {
        try {
          const probe = await window.vcs.media.probe(project.sources[0].path);
          window.Store.setSource({ path: project.sources[0].path, probe, title: project.name });
        } catch {
          toast('O vídeo do projeto não foi encontrado neste computador.', 'warn');
        }
      }
      applyTemplateId(project.templateId);
      goto('source');
      toast('Projeto carregado.', 'ok');
    } catch (error) {
      toast(String(error.message || error), 'err', 'Falha ao abrir');
    }
  }

  // -------------------------------------------------------------- sidebar ---
  function wireSidebar() {
    $('#btn-preview').addEventListener('click', generatePreview);
    $('#template-select').addEventListener('change', (event) => applyTemplateId(event.target.value));
    $('#btn-save-template').addEventListener('click', saveTemplate);
    $('#btn-manage-templates').addEventListener('click', manageTemplates);
    loadTemplates();
  }

  async function loadTemplates() {
    try {
      const templates = await window.vcs.templates.list();
      window.Store.set({ templates });
      const select = $('#template-select');
      select.innerHTML = '';
      for (const template of templates) {
        select.appendChild(el('option', { value: template.id, text: `${template.builtin ? '' : '★ '}${template.name}` }));
      }
      select.value = window.Store.state.project?.templateId || templates[0]?.id;
      const current = templates.find((template) => template.id === select.value);
      $('#template-hint').textContent = current?.description || '';
    } catch (error) {
      toast(String(error.message || error), 'err', 'Falha ao carregar templates');
    }
  }

  /** Aplica um template preservando fonte/cortes/legendas existentes. */
  async function applyTemplateId(templateId) {
    if (!templateId) return;
    const state = window.Store.state;
    const template = (state.templates || []).find((item) => item.id === templateId);
    if (!template) return;

    const preserved = {
      sources: state.project.sources,
      segments: state.project.segments,
      name: state.project.name,
      id: state.project.id,
      cues: state.project.subtitles?.cues || [],
      logoPath: state.project.banner?.logo?.path || '',
      fontFile: state.project.subtitles?.style?.fontFile || '',
      outputDir: state.project.output?.outputDir
    };

    const merged = JSON.parse(JSON.stringify(state.project));
    const patch = template.patch || {};
    Object.assign(merged.output, patch.output || {});
    if (patch.subtitles) {
      merged.subtitles.enabled = patch.subtitles.enabled ?? merged.subtitles.enabled;
      Object.assign(merged.subtitles.style, patch.subtitles.style || {});
    }
    if (patch.banner) {
      if (patch.banner.text) Object.assign(merged.banner.text, patch.banner.text);
      if (patch.banner.logo) Object.assign(merged.banner.logo, patch.banner.logo);
      if (patch.banner.progressBar) Object.assign(merged.banner.progressBar, patch.banner.progressBar);
    }
    merged.templateId = templateId;

    merged.sources = preserved.sources;
    merged.segments = preserved.segments;
    merged.name = preserved.name;
    merged.id = preserved.id;
    merged.subtitles.cues = preserved.cues;
    merged.subtitles.style.fontFile = preserved.fontFile;
    merged.banner.logo.path = preserved.logoPath;
    merged.output.outputDir = preserved.outputDir;

    window.Store.setProjectWhole(merged);
    const select = $('#template-select');
    if (select) select.value = templateId;
    const hint = $('#template-hint');
    if (hint) hint.textContent = template.description || '';

    if (currentStep !== 'source') STEP_RENDERERS[currentStep]?.();
    renderSidebar();
    toast(`Template "${template.name}" aplicado.`, 'ok');
  }

  async function saveTemplate() {
    const name = await window.U.promptDialog('Salvar template', 'Nome do template', `${window.Store.state.project?.name || 'Meu'} — visual`);
    if (!name) return;
    try {
      await window.vcs.templates.save({ project: window.Store.state.project, name, description: 'Criado a partir do projeto atual.' });
      await loadTemplates();
      toast('Template salvo.', 'ok');
    } catch (error) {
      toast(String(error.message || error), 'err', 'Falha ao salvar template');
    }
  }

  async function manageTemplates() {
    const templates = window.Store.state.templates || [];
    const list = el('div', { class: 'cut-list' });
    const refresh = () => {
      window.vcs.templates.list().then((items) => {
        window.Store.set({ templates: items });
        list.innerHTML = '';
        for (const template of items) draw(template);
      });
    };
    const draw = (template) => {
      list.appendChild(
        el('div', { class: 'cut-item' }, [
          el('div', {}, [
            el('div', { class: 'cut-title' }, [el('span', { text: template.name }), template.builtin ? el('span', { class: 'chip', text: 'pronto' }) : el('span', { class: 'chip', text: 'personalizado' })]),
            el('div', { class: 'cut-reasons', text: template.description || '' })
          ]),
          el('div', { class: 'row' }, [
            el('button', { class: 'btn btn-secondary btn-sm', text: 'Aplicar', onclick: () => { applyTemplateId(template.id); instance.close(); } }),
            template.builtin
              ? null
              : el('button', {
                  class: 'btn btn-ghost btn-sm',
                  text: 'Apagar',
                  onclick: async () => {
                    if (await window.U.confirmDialog('Apagar template', `Apagar "${template.name}"?`)) {
                      await window.vcs.templates.delete(template.id);
                      refresh();
                    }
                  }
                })
          ])
        ])
      );
    };
    templates.forEach(draw);
    const instance = modal({
      title: 'Templates',
      width: 'min(680px, 100%)',
      body: list,
      footer: [el('button', { class: 'btn btn-primary', text: 'Fechar', onclick: () => $('#modal-root').classList.add('is-hidden') })]
    });
  }

  /** Resumo lateral (o que já está configurado). */
  function renderSidebar() {
    const state = window.Store.state;
    const project = state.project;
    if (!project) return;

    $('#project-name').textContent = project.name || 'Novo projeto';

    const format = state.constants?.formats?.find((item) => item.id === project.output.formatId);
    const layout = state.constants?.layouts?.find((item) => item.id === project.output.layout);
    const selected = window.Store.selectedCuts();
    const summary = $('#summary');
    summary.innerHTML = '';
    const rows = [
      ['Fonte', state.source ? shortTime(state.source.probe?.duration || 0) : '—'],
      ['Cortes', `${selected.length}${state.cuts?.length ? ` / ${state.cuts.length}` : ''}`],
      ['Formato', format ? format.ratio : project.output.formatId],
      ['Enquadramento', layout ? layout.label : project.output.layout],
      ['Legendas', project.subtitles.enabled ? `${(project.subtitles.cues || []).length} linhas` : 'desligadas'],
      ['Banner', project.banner.text.enabled ? 'texto' : project.banner.logo.enabled ? 'logo' : 'não'],
      ['Metadados', project.output.stripMetadata !== false ? 'removidos' : 'mantidos'],
      ['Codec', `${project.output.videoCodec === 'h265' ? 'H.265' : 'H.264'} · CRF ${project.output.crf}`]
    ];
    for (const [term, value] of rows) {
      summary.appendChild(el('dt', { text: term }));
      summary.appendChild(el('dd', { text: value }));
    }

    // Seletor de corte para a prévia.
    const segmentSelect = $('#preview-segment');
    if (segmentSelect) {
      const previous = segmentSelect.value;
      segmentSelect.innerHTML = '';
      if (state.cuts?.length) {
        for (const cut of state.cuts) {
          segmentSelect.appendChild(el('option', { value: cut.id, text: `${cut.label} · ${shortTime(cut.end - cut.start)}` }));
        }
      } else {
        segmentSelect.appendChild(el('option', { value: '', text: 'sem cortes' }));
      }
      if (previous && [...segmentSelect.options].some((option) => option.value === previous)) segmentSelect.value = previous;
    }

    renderJobs();
  }

  function renderJobs() {
    const box = $('#jobs');
    if (!box) return;
    const jobs = window.Store.state.jobs || [];
    box.innerHTML = '';
    if (!jobs.length) {
      box.appendChild(el('div', { class: 'empty', text: 'Nenhuma tarefa ainda.' }));
      return;
    }
    for (const job of jobs.slice(0, 8)) {
      const stateClass = job.status === 'done' ? 'is-done' : job.status === 'failed' ? 'is-failed' : '';
      box.appendChild(
        el('div', { class: `job ${stateClass}` }, [
          el('div', { class: 'job-head' }, [
            el('span', { class: 'job-name', text: job.name || job.kind }),
            job.status === 'running' || job.status === 'queued'
              ? el('button', { class: 'btn btn-ghost btn-sm', text: '✕', title: 'Cancelar', onclick: () => window.vcs.render.cancel(job.id) })
              : el('span', { class: 'badge badge-muted', text: job.status })
          ]),
          el('div', { class: 'job-msg', text: job.message || '' }),
          el('div', { class: 'job-bar' }, [el('i', { style: { width: `${job.progress || 0}%` } })])
        ])
      );
    }
  }

  // -------------------------------------------------------------- eventos ---
  function wireEvents() {
    window.addEventListener('vcs:goto', (event) => goto(event.detail));
    window.addEventListener('vcs:project-changed', debounce(() => renderSidebar(), 120));
    window.addEventListener('vcs:source-changed', () => {
      renderSidebar();
      if (currentStep === 'cuts') STEP_RENDERERS.cuts();
    });
    window.addEventListener('vcs:preview-cut', (event) => generatePreview(event.detail));

    // Atalhos.
    window.addEventListener('keydown', (event) => {
      if (event.target.matches('input, textarea, select')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveProject();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        generatePreview();
      } else if (event.key >= '1' && event.key <= '6') {
        goto(['source', 'cuts', 'format', 'subs', 'banner', 'output'][Number(event.key) - 1]);
      }
    });
  }

  /** Gera a prévia rápida de um corte. */
  async function generatePreview(cutOverride = null) {
    const state = window.Store.state;
    if (!state.source) return toast('Carregue um vídeo primeiro.', 'warn');
    const selectedId = cutOverride?.id || $('#preview-segment')?.value;
    const cut = cutOverride || (state.cuts || []).find((item) => item.id === selectedId) || (state.cuts || [])[0];
    if (!cut) return toast('Selecione um corte no passo 2.', 'warn');

    const button = $('#btn-preview');
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Gerando…';
    status('Gerando prévia…', '', 5);
    try {
      const response = await window.vcs.render.preview({
        project: state.project,
        clip: { start: cut.start, end: Math.min(cut.end, cut.start + (state.project.output.preview?.seconds || 6)), duration: Math.min(cut.end - cut.start, state.project.output.preview?.seconds || 6) },
        sources: window.Store.sourcesForRender()
      });
      if (!response.ok) throw new Error(response.error);
      const video = $('#preview-video');
      const frame = $('#preview-frame');
      video.src = response.result.url;
      frame.classList.add('has-media');
      await video.play().catch(() => {});
      window.Store.set({ previewUrl: response.result.url });
      status('Prévia pronta.', '', null);
      if (response.result.warnings?.length) toast(response.result.warnings[0], 'warn', 'Aviso');
      else toast('Prévia gerada (resolução reduzida).', 'ok');
    } catch (error) {
      toast(String(error.message || error), 'err', 'Prévia falhou');
      status('Prévia falhou.', '', null);
    } finally {
      button.disabled = false;
      button.textContent = 'Gerar prévia rápida';
    }
  }

  /** Assina eventos de job vindos do processo principal. */
  function wireJobs() {
    window.vcs.jobs.onChange((job) => {
      window.Store.upsertJob(job);
      renderJobs();
      if (job.kind === 'render' || job.kind === 'preview') {
        status(job.message || 'Renderizando…', job.progress ? `${job.progress}%` : '', job.progress ?? null);
      } else if (job.kind === 'download') {
        status(job.message || 'Baixando…', job.progress ? `${job.progress}%` : '', job.progress ?? null);
      } else if (job.kind === 'transcribe') {
        status(job.message || 'Transcrevendo…', job.progress ? `${job.progress}%` : '', job.progress ?? null);
        updateInlineProgress('#panel-subs', job);
      } else if (job.kind === 'analyze') {
        status(job.message || 'Analisando…', job.progress ? `${job.progress}%` : '', job.progress ?? null);
        updateInlineProgress('#panel-cuts', job);
      } else if (job.kind === 'tool-install') {
        status(job.message || 'Instalando ferramenta…', job.progress ? `${job.progress}%` : '', job.progress ?? null);
      }
      if (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') {
        setTimeout(() => status('Pronto.', '', null), 2200);
      }
    });

    window.vcs.render.onEvent((event) => {
      if (event.stage === 'done' && event.url) {
        const results = [...(window.Store.state.results || [])];
        const existing = results.findIndex((item) => item.index === event.index);
        const item = { index: event.index, ok: true, outputPath: event.outputPath, url: event.url, sizeBytes: event.sizeBytes, warnings: event.warnings, metadataClean: event.metadata?.clean ?? null, durationMs: 0 };
        if (existing === -1) results.push(item);
        else results[existing] = { ...results[existing], ...item };
        window.Store.set({ results });
        if (currentStep === 'output') STEP_RENDERERS.output();
      }
    });

    window.Store.subscribe((_state, reason) => {
      if (reason === 'project' || reason === 'cuts' || reason === 'cues' || reason === 'source' || reason === 'project:replace') renderSidebar();
    });
  }

  /** Atualiza a barra de progresso dentro de um painel específico. */
  function updateInlineProgress(panelSelector, job) {
    const wrap = $(`${panelSelector} .progress-line`);
    if (!wrap || wrap.classList.contains('is-hidden')) return;
    wrap.classList.remove('is-hidden');
    const bar = wrap.querySelector('.bar i');
    const pct = wrap.querySelector('.pct');
    if (bar) bar.style.width = `${job.progress || 0}%`;
    if (pct) pct.textContent = `${job.progress || 0}%`;
  }

  document.addEventListener('DOMContentLoaded', boot);
  window.VCS = { goto, renderSidebar, generatePreview, applyTemplateId };
})();
