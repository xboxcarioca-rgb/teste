/**
 * Passo 3 — Formato e modelo de corte (9:16, 1:1, 4:5, 16:9 + layouts).
 */
(function () {
  'use strict';

  const { el, $, toast, field, numberInput, rangeInput, optionCard, ratioThumb } = window.U;
  const Panels = (window.Panels = window.Panels || {});

  function render(container) {
    const state = window.Store.state;
    const project = state.project;
    const constants = state.constants;
    container.innerHTML = '';

    container.appendChild(
      el('div', { class: 'panel-head' }, [
        el('h2', { text: 'Modelo de corte' }),
        el('p', { text: 'Escolha a proporção (o formato do quadro) e como o vídeo se encaixa nela: preencher cortando bordas, "metade" com fundo desfocado, barras coloridas ou tela dividida.' })
      ])
    );

    // ---------------------------------------------------------- formatos ----
    const formatOptions = el('div', { class: 'options' });
    for (const format of constants.formats) {
      const selected = project.output.formatId === format.id;
      const thumb = format.id === 'custom'
        ? el('div', { class: 'ratio-thumb' }, [el('i', { style: { width: '34px', height: '34px', borderStyle: 'dashed' } })])
        : ratioThumb(format.width, format.height);

      formatOptions.appendChild(
        optionCard({
          title: format.label,
          description: format.ratio === 'custom' ? `${project.output.width}×${project.output.height}px` : `${format.width}×${format.height}px`,
          meta: format.platforms.slice(0, 3),
          selected,
          thumb,
          onClick: () => {
            window.Store.setProject('output.formatId', format.id);
            if (format.id !== 'custom') {
              window.Store.setProject('output.width', format.width);
              window.Store.setProject('output.height', format.height);
            }
            render(container);
            window.dispatchEvent(new CustomEvent('vcs:project-changed'));
          }
        })
      );
    }

    container.appendChild(el('div', { class: 'card' }, [el('h3', { text: 'Proporção' }), formatOptions]));

    // Tamanho personalizado
    if (project.output.formatId === 'custom') {
      container.appendChild(
        el('div', { class: 'card' }, [
          el('h3', { text: 'Tamanho personalizado' }),
          el('div', { class: 'grid grid-3' }, [
            field('Largura (px)', numberInput({ value: project.output.width, min: 64, max: 7680, step: 2, onInput: (value) => { if (value) { window.Store.setProject('output.width', value % 2 ? value + 1 : value); render(container); } } })),
            field('Altura (px)', numberInput({ value: project.output.height, min: 64, max: 7680, step: 2, onInput: (value) => { if (value) { window.Store.setProject('output.height', value % 2 ? value + 1 : value); render(container); } } })),
            field('FPS', numberInput({ value: project.output.fps, min: 10, max: 240, step: 1, onInput: (value) => value && window.Store.setProject('output.fps', value) }))
          ])
        ])
      );
    }

    // ----------------------------------------------------------- layouts ----
    const layoutOptions = el('div', { class: 'options' });
    for (const layout of constants.layouts) {
      const selected = project.output.layout === layout.id;
      layoutOptions.appendChild(
        optionCard({
          title: layout.label,
          description: layout.description,
          meta: layout.needsSecondSource ? ['2+ vídeos'] : [],
          selected,
          thumb: layoutThumb(layout.id),
          onClick: () => {
            window.Store.setProject('output.layout', layout.id);
            const recommended = constants.splitRecommended?.[layout.id];
            if (recommended && !recommended.includes(project.output.formatId)) {
              window.Store.setProject('output.formatId', recommended[0]);
              const format = constants.formats.find((item) => item.id === recommended[0]);
              if (format) {
                window.Store.setProject('output.width', format.width);
                window.Store.setProject('output.height', format.height);
              }
              toast(`Formato trocado para ${recommended[0]} (melhor para esse layout).`, 'info');
            }
            render(container);
            window.dispatchEvent(new CustomEvent('vcs:project-changed'));
          }
        })
      );
    }
    container.appendChild(el('div', { class: 'card' }, [el('h3', { text: 'Enquadramento' }), layoutOptions]));

    // -------------------------------------------------------- foco do corte --
    const focusCard = el('div', { class: 'card' }, [
      el('h3', { text: 'Ponto de foco' }),
      el('p', { class: 'card-sub', text: 'Quando o vídeo é cortado para preencher o quadro, essa é a parte que permanece visível. Clique no quadro para definir (útil para manter o rosto de quem fala).' })
    ]);
    focusCard.appendChild(focusPicker(project));
    focusCard.appendChild(
      el('div', { class: 'grid grid-2 mt-12' }, [
        field('Horizontal', rangeInput({ value: project.output.focusX ?? 0.5, min: 0, max: 1, step: 0.01, onInput: (value) => { window.Store.setProject('output.focusX', value); window.dispatchEvent(new CustomEvent('vcs:project-changed')); } })),
        field('Vertical', rangeInput({ value: project.output.focusY ?? 0.45, min: 0, max: 1, step: 0.01, onInput: (value) => { window.Store.setProject('output.focusY', value); window.dispatchEvent(new CustomEvent('vcs:project-changed')); } }))
      ])
    );
    container.appendChild(focusCard);

    // ------------------------------------------------------------- fundo ----
    const background = project.output.background || {};
    const showBackground = ['fit-blur', 'fit-solid', 'split-h', 'split-v', 'split-v-triple'].includes(project.output.layout);
    if (showBackground) {
      const bgCard = el('div', { class: 'card' }, [
        el('h3', { text: project.output.layout === 'fit-blur' ? 'Fundo desfocado' : 'Fundo / separação' }),
        el('div', { class: 'grid grid-3' }, [
          field('Cor', el('input', { class: 'input', type: 'color', value: background.color || '#0B0B0F', oninput: (event) => { window.Store.setProject('output.background.color', event.target.value); window.dispatchEvent(new CustomEvent('vcs:project-changed')); } })),
          project.output.layout === 'fit-blur'
            ? field('Desfoque', rangeInput({ value: background.blurRatio ?? 0.02, min: 0.005, max: 0.06, step: 0.001, onInput: (value) => { window.Store.setProject('output.background.blurRatio', value); window.dispatchEvent(new CustomEvent('vcs:project-changed')); } }))
            : field('Gradiente', el('label', { class: 'check' }, [el('input', { type: 'checkbox', checked: background.gradient ? 'checked' : undefined, onchange: (event) => { window.Store.setProject('output.background.gradient', event.target.checked); window.dispatchEvent(new CustomEvent('vcs:project-changed')); } }), el('span', {}, [el('span', { text: 'Usar gradiente' }), el('small', { text: 'Gerado a partir da cor escolhida.' })])]))
        ])
      ]);
      if (project.output.layout === 'fit-blur') {
        bgCard.appendChild(
          field('Escurecer fundo', rangeInput({ value: background.dim ?? 0.35, min: 0, max: 0.9, step: 0.01, onInput: (value) => { window.Store.setProject('output.background.dim', value); window.dispatchEvent(new CustomEvent('vcs:project-changed')); } }), 'Deixa o vídeo central em destaque.')
        );
      }
      container.appendChild(bgCard);
    }

    // -------------------------------------------------------------- split ---
    if (String(project.output.layout).startsWith('split')) {
      const split = project.output.split || {};
      container.appendChild(
        el('div', { class: 'card' }, [
          el('h3', { text: 'Tela dividida' }),
          el('div', { class: 'grid grid-3' }, [
            field('Espaço entre painéis', rangeInput({ value: split.gapRatio ?? 0.012, min: 0, max: 0.08, step: 0.002, onInput: (value) => { window.Store.setProject('output.split.gapRatio', value); window.dispatchEvent(new CustomEvent('vcs:project-changed')); } })),
            field('Linha separadora', rangeInput({ value: split.borderRatio ?? 0, min: 0, max: 0.02, step: 0.001, onInput: (value) => { window.Store.setProject('output.split.borderRatio', value); window.dispatchEvent(new CustomEvent('vcs:project-changed')); } })),
            field('Cor da linha', el('input', { class: 'input', type: 'color', value: split.borderColor || '#FFFFFF', oninput: (event) => { window.Store.setProject('output.split.borderColor', event.target.value); window.dispatchEvent(new CustomEvent('vcs:project-changed')); } }))
          ]),
          field('Áudio', (() => {
            const select = el('select', { class: 'input input-sm' }, [
              el('option', { value: 'primary', text: 'Só do vídeo principal' }),
              el('option', { value: 'secondary', text: 'Só do segundo vídeo' }),
              el('option', { value: 'mix', text: 'Misturar os dois' }),
              el('option', { value: 'none', text: 'Sem áudio' })
            ]);
            select.value = split.audioFrom || 'primary';
            select.addEventListener('change', () => {
              window.Store.setProject('output.split.audioFrom', select.value);
              window.dispatchEvent(new CustomEvent('vcs:project-changed'));
            });
            return select;
          })()),
          el('div', { class: 'row mt-12' }, [
            el('button', { class: 'btn btn-secondary btn-sm', text: 'Adicionar 2º vídeo', onclick: async () => { const result = await window.vcs.dialog.openMedia(); if (result) { window.Store.addExtraSource({ path: result.path, probe: result.probe }); render(container); } } }),
            el('span', { class: 'text-faint', text: (state.extraSources || []).length ? `${state.extraSources.length} vídeo(s) adicional(is) carregado(s)` : 'Sem vídeos adicionais — os painéis vazios repetem o principal.' })
          ])
        ])
      );
    }

    // --------------------------------------------------------------- fps ----
    container.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'Movimento' }),
        el('div', { class: 'grid grid-2' }, [
          field('Quadros por segundo', (() => {
            const select = el('select', { class: 'input input-sm' }, [
              el('option', { value: '24', text: '24 fps (cinema)' }),
              el('option', { value: '25', text: '25 fps (PAL)' }),
              el('option', { value: '30', text: '30 fps (padrão social)' }),
              el('option', { value: '50', text: '50 fps' }),
              el('option', { value: '60', text: '60 fps (gameplay/fluido)' })
            ]);
            select.value = String(project.output.fps || 30);
            select.addEventListener('change', () => {
              window.Store.setProject('output.fps', parseInt(select.value, 10));
              window.dispatchEvent(new CustomEvent('vcs:project-changed'));
            });
            return select;
          })(), `Fonte original: ${state.source?.probe?.fps || '?'} fps`),
          el('div')
        ])
      ])
    );
  }

  /** Miniatura esquemática do layout. */
  function layoutThumb(layoutId) {
    const box = el('div', { class: 'ratio-thumb' });
    const frame = el('i', { style: { width: '30px', height: '42px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '1px', padding: '0' } });
    const pane = (flex) => el('i', { style: { display: 'block', flex: String(flex), background: 'rgba(255,255,255,0.22)', borderRadius: '1px' } });

    if (layoutId === 'fill') {
      frame.style.background = 'linear-gradient(160deg, var(--accent) 0%, var(--accent-2) 100%)';
    } else if (layoutId === 'fit-blur') {
      frame.style.background = 'linear-gradient(160deg, #4a3a6a 0%, #2a2a44 100%)';
      frame.appendChild(el('i', { style: { position: 'absolute', left: '3px', right: '3px', top: '12px', height: '18px', background: 'rgba(255,255,255,0.55)', borderRadius: '2px' } }));
    } else if (layoutId === 'fit-solid') {
      frame.style.background = '#3a3a58';
      frame.appendChild(el('i', { style: { position: 'absolute', left: '4px', right: '4px', top: '8px', bottom: '8px', background: 'rgba(255,255,255,0.55)', borderRadius: '2px' } }));
    } else if (layoutId === 'split-h') {
      frame.style.width = '42px';
      frame.style.height = '30px';
      frame.style.flexDirection = 'row';
      frame.appendChild(pane(1));
      frame.appendChild(pane(1));
    } else if (layoutId === 'split-v') {
      frame.appendChild(pane(1));
      frame.appendChild(pane(1));
    } else if (layoutId === 'split-v-triple') {
      frame.appendChild(pane(1));
      frame.appendChild(pane(1));
      frame.appendChild(pane(1));
    }
    box.appendChild(frame);
    return box;
  }

  /** Seletor visual do ponto de foco. */
  function focusPicker(project) {
    const output = project.output;
    const frameWidth = 190;
    const ratio = (output.width || 1080) / (output.height || 1920);
    const frameHeight = Math.round(frameWidth / ratio);
    const dot = el('i', {
      style: {
        position: 'absolute',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        border: '2px solid #fff',
        background: 'var(--accent)',
        transform: 'translate(-50%, -50%)',
        left: `${(output.focusX ?? 0.5) * 100}%`,
        top: `${(output.focusY ?? 0.45) * 100}%`,
        boxShadow: '0 2px 8px rgba(0,0,0,.6)',
        pointerEvents: 'none'
      }
    });

    const frame = el('div', {
      style: {
        position: 'relative',
        width: `${frameWidth}px`,
        height: `${Math.min(frameHeight, 300)}px`,
        background: 'linear-gradient(135deg, #23233a 0%, #171722 100%)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        cursor: 'crosshair',
        overflow: 'hidden',
        backgroundImage: window.Store.state.source?.thumbnail ? `url("${window.Store.state.source.thumbnail}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }
    }, [dot]);

    frame.addEventListener('click', (event) => {
      const rect = frame.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      window.Store.setProject('output.focusX', Math.round(x * 100) / 100);
      window.Store.setProject('output.focusY', Math.round(y * 100) / 100);
      dot.style.left = `${x * 100}%`;
      dot.style.top = `${y * 100}%`;
      window.dispatchEvent(new CustomEvent('vcs:project-changed'));
    });

    return el('div', { class: 'row' }, [
      frame,
      el('div', { class: 'text-dim', style: { maxWidth: '340px' } }, [
        el('p', { text: 'Clique no quadro para posicionar o foco.', style: { margin: '0 0 6px' } }),
        el('p', { class: 'text-faint', text: `Atual: x=${(output.focusX ?? 0.5).toFixed(2)} y=${(output.focusY ?? 0.45).toFixed(2)}`, style: { margin: 0 } })
      ])
    ]);
  }

  Panels.format = { render };
})();
