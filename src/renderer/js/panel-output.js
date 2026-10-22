/**
 * Passo 6 — Saída: encoder, qualidade, áudio, remoção de metadados e a fila
 * de renderização com resultados.
 */
(function () {
  'use strict';

  const { el, $, toast, status, field, numberInput, rangeInput, bytes, shortTime, modal, scoreColor } = window.U;
  const Panels = (window.Panels = window.Panels || {});

  function render(container) {
    const state = window.Store.state;
    const project = state.project;
    const output = project.output;
    container.innerHTML = '';

    container.appendChild(
      el('div', { class: 'panel-head' }, [
        el('h2', { text: 'Renderizar' }),
        el('p', { text: 'Qualidade, áudio e privacidade. A remoção de metadados apaga tags, encoder, datas, GPS e capítulos do arquivo final.' })
      ])
    );

    // ------------------------------------------------------------ vídeo -----
    const hwEncoders = state.tools?.ffmpeg?.capabilities?.hardwareEncoders || [];
    const codecSelect = select(
      [
        { value: 'h264', label: 'H.264 (compatível com tudo)' },
        { value: 'h265', label: 'H.265/HEVC (menor arquivo)' }
      ],
      output.videoCodec || 'h264',
      (value) => set('videoCodec', value)
    );

    const hwSelect = select(
      [
        { value: 'auto', label: hwEncoders.length ? `Automático (${hwEncoders.join(', ')})` : 'Automático (sem GPU detectada)' },
        { value: 'none', label: 'CPU (mais compatível)' }
      ],
      output.hardwareAcceleration || 'auto',
      (value) => set('hardwareAcceleration', value)
    );

    const presetSelect = select(
      ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'].map((preset) => ({
        value: preset,
        label: preset
      })),
      output.preset || 'medium',
      (value) => set('preset', value)
    );

    const rateSelect = select(
      [
        { value: 'crf', label: 'Qualidade constante (CRF) — recomendado' },
        { value: 'bitrate', label: 'Taxa de bits fixa (kbps)' }
      ],
      output.rateControl || 'crf',
      (value) => {
        set('rateControl', value);
        render(container);
      }
    );

    container.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'Vídeo' }),
        el('div', { class: 'grid grid-3' }, [
          field('Codec', codecSelect),
          field('Aceleração', hwSelect, hwEncoders.length ? 'Se a GPU falhar, o app repete em CPU automaticamente.' : 'Nenhum encoder de GPU encontrado neste FFmpeg.'),
          field('Preset (velocidade × tamanho)', presetSelect)
        ]),
        el('div', { class: 'grid grid-3 mt-12' }, [
          field('Controle de taxa', rateSelect),
          output.rateControl === 'bitrate'
            ? field('Taxa (kbps)', numberInput({ value: output.videoBitrateKbps || 10000, min: 500, max: 80000, step: 500, onInput: (value) => value && set('videoBitrateKbps', value) }))
            : field('CRF', rangeInput({ value: output.crf ?? 20, min: 14, max: 34, step: 1, format: (value) => String(Math.round(value)), onInput: (value) => set('crf', Math.round(value)) }), 'Menor = mais qualidade e arquivo maior. 18–23 é o ideal para redes sociais.'),
          field('Formato do arquivo', select([{ value: 'mp4', label: 'MP4 (H.264 + AAC)' }], 'mp4', () => {}, true))
        ])
      ])
    );

    // ------------------------------------------------------------ áudio -----
    const audio = output.audio || {};
    container.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'Áudio' }),
        el('div', { class: 'grid grid-3' }, [
          field('Taxa (kbps)', select([{ value: '128', label: '128' }, { value: '160', label: '160' }, { value: '192', label: '192 (padrão)' }, { value: '256', label: '256' }, { value: '320', label: '320' }], String(audio.bitrateKbps || 192), (value) => set('audio.bitrateKbps', parseInt(value, 10)))),
          field('Fade in (s)', numberInput({ value: audio.fadeIn ?? 0, min: 0, max: 5, step: 0.1, onInput: (value) => value !== null && set('audio.fadeIn', value) })),
          field('Fade out (s)', numberInput({ value: audio.fadeOut ?? 0, min: 0, max: 5, step: 0.1, onInput: (value) => value !== null && set('audio.fadeOut', value) }))
        ]),
        el('label', { class: 'check mt-8' }, [
          el('input', { type: 'checkbox', checked: audio.normalize !== false ? 'checked' : undefined, onchange: (event) => { set('audio.normalize', event.target.checked); render(container); } }),
          el('span', {}, [
            el('strong', { text: 'Normalizar volume (EBU R128)' }),
            el('small', { text: 'Deixa o áudio no nível padrão das redes sociais — evita corte mais baixo que os outros vídeos do feed.' })
          ])
        ]),
        audio.normalize !== false
          ? el('div', { class: 'grid grid-2 mt-8' }, [
              field('Alvo (LUFS)', numberInput({ value: audio.targetLoudness ?? -14, min: -30, max: -6, step: 0.5, onInput: (value) => value !== null && set('audio.targetLoudness', value) }), '-14 LUFS é o padrão de Reels/TikTok/Shorts.'),
              field('Pico verdadeiro (dBTP)', numberInput({ value: audio.truePeak ?? -1, min: -9, max: 0, step: 0.5, onInput: (value) => value !== null && set('audio.truePeak', value) }))
            ])
          : null
      ])
    );

    // --------------------------------------------------------- metadados ----
    container.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'Metadados e privacidade' }),
        el('p', { class: 'card-sub', text: 'Arquivos baixados carregam autor original, data de criação, software e às vezes GPS. Remover isso evita que a plataforma identifique o conteúdo como reupload.' }),
        el('label', { class: 'check' }, [
          el('input', { type: 'checkbox', checked: output.stripMetadata !== false ? 'checked' : undefined, onchange: (event) => set('stripMetadata', event.target.checked) }),
          el('span', {}, [el('strong', { text: 'Remover todos os metadados' }), el('small', { text: 'Tags globais e por stream, além de impedir a gravação do nome do encoder.' })])
        ]),
        el('label', { class: 'check' }, [
          el('input', { type: 'checkbox', checked: output.stripChapters !== false ? 'checked' : undefined, onchange: (event) => set('stripChapters', event.target.checked) }),
          el('span', {}, [el('strong', { text: 'Remover capítulos' }), el('small', { text: 'Vídeos do YouTube costumam trazer capítulos embutidos.' })])
        ]),
        el('label', { class: 'check' }, [
          el('input', { type: 'checkbox', checked: output.keepOnlyCleanTitle ? 'checked' : undefined, onchange: (event) => set('keepOnlyCleanTitle', event.target.checked) }),
          el('span', {}, [el('strong', { text: 'Manter apenas o título limpo' }), el('small', { text: `Usa o nome do projeto ("${project.name}") como única tag.` })])
        ]),
        el('label', { class: 'check' }, [
          el('input', { type: 'checkbox', checked: output.faststart !== false ? 'checked' : undefined, onchange: (event) => set('faststart', event.target.checked) }),
          el('span', {}, [el('strong', { text: 'Otimizar para web (faststart)' }), el('small', { text: 'Move o índice para o início: o vídeo começa a tocar antes de terminar de carregar.' })])
        ]),
        el('div', { class: 'row mt-12' }, [
          el('button', { class: 'btn btn-ghost btn-sm', text: 'Verificar metadados do arquivo final', onclick: () => verifyLastOutput() })
        ])
      ])
    );

    // ------------------------------------------------------------- destino --
    const patternInput = el('input', { class: 'input input-sm mono', value: output.filenamePattern || '{title}-{format}-{index}' });
    patternInput.addEventListener('change', () => set('filenamePattern', patternInput.value));

    const dirInput = el('input', { class: 'input input-sm mono', value: state.settings?.outputDir || state.appInfo?.paths?.output || '', readonly: 'readonly' });
    container.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'Destino' }),
        el('div', { class: 'grid grid-2' }, [
          field('Padrão do nome do arquivo', patternInput, 'Variáveis: {title} {format} {index} {score} {duration} {start} {date} {layout}'),
          field('Pasta de saída', el('div', { class: 'row' }, [
            dirInput,
            el('button', { class: 'btn btn-secondary btn-sm', text: 'Trocar…', onclick: async () => { const dir = await window.vcs.dialog.chooseDir('Pasta de saída dos cortes'); if (dir) { await window.vcs.app.setSettings({ outputDir: dir }); window.Store.set({ settings: await window.vcs.app.getSettings() }); render(container); } } }),
            el('button', { class: 'btn btn-ghost btn-sm', text: 'Abrir', onclick: () => window.vcs.app.openPath(state.settings?.outputDir || state.appInfo?.paths?.output, 'folder') })
          ]))
        ])
      ])
    );

    // --------------------------------------------------------- renderizar ---
    const selected = window.Store.selectedCuts();
    const btnRender = el('button', { class: 'btn btn-primary btn-lg', text: `Renderizar ${selected.length || ''} corte(s)` });
    const btnCancel = el('button', { class: 'btn btn-danger is-hidden', text: 'Cancelar render' });
    btnRender.disabled = !selected.length || !state.source;
    btnRender.addEventListener('click', () => startRender(btnRender, btnCancel));
    btnCancel.addEventListener('click', () => state.activeJobId && window.vcs.render.cancel(state.activeJobId));

    container.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'Fila' }),
        el('div', { class: 'row row-wrap' }, [
          btnRender,
          btnCancel,
          el('button', { class: 'btn btn-secondary', text: 'Ver comando FFmpeg', onclick: () => showCommand() }),
          el('span', { class: 'flex-1' }),
          selected.length ? el('span', { class: 'text-dim', text: `${selected.length} corte(s) · ${shortTime(selected.reduce((sum, cut) => sum + (cut.end - cut.start), 0))} de vídeo` }) : el('span', { class: 'text-warn', text: 'Selecione ao menos um corte no passo 2.' })
        ])
      ])
    );

    container.appendChild(resultsCard());

    function set(key, value) {
      window.Store.setProject(`output.${key}`, value);
      window.dispatchEvent(new CustomEvent('vcs:project-changed'));
    }
  }

  function select(options, value, onChange, disabled = false) {
    const node = el('select', { class: 'input input-sm', disabled: disabled || undefined }, options.map((option) => el('option', { value: option.value, text: option.label })));
    node.value = String(value);
    node.addEventListener('change', () => onChange(node.value));
    return node;
  }

  /** Inicia o render da fila. */
  async function startRender(btnRender, btnCancel) {
    const state = window.Store.state;
    const project = state.project;
    const clips = window.Store.selectedCuts().map((cut) => ({
      start: cut.start,
      end: cut.end,
      duration: Math.max(0.5, cut.end - cut.start),
      score: cut.score,
      label: cut.label
    }));

    if (!clips.length) return toast('Nenhum corte selecionado.', 'warn');

    // Validação antes de gastar tempo de CPU.
    const validation = await window.vcs.render.validate({ project, sources: window.Store.sourcesForRender() });
    if (validation.problems.length) {
      toast(validation.problems.join(' '), 'err', 'Não é possível renderizar');
      return;
    }
    if (validation.warnings.length) {
      const proceed = await window.U.confirmDialog('Avisos antes de renderizar', validation.warnings.join('\n'));
      if (!proceed) return;
    }

    btnRender.disabled = true;
    btnCancel.classList.remove('is-hidden');
    window.Store.setBusy('render', true);
    window.Store.set({ results: [] });
    status('Renderizando…', '', 0);

    try {
      const response = await window.vcs.render.start({
        project,
        clips,
        sources: window.Store.sourcesForRender(),
        outputDir: state.settings?.outputDir || undefined
      });
      if (!response.ok) throw new Error(response.error);
      const result = response.result;
      window.Store.set({ results: result.results, activeJobId: null });
      toast(`${result.succeeded} de ${result.total} cortes prontos em ${result.outputDir}`, result.succeeded ? 'ok' : 'err', 'Render finalizado');
      status('Render finalizado.', '', null);
      render($('#panel-output'));
      window.vcs.app.openPath(result.outputDir, 'folder');
    } catch (error) {
      toast(String(error.message || error), 'err', 'Render falhou');
      status('Render falhou.', '', null);
    } finally {
      btnRender.disabled = false;
      btnCancel.classList.add('is-hidden');
      window.Store.setBusy('render', false);
    }
  }

  /** Resultados com botão para abrir/tocar e relatório de metadados. */
  function resultsCard() {
    const results = window.Store.state.results || [];
    if (!results.length) {
      return el('div', { class: 'card' }, [
        el('h3', { text: 'Resultados' }),
        el('div', { class: 'empty', text: 'Nada renderizado ainda.' })
      ]);
    }

    const list = el('div');
    for (const item of results) {
      list.appendChild(
        el('div', { class: 'result-item' }, [
          el('div', {}, [
            el('div', { class: 'result-title' }, [
              item.ok ? el('span', { class: 'badge badge-ok', text: 'pronto' }) : el('span', { class: 'badge badge-err', text: 'falhou' }),
              el('span', { text: ` ${item.outputPath ? item.outputPath.split(/[\\/]/).pop() : `item ${item.index + 1}`}` })
            ]),
            el('div', { class: 'result-path', text: item.ok ? `${bytes(item.sizeBytes)} · ${(item.durationMs / 1000).toFixed(1)}s de render · metadados: ${item.metadataClean === null ? 'n/d' : item.metadataClean ? 'limpos ✓' : 'ainda há tags'}` : item.error || '' }),
            (item.warnings || []).length ? el('div', { class: 'result-path text-warn', text: item.warnings.slice(0, 2).join(' · ') }) : null
          ]),
          el('div', { class: 'row' }, [
            item.ok ? el('button', { class: 'btn btn-secondary btn-sm', text: '▶ Tocar', onclick: () => playResult(item) }) : null,
            item.ok ? el('button', { class: 'btn btn-ghost btn-sm', text: 'Pasta', onclick: () => window.vcs.app.openPath(item.outputPath, 'folder') }) : null
          ])
        ])
      );
    }

    return el('div', { class: 'card' }, [el('h3', { text: `Resultados (${results.length})` }), list]);
  }

  function playResult(item) {
    const video = $('#preview-video');
    const frame = $('#preview-frame');
    if (!video) return;
    video.src = item.url;
    frame.classList.add('has-media');
    video.play().catch(() => {});
    window.Store.set({ previewUrl: item.url });
  }

  /** Mostra o comando FFmpeg que seria executado (transparência/debug). */
  async function showCommand() {
    const state = window.Store.state;
    const clips = window.Store.selectedCuts();
    if (!clips.length) return toast('Selecione um corte primeiro.', 'warn');
    const clip = clips[0];
    try {
      const result = await window.vcs.render.inspectCommand({
        project: state.project,
        clip: { start: clip.start, end: clip.end, duration: Math.max(0.5, clip.end - clip.start) },
        sources: window.Store.sourcesForRender()
      });
      const command = `ffmpeg ${result.args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(' ')}`;
      modal({
        title: 'Comando FFmpeg do primeiro corte',
        width: 'min(860px, 100%)',
        body: el('div', {}, [
          el('pre', { class: 'code', text: command }),
          (result.warnings || []).length ? el('div', { class: 'callout callout-warn mt-12' }, [el('strong', { text: 'Avisos:' }), el('ul', {}, result.warnings.map((warning) => el('li', { text: warning })))]) : null,
          el('div', { class: 'hint mt-12', text: `Encoder: ${result.encoder} · alvo: ${result.geometry.target.width}×${result.geometry.target.height} · modo: ${result.geometry.mode}` })
        ]),
        footer: [
          el('button', { class: 'btn btn-secondary', text: 'Copiar', onclick: () => { navigator.clipboard.writeText(command).then(() => toast('Comando copiado.', 'ok')); } }),
          el('button', { class: 'btn btn-primary', text: 'Fechar', onclick: () => $('#modal-root').classList.add('is-hidden') })
        ]
      });
    } catch (error) {
      toast(String(error.message || error), 'err', 'Falha ao montar o comando');
    }
  }

  /** Confere os metadados do último arquivo renderizado. */
  async function verifyLastOutput() {
    const results = (window.Store.state.results || []).filter((item) => item.ok);
    if (!results.length) return toast('Renderize um corte primeiro.', 'warn');
    const filePath = results[results.length - 1].outputPath;
    try {
      const report = await window.vcs.metadata.inspect(filePath);
      modal({
        title: 'Metadados do arquivo final',
        body: el('div', {}, [
          el('div', { class: `callout ${report.clean ? 'callout-ok' : 'callout-err'}`, text: report.description }),
          el('div', { class: 'hint mt-12', text: `Arquivo: ${filePath}` }),
          report.riskItems?.length ? el('ul', { class: 'text-dim' }, report.riskItems.map((item) => el('li', { text: item }))) : null
        ]),
        footer: [el('button', { class: 'btn btn-primary', text: 'Fechar', onclick: () => $('#modal-root').classList.add('is-hidden') })]
      });
    } catch (error) {
      toast(String(error.message || error), 'err');
    }
  }

  Panels.output = { render, showCommand, playResult };
})();
