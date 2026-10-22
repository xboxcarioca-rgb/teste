/**
 * Passo 2 — Cortes: análise automática e seleção dos trechos virais.
 */
(function () {
  'use strict';

  const { el, $, toast, status, shortTime, timecode, parseTime, field, numberInput, rangeInput, scoreColor, modal, confirmDialog } = window.U;
  const Panels = (window.Panels = window.Panels || {});

  function render(container) {
    const state = window.Store.state;
    const project = state.project;
    container.innerHTML = '';

    container.appendChild(
      el('div', { class: 'panel-head' }, [
        el('h2', { text: 'Cortes virais' }),
        el('p', {
          text: 'O app analisa mudanças de cena, silêncios (pontos de respiração) e a energia do áudio para sugerir trechos que começam com gancho, não cortam palavras no meio e têm a duração certa para a plataforma.'
        })
      ])
    );

    if (!state.source) {
      container.appendChild(
        el('div', { class: 'callout callout-warn' }, [
          'Carregue um vídeo no passo 1 antes de detectar cortes. ',
          el('button', { class: 'btn btn-ghost btn-sm', text: 'Ir para Fonte', onclick: () => window.dispatchEvent(new CustomEvent('vcs:goto', { detail: 'source' })) })
        ])
      );
      return;
    }

    const settings = project.cutSettings || {};

    // ------------------------------------------------------- parâmetros -----
    const modeSelect = el('select', { class: 'input input-sm' }, [
      el('option', { value: 'auto', text: 'Automático (recomendado)' }),
      el('option', { value: 'speech', text: 'Priorizar fala (cortar nas respirações)' }),
      el('option', { value: 'scenes', text: 'Por mudança de cena' }),
      el('option', { value: 'fixed', text: 'Blocos fixos de duração' }),
      el('option', { value: 'manual', text: 'Somente manual' })
    ]);
    modeSelect.value = settings.mode || 'auto';
    modeSelect.addEventListener('change', () => {
      window.Store.setProject('cutSettings.mode', modeSelect.value);
      if (state.analysis) repropose();
    });

    const btnAnalyze = el('button', { class: 'btn btn-primary', text: state.analysis ? 'Reanalisar vídeo' : 'Detectar cortes virais' });
    const btnCancel = el('button', { class: 'btn btn-danger is-hidden', text: 'Cancelar análise' });
    const progressWrap = el('div', { class: 'progress-line is-hidden' }, [
      el('div', { class: 'bar' }, [el('i')]),
      el('span', { class: 'pct', text: '0%' })
    ]);

    btnAnalyze.addEventListener('click', () => runAnalysis(btnAnalyze, btnCancel, progressWrap));
    btnCancel.addEventListener('click', () => {
      if (state.activeJobId) window.vcs.analysis.cancel(state.activeJobId);
    });

    container.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'Detecção' }),
        el('div', { class: 'grid grid-4' }, [
          field('Modo', modeSelect),
          field('Duração mínima (s)', numberInput({ value: settings.targetMinSeconds ?? 15, min: 3, max: 300, step: 1, onInput: (value) => onSettingChange('targetMinSeconds', value) })),
          field('Duração máxima (s)', numberInput({ value: settings.targetMaxSeconds ?? 60, min: 5, max: 900, step: 1, onInput: (value) => onSettingChange('targetMaxSeconds', value) })),
          field('Quantidade de cortes', numberInput({ value: settings.maxCuts ?? 8, min: 1, max: 40, step: 1, onInput: (value) => onSettingChange('maxCuts', value) }))
        ]),
        el('div', { class: 'grid grid-3 mt-12' }, [
          field('Sensibilidade de cena', rangeInput({ value: settings.sceneThreshold ?? 0.28, min: 0.05, max: 0.7, step: 0.01, onInput: (value) => onSettingChange('sceneThreshold', value) })),
          field('Silêncio mínimo (s)', numberInput({ value: settings.silenceMinDuration ?? 0.45, min: 0.1, max: 3, step: 0.05, onInput: (value) => onSettingChange('silenceMinDuration', value) })),
          field('Limiar de silêncio (dB)', numberInput({ value: settings.silenceThresholdDb ?? -35, min: -70, max: -10, step: 1, onInput: (value) => onSettingChange('silenceThresholdDb', value) }))
        ]),
        el('label', { class: 'check' }, [
          el('input', {
            type: 'checkbox',
            checked: settings.snapToSpeech !== false ? 'checked' : undefined,
            onchange: (event) => {
              onSettingChange('snapToSpeech', event.target.checked);
              if (state.analysis) repropose();
            }
          }),
          el('span', {}, [
            el('span', { text: 'Encaixar cortes nas respirações' }),
            el('small', { text: 'Evita começar ou terminar no meio de uma palavra.' })
          ])
        ]),
        el('div', { class: 'row mt-12' }, [btnAnalyze, btnCancel,
          el('button', { class: 'btn btn-secondary btn-sm', text: '+ Corte manual', onclick: () => addManualCut() }),
          el('span', { class: 'text-faint', text: state.analysis ? `Análise pronta: ${state.analysis.scenes?.length || 0} cenas, ${state.analysis.speech?.length || 0} trechos de fala` : 'Nenhuma análise ainda.' })
        ]),
        progressWrap
      ])
    );

    // ---------------------------------------------------------- timeline ----
    container.appendChild(timelineCard());

    // ------------------------------------------------------------- lista ----
    container.appendChild(cutListCard());

    function onSettingChange(key, value) {
      if (value === null || value === undefined) return;
      window.Store.setProject(`cutSettings.${key}`, value);
    }
  }

  /** Roda a análise completa. */
  async function runAnalysis(btnAnalyze, btnCancel, progressWrap) {
    const state = window.Store.state;
    const source = state.source;
    if (!source) return toast('Carregue um vídeo primeiro.', 'warn');

    btnAnalyze.disabled = true;
    btnCancel.classList.remove('is-hidden');
    progressWrap.classList.remove('is-hidden');
    window.Store.setBusy('analyze', true);
    status('Analisando vídeo…', '', 1);

    try {
      const response = await window.vcs.analysis.run({
        filePath: source.path,
        duration: source.probe.duration,
        hasAudio: source.probe.hasAudio,
        cutSettings: state.project.cutSettings
      });
      if (!response.ok) throw new Error(response.error);
      window.Store.set({ analysis: response.result.analysis });
      window.Store.setCuts(response.result.cuts);
      toast(`${response.result.cuts.length} cortes sugeridos.`, 'ok', 'Análise concluída');
      status('Análise concluída.', '', null);
      render($('#panel-cuts'));
    } catch (error) {
      toast(String(error.message || error), 'err', 'Análise falhou');
      status('Análise falhou.', '', null);
    } finally {
      btnAnalyze.disabled = false;
      btnCancel.classList.add('is-hidden');
      progressWrap.classList.add('is-hidden');
      window.Store.setBusy('analyze', false);
    }
  }

  /** Recalcula os cortes com a análise existente (mudou um parâmetro). */
  async function repropose() {
    const state = window.Store.state;
    if (!state.analysis || !state.source) return;
    try {
      const result = await window.vcs.analysis.proposeCuts({
        duration: state.source.probe.duration,
        analysis: state.analysis,
        cutSettings: state.project.cutSettings
      });
      window.Store.setCuts(result.cuts);
      render($('#panel-cuts'));
    } catch (error) {
      toast(String(error.message || error), 'err', 'Falha ao recalcular cortes');
    }
  }

  /** Card da linha do tempo com waveform, cenas e cortes. */
  function timelineCard() {
    const state = window.Store.state;
    const duration = state.source?.probe?.duration || 0;
    const wave = state.analysis?.waveform || [];
    const scenes = state.analysis?.scenes || [];
    const cuts = state.cuts || [];

    const waveBox = el('div', { class: 'timeline-wave' });
    if (wave.length) {
      for (const value of wave) waveBox.appendChild(el('i', { style: { height: `${Math.max(4, value * 100)}%` } }));
    } else {
      waveBox.appendChild(el('div', { class: 'empty', style: { width: '100%' }, text: 'Sem waveform — rode a detecção para ver o áudio e as cenas.' }));
    }

    const sceneBox = el('div', { class: 'timeline-scenes' });
    for (const scene of scenes) {
      sceneBox.appendChild(el('i', { style: { left: `${(scene / duration) * 100}%` }, title: `Cena em ${shortTime(scene)}` }));
    }

    const cutBox = el('div', { class: 'timeline-cuts' });
    for (const cut of cuts) {
      const left = (cut.start / duration) * 100;
      const width = Math.max(1.2, ((cut.end - cut.start) / duration) * 100);
      cutBox.appendChild(
        el('span', {
          class: cut.selected === false ? 'is-off' : '',
          style: { left: `${left}%`, width: `${width}%`, background: cut.selected === false ? undefined : `rgba(47,208,122,${0.15 + (cut.score / 100) * 0.25})` },
          title: `${cut.label} · ${shortTime(cut.start)} → ${shortTime(cut.end)} · nota ${Math.round(cut.score)}`,
          text: cut.label.replace('Corte ', ''),
          onclick: () => window.Store.updateCut(cut.id, { selected: cut.selected === false })
        })
      );
    }

    return el('div', { class: 'card' }, [
      el('h3', { text: 'Linha do tempo' }),
      el('div', { class: 'timeline' }, [
        waveBox,
        sceneBox,
        cutBox,
        el('div', { class: 'timeline-axis' }, [el('span', { text: '0:00' }), el('span', { text: shortTime(duration / 2) }), el('span', { text: shortTime(duration) })])
      ]),
      el('div', { class: 'hint' }, [
        'Barras: energia do áudio. ',
        el('span', { style: { color: 'var(--accent-2)' }, text: '▏' }),
        ' mudanças de cena. Blocos verdes: cortes sugeridos (clique para ligar/desligar).'
      ])
    ]);
  }

  /** Lista editável de cortes. */
  function cutListCard() {
    const state = window.Store.state;
    const cuts = state.cuts || [];
    const list = el('div', { class: 'cut-list' });

    if (!cuts.length) {
      list.appendChild(el('div', { class: 'empty', text: 'Nenhum corte ainda. Rode a detecção ou adicione um corte manual.' }));
    }

    for (const cut of cuts) {
      const startInput = el('input', { class: 'input input-sm', value: timecode(cut.start) });
      const endInput = el('input', { class: 'input input-sm', value: timecode(cut.end) });
      const durationLabel = el('span', { class: 'text-dim mono', text: `${shortTime(cut.end - cut.start)}`, style: { minWidth: '52px' } });

      const applyTimes = () => {
        const start = Math.max(0, parseTime(startInput.value));
        const end = Math.max(start + 1, parseTime(endInput.value));
        const durationLimit = state.source?.probe?.duration || end;
        window.Store.updateCut(cut.id, {
          start: Math.min(start, durationLimit - 1),
          end: Math.min(end, durationLimit),
          duration: Math.min(end, durationLimit) - Math.min(start, durationLimit - 1)
        });
        render($('#panel-cuts'));
      };
      startInput.addEventListener('change', applyTimes);
      endInput.addEventListener('change', applyTimes);

      list.appendChild(
        el('div', { class: `cut-item${cut.selected === false ? ' is-off' : ''}` }, [
          el('div', { class: 'cut-score', style: { background: scoreColor(cut.score) }, text: String(Math.round(cut.score)), title: 'Pontuação do corte (0-100)' }),
          el('div', { class: 'cut-main' }, [
            el('div', { class: 'cut-title' }, [
              el('span', { text: cut.label }),
              el('span', { class: 'chip', text: `${shortTime(cut.duration ?? cut.end - cut.start)}` }),
              cut.metrics?.speechDensity != null ? el('span', { class: 'chip', text: `fala ${Math.round(cut.metrics.speechDensity * 100)}%` }) : null
            ]),
            el('div', { class: 'cut-reasons', text: (cut.reasons || []).join(' · ') || 'sem observações' })
          ]),
          el('div', { class: 'cut-times' }, [
            startInput,
            el('span', { class: 'text-faint', text: '→' }),
            endInput,
            durationLabel,
            el('button', { class: 'btn btn-ghost btn-sm', text: '▶', title: 'Pré-visualizar este corte', onclick: () => window.dispatchEvent(new CustomEvent('vcs:preview-cut', { detail: cut })) }),
            el('button', {
              class: 'btn btn-ghost btn-sm',
              text: cut.selected === false ? 'Ativar' : 'Desativar',
              onclick: () => { window.Store.updateCut(cut.id, { selected: cut.selected === false }); render($('#panel-cuts')); }
            }),
            el('button', {
              class: 'btn btn-ghost btn-sm',
              text: '✕',
              title: 'Remover corte',
              onclick: async () => {
                if (await confirmDialog('Remover corte', `Remover "${cut.label}"?`)) {
                  window.Store.setCuts((state.cuts || []).filter((item) => item.id !== cut.id));
                  render($('#panel-cuts'));
                }
              }
            })
          ])
        ])
      );
    }

    const selected = cuts.filter((cut) => cut.selected !== false);
    return el('div', { class: 'card' }, [
      el('h3', { text: `Cortes (${selected.length} selecionados de ${cuts.length})` }),
      list,
      el('div', { class: 'row mt-12' }, [
        el('button', { class: 'btn btn-ghost btn-sm', text: 'Marcar todos', onclick: () => { window.Store.setCuts(cuts.map((cut) => ({ ...cut, selected: true }))); render($('#panel-cuts')); } }),
        el('button', { class: 'btn btn-ghost btn-sm', text: 'Desmarcar todos', onclick: () => { window.Store.setCuts(cuts.map((cut) => ({ ...cut, selected: false }))); render($('#panel-cuts')); } }),
        el('button', { class: 'btn btn-ghost btn-sm', text: 'Só os 3 melhores', onclick: () => keepBest(3) }),
        el('span', { class: 'flex-1' }),
        el('button', { class: 'btn btn-primary', text: 'Ir para formato →', onclick: () => window.dispatchEvent(new CustomEvent('vcs:goto', { detail: 'format' })) })
      ])
    ]);

    function keepBest(count) {
      const ranked = [...cuts].sort((a, b) => b.score - a.score);
      const keep = new Set(ranked.slice(0, count).map((cut) => cut.id));
      window.Store.setCuts(cuts.map((cut) => ({ ...cut, selected: keep.has(cut.id) })));
      render($('#panel-cuts'));
    }
  }

  /** Adiciona um corte manual no meio do vídeo. */
  function addManualCut() {
    const state = window.Store.state;
    const duration = state.source?.probe?.duration || 60;
    const min = state.project.cutSettings?.targetMinSeconds ?? 15;
    const start = Math.max(0, duration / 2 - min / 2);
    const cut = {
      id: `manual_${Date.now().toString(36)}`,
      start: Math.round(start * 100) / 100,
      end: Math.round(Math.min(duration, start + min) * 100) / 100,
      duration: Math.min(min, duration - start),
      score: 50,
      reasons: ['corte manual'],
      label: `Corte ${(state.cuts?.length || 0) + 1}`,
      selected: true,
      manual: true
    };
    window.Store.setCuts([...(state.cuts || []), cut]);
    render($('#panel-cuts'));
    toast('Corte manual adicionado. Ajuste o início e o fim.', 'ok');
  }

  Panels.cuts = { render, addManualCut, repropose };
})();
