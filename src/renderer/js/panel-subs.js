/**
 * Passo 4 — Legendas: transcrição automática (Whisper) ou importação de .srt,
 * com editor de texto/tempos e controle completo do estilo.
 */
(function () {
  'use strict';

  const { el, $, toast, status, field, numberInput, rangeInput, timecode, parseTime, modal, esc, shortTime } = window.U;
  const Panels = (window.Panels = window.Panels || {});

  function render(container) {
    const state = window.Store.state;
    const project = state.project;
    const subs = project.subtitles;
    const style = subs.style;
    container.innerHTML = '';

    container.appendChild(
      el('div', { class: 'panel-head' }, [
        el('h2', { text: 'Legendas' }),
        el('p', { text: 'Transcreva com Whisper (offline, no seu computador) ou importe um .srt/.vtt. Você pode corrigir o texto e os tempos antes de queimar no vídeo.' })
      ])
    );

    // ------------------------------------------------------- ativar/origem --
    const enabledCheck = el('input', { type: 'checkbox', checked: subs.enabled ? 'checked' : undefined });
    enabledCheck.addEventListener('change', () => {
      window.Store.setProject('subtitles.enabled', enabledCheck.checked);
      render(container);
      window.dispatchEvent(new CustomEvent('vcs:project-changed'));
    });

    container.appendChild(
      el('div', { class: 'card' }, [
        el('label', { class: 'check' }, [
          enabledCheck,
          el('span', {}, [el('strong', { text: 'Queimar legendas no vídeo' }), el('small', { text: 'Legendas viram parte da imagem (não dá para desligar na plataforma).' })])
        ])
      ])
    );

    if (!subs.enabled) return;

    // --------------------------------------------------------- transcrição --
    const languageSelect = el('select', { class: 'input input-sm' }, [
      el('option', { value: 'pt', text: 'Português' }),
      el('option', { value: 'en', text: 'Inglês' }),
      el('option', { value: 'es', text: 'Espanhol' }),
      el('option', { value: 'fr', text: 'Francês' }),
      el('option', { value: 'it', text: 'Italiano' }),
      el('option', { value: 'de', text: 'Alemão' }),
      el('option', { value: 'auto', text: 'Detectar automaticamente' })
    ]);
    languageSelect.value = subs.language || 'pt';
    languageSelect.addEventListener('change', () => window.Store.setProject('subtitles.language', languageSelect.value));

    const modelSelect = el('select', { class: 'input input-sm' });
    const installedModels = state.tools?.whisper?.models || [];
    for (const model of installedModels.length ? installedModels : [{ id: 'small', label: 'Small — ~466 MB (recomendado)', installed: false }]) {
      modelSelect.appendChild(el('option', { value: model.id, text: model.installed ? `${model.label} ✓ baixado` : model.label }));
    }
    modelSelect.value = subs.modelSize || 'small';
    modelSelect.addEventListener('change', () => window.Store.setProject('subtitles.modelSize', modelSelect.value));

    const btnTranscribe = el('button', { class: 'btn btn-primary', text: 'Transcrever agora' });
    const btnCancel = el('button', { class: 'btn btn-danger is-hidden', text: 'Cancelar' });
    const btnImport = el('button', { class: 'btn btn-secondary', text: 'Importar .srt/.vtt' });
    const btnExport = el('button', { class: 'btn btn-ghost', text: 'Exportar .srt' });
    const progressWrap = el('div', { class: 'progress-line is-hidden' }, [el('div', { class: 'bar' }, [el('i')]), el('span', { class: 'pct', text: '0%' })]);

    btnTranscribe.addEventListener('click', () => runTranscription(btnTranscribe, btnCancel, progressWrap, modelSelect.value, languageSelect.value));
    btnCancel.addEventListener('click', () => state.activeJobId && window.vcs.subtitles.cancel(state.activeJobId));
    btnImport.addEventListener('click', importSubtitles);
    btnExport.addEventListener('click', exportSubtitles);

    const whisperState = state.tools?.whisper;
    container.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'Origem da legenda' }),
        whisperState
          ? el('div', { class: `callout ${whisperState.available ? 'callout-ok' : 'callout-info'} mb-12` }, [
              whisperState.available
                ? `Whisper instalado${whisperState.modelPath ? ' e modelo pronto' : ', modelo será baixado no primeiro uso'}.`
                : 'Whisper ainda não instalado. Ao clicar em "Transcrever agora" o app baixa o motor (whisper.cpp) e o modelo — uma vez só.'
            ])
          : null,
        el('div', { class: 'grid grid-2' }, [field('Idioma do áudio', languageSelect), field('Modelo', modelSelect, 'Modelos maiores são mais precisos e mais lentos.')]),
        el('div', { class: 'row mt-12 row-wrap' }, [btnTranscribe, btnCancel, btnImport, btnExport]),
        progressWrap,
        el('label', { class: 'check mt-8' }, [
          el('input', { type: 'checkbox', checked: subs.translateToEnglish ? 'checked' : undefined, onchange: (event) => window.Store.setProject('subtitles.translateToEnglish', event.target.checked) }),
          el('span', {}, [el('span', { text: 'Traduzir para o inglês' }), el('small', { text: 'Útil para alcançar público internacional.' })])
        ])
      ])
    );

    // -------------------------------------------------------------- estilo --
    container.appendChild(styleCard(project, container));

    // -------------------------------------------------------------- editor --
    container.appendChild(editorCard(project, container));
  }

  /** Roda a transcrição. */
  async function runTranscription(btn, btnCancel, progressWrap, modelId, language) {
    const state = window.Store.state;
    if (!state.source) return toast('Carregue um vídeo primeiro.', 'warn');

    btn.disabled = true;
    btnCancel.classList.remove('is-hidden');
    progressWrap.classList.remove('is-hidden');
    window.Store.setBusy('transcribe', true);
    status('Transcrevendo áudio…', '', 3);

    try {
      const response = await window.vcs.subtitles.transcribe({
        filePath: state.source.path,
        duration: state.source.probe?.duration || 0,
        language,
        modelId,
        translate: Boolean(state.project.subtitles.translateToEnglish)
      });
      if (!response.ok) throw new Error(response.error);
      window.Store.setCues(response.result.cues);
      toast(`${response.result.cues.length} legendas geradas.`, 'ok', 'Transcrição concluída');
      status('Transcrição concluída.', '', null);
      render($('#panel-subs'));
    } catch (error) {
      toast(String(error.message || error), 'err', 'Transcrição falhou');
      status('Transcrição falhou.', '', null);
    } finally {
      btn.disabled = false;
      btnCancel.classList.add('is-hidden');
      progressWrap.classList.add('is-hidden');
      window.Store.setBusy('transcribe', false);
    }
  }

  async function importSubtitles() {
    try {
      const filePath = await window.vcs.dialog.openSubtitle();
      if (!filePath) return;
      const result = await window.vcs.subtitles.import(filePath);
      window.Store.setCues(result.cues);
      toast(`${result.cues.length} legendas importadas.`, 'ok');
      render($('#panel-subs'));
    } catch (error) {
      toast(String(error.message || error), 'err', 'Falha ao importar');
    }
  }

  async function exportSubtitles() {
    const cues = window.Store.state.project?.subtitles?.cues || [];
    if (!cues.length) return toast('Não há legendas para exportar.', 'warn');
    try {
      const filePath = await window.vcs.dialog.saveProject(`${window.Store.state.project.name || 'legendas'}.srt`);
      if (!filePath) return;
      const target = filePath.endsWith('.srt') ? filePath : `${filePath}.srt`;
      await window.vcs.subtitles.export({ cues, filePath: target });
      toast('Legendas exportadas.', 'ok');
      window.vcs.app.openPath(target, 'folder');
    } catch (error) {
      toast(String(error.message || error), 'err', 'Falha ao exportar');
    }
  }

  /** Controles de estilo da legenda. */
  function styleCard(project, container) {
    const style = project.subtitles.style;
    const constants = window.Store.state.constants;
    const families = window.Store.state.tools?.fonts?.families || [];

    const fontSelect = el('input', { class: 'input input-sm', list: 'font-families', value: style.font || 'Montserrat' });
    const datalist = el('datalist', { id: 'font-families' }, families.slice(0, 300).map((family) => el('option', { value: family })));
    fontSelect.addEventListener('change', () => {
      window.Store.setProject('subtitles.style.font', fontSelect.value);
      window.dispatchEvent(new CustomEvent('vcs:project-changed'));
    });

    const animationSelect = el('select', { class: 'input input-sm' }, constants.subtitleAnimations.map((animation) => el('option', { value: animation.id, text: animation.label })));
    animationSelect.value = style.animation || 'karaoke';
    animationSelect.addEventListener('change', () => {
      window.Store.setProject('subtitles.style.animation', animationSelect.value);
      window.dispatchEvent(new CustomEvent('vcs:project-changed'));
    });

    const alignSelect = el('select', { class: 'input input-sm' }, [
      el('option', { value: 'bottom-center', text: 'Rodapé centralizada' }),
      el('option', { value: 'center', text: 'Centro da tela' }),
      el('option', { value: 'top-center', text: 'Topo centralizada' }),
      el('option', { value: 'bottom-left', text: 'Rodapé à esquerda' }),
      el('option', { value: 'bottom-right', text: 'Rodapé à direita' })
    ]);
    alignSelect.value = style.align || 'bottom-center';
    alignSelect.addEventListener('change', () => {
      window.Store.setProject('subtitles.style.align', alignSelect.value);
      window.dispatchEvent(new CustomEvent('vcs:project-changed'));
    });

    const bind = (key, transform = (value) => value) => (value) => {
      window.Store.setProject(`subtitles.style.${key}`, transform(value));
      window.dispatchEvent(new CustomEvent('vcs:project-changed'));
    };

    return el('div', { class: 'card' }, [
      datalist,
      el('h3', { text: 'Estilo da legenda' }),
      el('div', { class: 'grid grid-3' }, [
        field('Fonte', fontSelect, 'Qualquer fonte instalada no Windows; ou aponte um .ttf em "Arquivo de fonte".'),
        field('Animação', animationSelect, constants.subtitleAnimations.find((item) => item.id === animationSelect.value)?.description || ''),
        field('Posição', alignSelect)
      ]),
      el('div', { class: 'grid grid-3 mt-12' }, [
        field('Tamanho (altura do quadro)', rangeInput({ value: style.sizeRatio ?? 0.062, min: 0.02, max: 0.14, step: 0.002, onInput: bind('sizeRatio') })),
        field('Contorno', rangeInput({ value: style.outlineRatio ?? 0.0035, min: 0, max: 0.012, step: 0.0005, onInput: bind('outlineRatio') })),
        field('Margem da borda', rangeInput({ value: style.marginRatio ?? 0.16, min: 0, max: 0.4, step: 0.005, onInput: bind('marginRatio') }))
      ]),
      el('div', { class: 'grid grid-4 mt-12' }, [
        field('Cor do texto', el('input', { class: 'input', type: 'color', value: style.color || '#FFFFFF', oninput: (event) => bind('color')(event.target.value) })),
        field('Cor da palavra ativa', el('input', { class: 'input', type: 'color', value: style.activeWordColor || '#FFE14D', oninput: (event) => bind('activeWordColor')(event.target.value) }), 'Usada no modo karaoke.'),
        field('Cor do contorno', el('input', { class: 'input', type: 'color', value: style.outlineColor || '#000000', oninput: (event) => bind('outlineColor')(event.target.value) })),
        field('Máx. caracteres/linha', numberInput({ value: style.maxCharsPerLine ?? 22, min: 8, max: 60, step: 1, onInput: bind('maxCharsPerLine') }))
      ]),
      el('div', { class: 'row row-wrap mt-12' }, [
        toggle('Negrito', style.bold, bind('bold')),
        toggle('Itálico', style.italic, bind('italic')),
        toggle('CAIXA ALTA', style.uppercase, bind('uppercase')),
        toggle('Caixa de fundo', style.box, bind('box')),
        style.box ? colorField('Cor da caixa', style.boxColor || '#000000', bind('boxColor')) : null,
        style.box ? field('Opacidade da caixa', rangeInput({ value: style.boxOpacity ?? 0.55, min: 0, max: 1, step: 0.05, onInput: bind('boxOpacity') })) : null,
        el('span', { class: 'flex-1' }),
        el('button', { class: 'btn btn-ghost btn-sm', text: 'Escolher arquivo de fonte…', onclick: async () => { const file = await window.vcs.dialog.openFont(); if (file) { window.Store.setProject('subtitles.style.fontFile', file); toast('Fonte definida.', 'ok'); render(container); } } }),
        project.subtitles.style.fontFile ? el('button', { class: 'btn btn-ghost btn-sm', text: 'Limpar fonte', onclick: () => { window.Store.setProject('subtitles.style.fontFile', ''); render(container); } }) : null
      ]),
      project.subtitles.style.fontFile ? el('div', { class: 'hint mono', text: `Fonte: ${project.subtitles.style.fontFile}` }) : null
    ]);
  }

  function toggle(label, checked, onChange) {
    return el('label', { class: 'check' }, [
      el('input', { type: 'checkbox', checked: checked ? 'checked' : undefined, onchange: (event) => onChange(event.target.checked) }),
      el('span', { text: label })
    ]);
  }

  function colorField(label, value, onChange) {
    return field(label, el('input', { class: 'input', type: 'color', value, oninput: (event) => onChange(event.target.value) }));
  }

  /** Tabela editável de legendas. */
  function editorCard(project, container) {
    const cues = project.subtitles.cues || [];
    const search = el('input', { class: 'input input-sm', placeholder: 'Filtrar por texto…', style: { maxWidth: '260px' } });
    const tbody = el('tbody');

    const draw = () => {
      const needle = search.value.trim().toLowerCase();
      tbody.innerHTML = '';
      const filtered = cues
        .map((cue, index) => ({ cue, index }))
        .filter(({ cue }) => !needle || String(cue.text).toLowerCase().includes(needle));

      if (!filtered.length) {
        tbody.appendChild(el('tr', { class: 'is-empty-row' }, [el('td', { colspan: '5', text: needle ? 'Nada encontrado com esse filtro.' : 'Sem legendas. Transcreva ou importe um arquivo.' })]));
        return;
      }

      // Renderiza em lotes para não travar com milhares de legendas.
      const limit = Math.min(filtered.length, 600);
      for (let position = 0; position < limit; position += 1) {
        const { cue, index } = filtered[position];
        const startInput = el('input', { class: 'input input-sm', value: timecode(cue.start) });
        const endInput = el('input', { class: 'input input-sm', value: timecode(cue.end) });
        const textInput = el('input', { class: 'input input-sm', value: cue.text });

        startInput.addEventListener('change', () => {
          window.Store.updateCue(index, { start: Math.max(0, parseTime(startInput.value)) });
          render(container);
        });
        endInput.addEventListener('change', () => {
          window.Store.updateCue(index, { end: Math.max(parseTime(startInput.value) + 0.2, parseTime(endInput.value)) });
          render(container);
        });
        textInput.addEventListener('change', () => window.Store.updateCue(index, { text: textInput.value }));

        tbody.appendChild(
          el('tr', {}, [
            el('td', { class: 'time' }, [startInput]),
            el('td', { class: 'time' }, [endInput]),
            el('td', {}, [textInput]),
            el('td', { class: 'text-faint mono', text: `${(cue.end - cue.start).toFixed(2)}s` }),
            el('td', {}, [
              el('button', { class: 'btn btn-ghost btn-sm', text: '✕', title: 'Remover legenda', onclick: () => { window.Store.removeCue(index); render(container); } })
            ])
          ])
        );
      }
      if (filtered.length > limit) {
        tbody.appendChild(el('tr', { class: 'is-empty-row' }, [el('td', { colspan: '5', text: `Mostrando ${limit} de ${filtered.length}. Use o filtro para encontrar o trecho desejado.` })]));
      }
    };

    search.addEventListener('input', window.U.debounce(draw, 180));
    draw();

    return el('div', { class: 'card' }, [
      el('h3', { text: `Editor de legendas (${cues.length})` }),
      el('div', { class: 'row mb-8' }, [
        search,
        el('span', { class: 'flex-1' }),
        el('button', { class: 'btn btn-ghost btn-sm', text: 'CAIXA ALTA em tudo', onclick: () => { window.Store.setCues(cues.map((cue) => ({ ...cue, text: String(cue.text).toUpperCase() }))); render(container); } }),
        el('button', { class: 'btn btn-ghost btn-sm', text: 'Requebrar linhas', onclick: () => { window.Store.setCues(window.U.reflow(cues, project.subtitles.style.maxCharsPerLine || 22)); render(container); } }),
        el('button', { class: 'btn btn-ghost btn-sm', text: 'Limpar tudo', onclick: async () => { if (await window.U.confirmDialog('Limpar legendas', 'Apagar todas as legendas?')) { window.Store.setCues([]); render(container); } } })
      ]),
      el('div', { class: 'table-wrap' }, [
        el('table', {}, [
          el('thead', {}, [el('tr', {}, [el('th', { text: 'Início' }), el('th', { text: 'Fim' }), el('th', { text: 'Texto' }), el('th', { text: 'Duração' }), el('th', { text: '' })])]),
          tbody
        ])
      ])
    ]);
  }

  Panels.subs = { render };
})();
