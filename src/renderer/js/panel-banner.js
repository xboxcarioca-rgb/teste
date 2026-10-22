/**
 * Passo 5 — Banner: faixa de texto, logo/imagem sobreposta e barra de progresso.
 */
(function () {
  'use strict';

  const { el, $, toast, field, numberInput, rangeInput, modal } = window.U;
  const Panels = (window.Panels = window.Panels || {});

  function render(container) {
    const state = window.Store.state;
    const project = state.project;
    const banner = project.banner;
    container.innerHTML = '';

    container.appendChild(
      el('div', { class: 'panel-head' }, [
        el('h2', { text: 'Banner e marca' }),
        el('p', { text: 'Faixa de título (o "banner"), logo/imagem sobreposta e barra de progresso. Tudo em camadas independentes, posicionadas de forma proporcional ao formato escolhido.' })
      ])
    );

    container.appendChild(textCard(project, container));
    container.appendChild(logoCard(project, container));
    container.appendChild(progressCard(project, container));
    container.appendChild(previewMock(project));
  }

  /** Camada de texto (faixa). */
  function textCard(project, container) {
    const text = project.banner.text;
    const constants = window.Store.state.constants;

    const enabled = el('input', { type: 'checkbox', checked: text.enabled ? 'checked' : undefined });
    enabled.addEventListener('change', () => {
      window.Store.setProject('banner.text.enabled', enabled.checked);
      render(container);
      window.dispatchEvent(new CustomEvent('vcs:project-changed'));
    });

    const bind = (key) => (value) => {
      window.Store.setProject(`banner.text.${key}`, value);
      window.dispatchEvent(new CustomEvent('vcs:project-changed'));
    };

    const positionSelect = el('select', { class: 'input input-sm' }, constants.bannerPositions.map((position) => el('option', { value: position.id, text: position.label })));
    positionSelect.value = text.position || 'top';
    positionSelect.addEventListener('change', () => bind('position')(positionSelect.value));

    const animationSelect = el('select', { class: 'input input-sm' }, [
      el('option', { value: 'none', text: 'Sem animação' }),
      el('option', { value: 'fade', text: 'Aparecer (fade)' }),
      el('option', { value: 'slide', text: 'Deslizar' }),
      el('option', { value: 'expand', text: 'Expandir faixa' })
    ]);
    animationSelect.value = text.animation || 'fade';
    animationSelect.addEventListener('change', () => bind('animation')(animationSelect.value));

    const barModeSelect = el('select', { class: 'input input-sm' }, [
      el('option', { value: 'full', text: 'Faixa de ponta a ponta' }),
      el('option', { value: 'hug', text: 'Caixa ao redor do texto' })
    ]);
    barModeSelect.value = text.barWidthMode || 'full';
    barModeSelect.addEventListener('change', () => bind('barWidthMode')(barModeSelect.value));

    const fontFamilies = window.Store.state.tools?.fonts?.families || [];
    const fontInput = el('input', { class: 'input input-sm', list: 'banner-font-families', value: text.font || 'Montserrat' });
    fontInput.addEventListener('change', () => bind('font')(fontInput.value));

    return el('div', { class: 'card' }, [
      el('datalist', { id: 'banner-font-families' }, fontFamilies.slice(0, 300).map((family) => el('option', { value: family }))),
      el('label', { class: 'check' }, [
        enabled,
        el('span', {}, [el('strong', { text: 'Banner de texto' }), el('small', { text: 'Faixa com o título/chamada do corte.' })])
      ]),
      text.enabled
        ? el('div', {}, [
            field('Texto do banner', (() => {
              const input = el('textarea', { class: 'input', rows: '2', placeholder: 'Ex.: O ERRO QUE QUEBROU MINHA EMPRESA' });
              input.value = text.content || '';
              input.addEventListener('input', window.U.debounce(() => bind('content')(input.value), 260));
              return input;
            })(), 'Quebras de linha são respeitadas. Texto longo é requebrado automaticamente.'),
            el('div', { class: 'grid grid-3 mt-12' }, [
              field('Posição', positionSelect),
              field('Animação', animationSelect),
              field('Formato da faixa', barModeSelect)
            ]),
            el('div', { class: 'grid grid-4 mt-12' }, [
              field('Tamanho', rangeInput({ value: text.sizeRatio ?? 0.05, min: 0.02, max: 0.12, step: 0.002, onInput: bind('sizeRatio') })),
              field('Altura da faixa', rangeInput({ value: text.barHeightRatio ?? 0.085, min: 0.03, max: 0.2, step: 0.005, onInput: bind('barHeightRatio') })),
              field('Ajuste vertical', rangeInput({ value: text.offsetYRatio ?? 0, min: -0.2, max: 0.3, step: 0.005, format: (value) => value.toFixed(3), onInput: bind('offsetYRatio') })),
              field('Duração da animação (s)', numberInput({ value: text.animationDuration ?? 0.4, min: 0, max: 3, step: 0.1, onInput: bind('animationDuration') }))
            ]),
            el('div', { class: 'grid grid-4 mt-12' }, [
              field('Cor do texto', el('input', { class: 'input', type: 'color', value: text.color || '#FFFFFF', oninput: (event) => bind('color')(event.target.value) })),
              field('Fonte', fontInput),
              field('Visível por (s)', numberInput({ value: text.visibleSeconds ?? 0, min: 0, max: 60, step: 0.5, onInput: bind('visibleSeconds') }), '0 = o clipe inteiro.'),
              field('Contorno', rangeInput({ value: text.outlineRatio ?? 0.002, min: 0, max: 0.01, step: 0.0005, onInput: bind('outlineRatio') }))
            ]),
            el('div', { class: 'row row-wrap mt-8' }, [
              toggle('Negrito', text.bold, bind('bold')),
              toggle('Itálico', text.italic, bind('italic')),
              toggle('CAIXA ALTA', text.uppercase, bind('uppercase')),
              toggle('Sombra', text.shadow, bind('shadow')),
              toggle('Fundo colorido', text.background, (value) => { bind('background')(value); render(container); }),
              text.background ? field('Cor do fundo', el('input', { class: 'input', type: 'color', value: text.backgroundColor || '#FF2D55', oninput: (event) => bind('backgroundColor')(event.target.value) })) : null,
              text.background ? field('Opacidade do fundo', rangeInput({ value: text.backgroundOpacity ?? 1, min: 0, max: 1, step: 0.05, onInput: bind('backgroundOpacity') })) : null
            ])
          ])
        : null
    ]);
  }

  /** Camada de logo/imagem. */
  function logoCard(project, container) {
    const logo = project.banner.logo;
    const constants = window.Store.state.constants;
    const bind = (key) => (value) => {
      window.Store.setProject(`banner.logo.${key}`, value);
      window.dispatchEvent(new CustomEvent('vcs:project-changed'));
    };

    const enabled = el('input', { type: 'checkbox', checked: logo.enabled ? 'checked' : undefined });
    enabled.addEventListener('change', () => {
      window.Store.setProject('banner.logo.enabled', enabled.checked);
      render(container);
      window.dispatchEvent(new CustomEvent('vcs:project-changed'));
    });

    const anchorSelect = el('select', { class: 'input input-sm' }, constants.anchors.map((anchor) => el('option', { value: anchor.id, text: anchor.label })));
    anchorSelect.value = logo.anchor || 'top-right';
    anchorSelect.addEventListener('change', () => bind('anchor')(anchorSelect.value));

    const animationSelect = el('select', { class: 'input input-sm' }, [
      el('option', { value: 'none', text: 'Sem animação' }),
      el('option', { value: 'fade', text: 'Aparecer (fade)' }),
      el('option', { value: 'slide', text: 'Deslizar de cima' }),
      el('option', { value: 'bounce', text: 'Quicar suavemente' })
    ]);
    animationSelect.value = logo.animation || 'fade';
    animationSelect.addEventListener('change', () => bind('animation')(animationSelect.value));

    return el('div', { class: 'card' }, [
      el('label', { class: 'check' }, [
        enabled,
        el('span', {}, [el('strong', { text: 'Logo / imagem sobreposta' }), el('small', { text: 'PNG com fundo transparente funciona melhor.' })])
      ]),
      logo.enabled
        ? el('div', {}, [
            el('div', { class: 'row row-wrap' }, [
              el('button', { class: 'btn btn-secondary btn-sm', text: 'Escolher imagem…', onclick: async () => { const file = await window.vcs.dialog.openImage(); if (file) { bind('path')(file); render(container); } } }),
              logo.path ? el('span', { class: 'text-dim mono', text: logo.path.split(/[\\/]/).pop() }) : el('span', { class: 'text-faint', text: 'Nenhuma imagem escolhida.' }),
              logo.path ? el('button', { class: 'btn btn-ghost btn-sm', text: 'Limpar', onclick: () => { bind('path')(''); render(container); } }) : null
            ]),
            logo.path
              ? el('div', { class: 'row mt-12' }, [
                  el('img', { src: window.vcs.mediaUrl(logo.path), alt: 'logo', style: { maxWidth: '150px', maxHeight: '70px', background: 'repeating-conic-gradient(#22222f 0% 25%, #2c2c3d 0% 50%) 50% / 16px 16px', borderRadius: '8px', padding: '6px', border: '1px solid var(--border)' } })
                ])
              : null,
            el('div', { class: 'grid grid-3 mt-12' }, [
              field('Posição', anchorSelect),
              field('Animação', animationSelect),
              field('Tamanho (largura do quadro)', rangeInput({ value: logo.widthRatio ?? 0.18, min: 0.04, max: 0.6, step: 0.01, onInput: bind('widthRatio') }))
            ]),
            el('div', { class: 'grid grid-4 mt-12' }, [
              field('Margem', rangeInput({ value: logo.marginRatio ?? 0.04, min: 0, max: 0.2, step: 0.005, onInput: bind('marginRatio') })),
              field('Opacidade', rangeInput({ value: logo.opacity ?? 1, min: 0.1, max: 1, step: 0.05, onInput: bind('opacity') })),
              field('Visível por (s)', numberInput({ value: logo.visibleSeconds ?? 0, min: 0, max: 60, step: 0.5, onInput: bind('visibleSeconds') })),
              field('Duração da animação (s)', numberInput({ value: logo.animationDuration ?? 0.5, min: 0, max: 3, step: 0.1, onInput: bind('animationDuration') }))
            ])
          ])
        : null
    ]);
  }

  /** Barra de progresso. */
  function progressCard(project, container) {
    const bar = project.banner.progressBar;
    const bind = (key) => (value) => {
      window.Store.setProject(`banner.progressBar.${key}`, value);
      window.dispatchEvent(new CustomEvent('vcs:project-changed'));
    };
    const enabled = el('input', { type: 'checkbox', checked: bar.enabled ? 'checked' : undefined });
    enabled.addEventListener('change', () => {
      window.Store.setProject('banner.progressBar.enabled', enabled.checked);
      render(container);
    });

    return el('div', { class: 'card' }, [
      el('label', { class: 'check' }, [
        enabled,
        el('span', {}, [el('strong', { text: 'Barra de progresso do clipe' }), el('small', { text: 'Aumenta a retenção: o espectador vê quanto falta.' })])
      ]),
      bar.enabled
        ? el('div', { class: 'grid grid-4' }, [
            field('Cor', el('input', { class: 'input', type: 'color', value: bar.color || '#FFFFFF', oninput: (event) => bind('color')(event.target.value) })),
            field('Espessura', rangeInput({ value: bar.heightRatio ?? 0.006, min: 0.002, max: 0.02, step: 0.001, format: (value) => value.toFixed(3), onInput: bind('heightRatio') })),
            field('Opacidade', rangeInput({ value: bar.opacity ?? 0.9, min: 0.1, max: 1, step: 0.05, onInput: bind('opacity') })),
            field('Lado', (() => {
              const select = el('select', { class: 'input input-sm' }, [el('option', { value: 'top', text: 'Topo' }), el('option', { value: 'bottom', text: 'Rodapé' })]);
              select.value = bar.position || 'top';
              select.addEventListener('change', () => bind('position')(select.value));
              return select;
            })())
          ])
        : null
    ]);
  }

  /** Simulação visual (CSS) de como as camadas ficam no quadro. */
  function previewMock(project) {
    const output = project.output;
    const ratio = (output.width || 1080) / (output.height || 1920);
    const width = 210;
    const height = Math.min(360, Math.round(width / ratio));
    const text = project.banner.text;
    const logo = project.banner.logo;
    const bar = project.banner.progressBar;

    const frame = el('div', {
      style: {
        position: 'relative',
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background:
          output.layout === 'fit-blur'
            ? 'linear-gradient(160deg,#3a2f52,#1b1b28)'
            : output.layout === 'fit-solid'
              ? output.background?.color || '#0B0B0F'
              : 'linear-gradient(160deg,#2a2a3e,#15151f)'
      }
    });

    if (output.layout === 'fit-blur' || output.layout === 'fit-solid') {
      const innerHeight = Math.round(height * 0.52);
      frame.appendChild(
        el('div', {
          style: {
            position: 'absolute',
            left: '6%',
            right: '6%',
            top: `${(height - innerHeight) / 2}px`,
            height: `${innerHeight}px`,
            background: 'linear-gradient(160deg,#57577a,#2b2b40)',
            borderRadius: '6px',
            boxShadow: '0 6px 18px rgba(0,0,0,.45)'
          }
        })
      );
    }
    if (String(output.layout).startsWith('split')) {
      const panes = output.layout === 'split-v-triple' ? 3 : 2;
      const isHorizontal = output.layout === 'split-h';
      frame.style.display = 'flex';
      frame.style.flexDirection = isHorizontal ? 'row' : 'column';
      frame.style.gap = `${Math.round(height * (output.split?.gapRatio ?? 0.012))}px`;
      for (let index = 0; index < panes; index += 1) {
        frame.appendChild(el('div', { style: { flex: '1 1 0', background: index % 2 ? '#3b3b58' : '#4a4a6a', minHeight: '0', minWidth: '0' } }));
      }
    }

    if (bar?.enabled) {
      frame.appendChild(
        el('div', {
          style: {
            position: 'absolute',
            left: 0,
            right: '35%',
            [bar.position === 'bottom' ? 'bottom' : 'top']: '0',
            height: `${Math.max(2, Math.round(height * (bar.heightRatio ?? 0.006)))}px`,
            background: bar.color || '#FFFFFF',
            opacity: String(bar.opacity ?? 0.9)
          }
        })
      );
    }

    if (text?.enabled && text.content) {
      const barHeight = Math.round(height * (text.barHeightRatio ?? 0.085));
      const offsets = { top: 0, 'upper-third': 0.16, center: 0.42, 'lower-third': 0.66, bottom: 1 - (text.barHeightRatio ?? 0.085) };
      const wrapper = el('div', {
        style: {
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${Math.round((offsets[text.position] ?? 0) * height + (text.offsetYRatio || 0) * height)}px`,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none'
        }
      });
      const label = el('div', {
        style: {
          background: text.background ? text.backgroundColor : 'transparent',
          opacity: text.background ? String(Math.max(0.15, text.backgroundOpacity ?? 1)) : '1',
          color: text.color,
          width: text.barWidthMode === 'hug' ? 'auto' : '100%',
          textAlign: 'center',
          padding: text.barWidthMode === 'hug' ? '3px 8px' : '0',
          height: text.barWidthMode === 'hug' ? 'auto' : `${barHeight}px`,
          lineHeight: `${barHeight}px`,
          fontSize: `${Math.max(8, Math.round(height * (text.sizeRatio ?? 0.05)))}px`,
          fontWeight: text.bold ? '800' : '500',
          textTransform: text.uppercase ? 'uppercase' : 'none',
          fontStyle: text.italic ? 'italic' : 'normal',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis'
        },
        text: String(text.content)
      });
      wrapper.appendChild(label);
      frame.appendChild(wrapper);
    }

    if (logo?.enabled && logo.path) {
      const anchors = {
        'top-left': { top: '4%', left: '4%' },
        'top-center': { top: '4%', left: '50%', transform: 'translateX(-50%)' },
        'top-right': { top: '4%', right: '4%' },
        'middle-left': { top: '50%', left: '4%', transform: 'translateY(-50%)' },
        center: { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' },
        'middle-right': { top: '50%', right: '4%', transform: 'translateY(-50%)' },
        'bottom-left': { bottom: '4%', left: '4%' },
        'bottom-center': { bottom: '4%', left: '50%', transform: 'translateX(-50%)' },
        'bottom-right': { bottom: '4%', right: '4%' }
      };
      frame.appendChild(
        el('img', {
          src: window.vcs.mediaUrl(logo.path),
          alt: '',
          style: {
            position: 'absolute',
            width: `${Math.round((logo.widthRatio ?? 0.18) * 100)}%`,
            opacity: String(logo.opacity ?? 1),
            ...(anchors[logo.anchor] || anchors['top-right'])
          }
        })
      );
    }

    const subs = project.subtitles;
    if (subs?.enabled && (subs.cues || []).length) {
      const sample = subs.cues[Math.floor(subs.cues.length / 2)] || subs.cues[0];
      const alignTop = String(subs.style.align).startsWith('top');
      const centered = subs.style.align === 'center';
      frame.appendChild(
        el('div', {
          style: {
            position: 'absolute',
            left: '6%',
            right: '6%',
            textAlign: 'center',
            ...(centered ? { top: '50%', transform: 'translateY(-50%)' } : alignTop ? { top: `${Math.round((subs.style.marginRatio ?? 0.1) * 100)}%` } : { bottom: `${Math.round((subs.style.marginRatio ?? 0.16) * 100)}%` }),
            color: subs.style.color,
            fontSize: `${Math.max(8, Math.round(height * (subs.style.sizeRatio ?? 0.062)))}px`,
            fontWeight: subs.style.bold ? '800' : '500',
            textTransform: subs.style.uppercase ? 'uppercase' : 'none',
            textShadow: `0 0 ${Math.round(height * (subs.style.outlineRatio ?? 0.004) * 2)}px ${subs.style.outlineColor}`,
            background: subs.style.box ? subs.style.boxColor : 'transparent',
            padding: subs.style.box ? '2px 6px' : '0',
            borderRadius: '4px',
            lineHeight: 1.15,
            overflow: 'hidden'
          },
          text: String(sample.text || '').slice(0, 46)
        })
      );
    }

    return el('div', { class: 'card' }, [
      el('h3', { text: 'Como vai ficar' }),
      el('p', { class: 'card-sub', text: 'Simulação aproximada das camadas. Para conferir de verdade, gere uma prévia rápida ou renderize.' }),
      el('div', { class: 'row' }, [frame, el('div', { class: 'text-faint', style: { maxWidth: '320px' } }, [el('p', { text: `${output.width}×${output.height} · ${constantsLabel(project.output.formatId)} · ${layoutLabel(project.output.layout)}` })])])
    ]);
  }

  function constantsLabel(id) {
    return window.Store.state.constants?.formats?.find((format) => format.id === id)?.label || id;
  }

  function layoutLabel(id) {
    return window.Store.state.constants?.layouts?.find((layout) => layout.id === id)?.label || id;
  }

  function toggle(label, checked, onChange) {
    return el('label', { class: 'check' }, [
      el('input', { type: 'checkbox', checked: checked ? 'checked' : undefined, onchange: (event) => onChange(event.target.checked) }),
      el('span', { text: label })
    ]);
  }

  Panels.banner = { render };
})();
