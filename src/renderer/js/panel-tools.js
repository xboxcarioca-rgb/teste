/**
 * Painel de Ferramentas e diagnóstico: FFmpeg, yt-dlp, Whisper, fontes, logs.
 */
(function () {
  'use strict';

  const { el, $, toast, status, field, modal, bytes } = window.U;
  const Panels = (window.Panels = window.Panels || {});

  function render(container) {
    const state = window.Store.state;
    const tools = state.tools;
    container.innerHTML = '';

    container.appendChild(
      el('div', { class: 'panel-head' }, [
        el('h2', { text: 'Ferramentas e diagnóstico' }),
        el('p', { text: 'O que o app usa por baixo dos panos, onde cada coisa está instalada e como resolver problemas.' })
      ])
    );

    if (!tools) {
      container.appendChild(el('div', { class: 'card' }, [el('div', { class: 'empty' }, [el('span', { class: 'spinner' }), ' Carregando status das ferramentas…'])]));
      return;
    }

    // ------------------------------------------------------------- ffmpeg ---
    const caps = tools.ffmpeg?.capabilities;
    container.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'FFmpeg (motor de vídeo)' }),
        el('div', { class: 'row row-wrap mb-8' }, [
          tools.ffmpeg?.available ? el('span', { class: 'badge badge-ok', text: `disponível · ${tools.ffmpeg.version || ''}` }) : el('span', { class: 'badge badge-err', text: 'não encontrado' }),
          el('span', { class: 'badge badge-muted', text: `origem: ${tools.ffmpeg?.source || '—'}` }),
          el('span', { class: 'badge badge-muted', text: `${caps?.filterCount || 0} filtros` })
        ]),
        el('div', { class: 'hint mono', text: tools.ffmpeg?.path || '—' }),
        el('div', { class: 'grid grid-4 mt-12' }, [
          capability('drawtext (banner de texto)', caps?.hasDrawtext),
          capability('libass (legendas)', caps?.hasSubtitles),
          capability('loudnorm (volume)', caps?.hasLoudnorm),
          capability('gblur (fundo desfocado)', caps?.hasGblur)
        ]),
        el('div', { class: 'grid grid-4 mt-8' }, [
          capability('H.264', caps?.hasLibx264),
          capability('H.265', caps?.hasLibx265),
          capability('fade (animações)', caps?.hasFade),
          capability('amix (tela dividida)', caps?.hasAmix)
        ]),
        el('div', { class: 'row mt-12 row-wrap' }, [
          el('button', { class: 'btn btn-secondary btn-sm', text: 'Reverificar', onclick: async () => { status('Verificando ferramentas…'); window.Store.set({ tools: await window.vcs.tools.status(true) }); render(container); status('Pronto.'); } }),
          el('button', { class: 'btn btn-ghost btn-sm', text: 'Apontar outro ffmpeg…', onclick: async () => {
            const file = await window.vcs.dialog.chooseDir('Pasta que contém ffmpeg.exe');
            if (!file) return;
            await window.vcs.app.setSettings({ tools: { ffmpegPath: `${file}\\ffmpeg.exe`, ffprobePath: `${file}\\ffprobe.exe` } });
            window.Store.set({ tools: await window.vcs.tools.status(true) });
            render(container);
            toast('Caminho personalizado salvo.', 'ok');
          } })
        ]),
        caps?.hardwareEncoders?.length ? el('div', { class: 'hint', text: `Encoders de GPU: ${caps.hardwareEncoders.join(', ')}` }) : null
      ])
    );

    // ------------------------------------------------------------- yt-dlp ---
    container.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'yt-dlp (download por link)' }),
        el('div', { class: 'row row-wrap mb-8' }, [
          tools.ytDlp?.available ? el('span', { class: 'badge badge-ok', text: 'instalado' }) : el('span', { class: 'badge badge-warn', text: 'não instalado' }),
          el('span', { class: 'flex-1' }),
          el('button', {
            class: 'btn btn-secondary btn-sm',
            text: tools.ytDlp?.available ? 'Reinstalar/atualizar' : 'Instalar agora',
            onclick: (event) => installTool(event.target, 'ytdlp', 'yt-dlp', container)
          })
        ]),
        el('div', { class: 'hint mono', text: tools.ytDlp?.path || tools.ytDlp?.hint || '—' }),
        el('div', { class: 'hint', text: 'Baixado do release oficial do GitHub, com verificação SHA-256. Fica em ' + (tools.paths?.bin || '') })
      ])
    );

    // ------------------------------------------------------------ whisper ---
    const whisper = tools.whisper || {};
    container.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'Whisper (legendas automáticas)' }),
        el('div', { class: 'row row-wrap mb-8' }, [
          whisper.available ? el('span', { class: 'badge badge-ok', text: 'motor instalado' }) : el('span', { class: 'badge badge-warn', text: 'motor não instalado' }),
          whisper.modelPath ? el('span', { class: 'badge badge-ok', text: `modelo: ${whisper.modelPath.split(/[\\/]/).pop()}` }) : el('span', { class: 'badge badge-warn', text: 'nenhum modelo baixado' })
        ]),
        el('div', { class: 'hint mono', text: whisper.path || whisper.hint || '—' }),
        el('div', { class: 'grid grid-3 mt-12' }, (whisper.models || []).map((model) =>
          el('div', { class: 'card', style: { background: 'var(--bg-soft)', padding: '10px' } }, [
            el('div', { class: 'option-title', style: { fontSize: '12px' }, text: model.id }),
            el('div', { class: 'option-desc', text: `~${model.sizeMb} MB` }),
            el('div', { class: 'row mt-8' }, [
              model.installed
                ? el('span', { class: 'badge badge-ok', text: 'baixado' })
                : el('button', { class: 'btn btn-secondary btn-sm', text: 'Baixar', onclick: (event) => installTool(event.target, 'whisper-model', `modelo ${model.id}`, container, { modelId: model.id }) })
            ])
          ])
        )),
        el('div', { class: 'row mt-12' }, [
          el('button', { class: 'btn btn-secondary btn-sm', text: whisper.available ? 'Reinstalar motor' : 'Instalar motor (whisper.cpp)', onclick: (event) => installTool(event.target, 'whisper', 'Whisper', container) }),
          el('span', { class: 'text-faint', text: 'Sem Whisper? Você ainda pode importar um .srt no passo 4.' })
        ])
      ])
    );

    // -------------------------------------------------------------- fontes --
    container.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'Fontes do sistema' }),
        el('div', { class: 'row row-wrap mb-8' }, [
          el('span', { class: 'badge badge-muted', text: `${tools.fonts?.count || 0} arquivos encontrados` }),
          el('button', { class: 'btn btn-ghost btn-sm', text: 'Ver lista', onclick: () => modal({ title: 'Fontes disponíveis', width: 'min(620px,100%)', body: el('pre', { class: 'code', text: (tools.fonts?.families || []).join('\n') || 'nenhuma' }), footer: [el('button', { class: 'btn btn-primary', text: 'Fechar', onclick: () => $('#modal-root').classList.add('is-hidden') })] }) })
        ]),
        el('div', { class: 'hint', text: 'Legendas e banner usam o nome da família (ex.: Montserrat, Impact, Arial Black). Se a fonte não existir, o app usa Segoe UI/Arial e avisa.' })
      ])
    );

    // --------------------------------------------------------- configurações -
    const settings = state.settings || {};
    container.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'Preferências' }),
        el('div', { class: 'grid grid-2' }, [
          field('Pasta de downloads', el('div', { class: 'row' }, [
            el('input', { class: 'input input-sm mono', value: settings.downloadsDir || tools.paths?.downloads || '', readonly: 'readonly' }),
            el('button', { class: 'btn btn-secondary btn-sm', text: 'Trocar…', onclick: async () => { const dir = await window.vcs.dialog.chooseDir('Pasta de downloads'); if (dir) { await window.vcs.app.setSettings({ downloadsDir: dir }); window.Store.set({ settings: await window.vcs.app.getSettings() }); render(container); } } })
          ])),
          field('Pasta de saída dos cortes', el('div', { class: 'row' }, [
            el('input', { class: 'input input-sm mono', value: settings.outputDir || tools.paths?.output || '', readonly: 'readonly' }),
            el('button', { class: 'btn btn-secondary btn-sm', text: 'Trocar…', onclick: async () => { const dir = await window.vcs.dialog.chooseDir('Pasta de saída'); if (dir) { await window.vcs.app.setSettings({ outputDir: dir }); window.Store.set({ settings: await window.vcs.app.getSettings() }); render(container); } } })
          ]))
        ]),
        el('label', { class: 'check mt-8' }, [
          el('input', { type: 'checkbox', checked: settings.tools?.autoDownloadTools !== false ? 'checked' : undefined, onchange: async (event) => { await window.vcs.app.setSettings({ tools: { autoDownloadTools: event.target.checked } }); window.Store.set({ settings: await window.vcs.app.getSettings() }); } }),
          el('span', {}, [el('strong', { text: 'Baixar ferramentas automaticamente quando necessário' }), el('small', { text: 'yt-dlp e Whisper são baixados na primeira vez que você usa o recurso.' })])
        ]),
        el('div', { class: 'row mt-12' }, [
          el('button', { class: 'btn btn-ghost btn-sm', text: 'Ver logs', onclick: () => window.vcs.app.openPath(tools.paths?.logs, 'folder') }),
          el('button', { class: 'btn btn-ghost btn-sm', text: 'Abrir pasta de dados', onclick: () => window.vcs.app.openPath(tools.paths?.bin ? tools.paths.bin.replace(/[\\/]bin$/, '') : '', 'folder') })
        ])
      ])
    );

    // -------------------------------------------------------------- sobre ---
    container.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'Sobre' }),
        el('dl', { class: 'kv' }, [
          kv('Versão', state.appInfo?.version || '—'),
          kv('Electron', state.appInfo?.electron || '—'),
          kv('Node', state.appInfo?.node || '—'),
          kv('Plataforma', `${state.appInfo?.platform || ''} ${state.appInfo?.arch || ''}`),
          kv('Modo', state.appInfo?.isPortable ? 'portable' : 'instalado')
        ])
      ])
    );
  }

  function capability(label, available) {
    return el('div', { class: 'row', style: { gap: '6px' } }, [
      el('span', { class: `badge ${available ? 'badge-ok' : 'badge-warn'}`, text: available ? 'sim' : 'não' }),
      el('span', { class: 'text-dim', text: label, style: { fontSize: '12px' } })
    ]);
  }

  function kv(term, value) {
    return el('div', {}, [el('dt', { text: term }), el('dd', { text: value })]);
  }

  /** Instala uma ferramenta com progresso no botão. */
  async function installTool(button, tool, label, container, extra = {}) {
    const original = button.textContent;
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> Instalando…';
    status(`Instalando ${label}…`, '', 2);
    try {
      const response = await window.vcs.tools.install({ tool, ...extra });
      if (!response.ok) throw new Error(response.error);
      toast(`${label} pronto.`, 'ok');
      window.Store.set({ tools: await window.vcs.tools.status(true) });
      render(container);
    } catch (error) {
      toast(String(error.message || error), 'err', `Falha ao instalar ${label}`);
      button.disabled = false;
      button.textContent = original;
    } finally {
      status('Pronto.', '', null);
    }
  }

  Panels.tools = { render };
})();
