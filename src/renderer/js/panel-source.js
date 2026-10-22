/**
 * Passo 1 — Fonte do vídeo: link (download) ou arquivo local.
 */
(function () {
  'use strict';

  const { el, $, toast, status, bytes, shortTime, field, optionCard } = window.U;
  const Panels = (window.Panels = window.Panels || {});

  /** Renderiza o painel dentro do container. */
  function render(container) {
    const state = window.Store.state;
    container.innerHTML = '';

    container.appendChild(
      el('div', { class: 'panel-head' }, [
        el('h2', { text: 'Fonte do vídeo' }),
        el('p', { text: 'Cole um link (YouTube, TikTok, Instagram, X, Vimeo e mais de mil sites) para baixar, ou escolha um arquivo que já está no seu computador.' })
      ])
    );

    // ------------------------------------------------------------- por link --
    const urlInput = el('input', { class: 'input', type: 'url', placeholder: 'https://www.youtube.com/watch?v=…', value: state.urlInfo?.webpageUrl || '' });
    const btnInfo = el('button', { class: 'btn btn-secondary', text: 'Analisar link' });
    const btnDownload = el('button', { class: 'btn btn-primary', text: 'Baixar vídeo' });
    const infoBox = el('div', { class: 'mt-12' });

    urlInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') btnDownload.click();
    });

    btnInfo.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      if (!url) return toast('Cole um link primeiro.', 'warn');
      btnInfo.disabled = true;
      btnInfo.innerHTML = '<span class="spinner"></span> Lendo…';
      status('Lendo informações do link…');
      try {
        const info = await window.vcs.url.info(url);
        window.Store.set({ urlInfo: info });
        toast(`${info.title} — ${shortTime(info.duration)}`, 'ok', 'Link lido');
        renderInfo(infoBox, info);
      } catch (error) {
        toast(String(error.message || error), 'err', 'Falha ao ler o link');
      } finally {
        btnInfo.disabled = false;
        btnInfo.textContent = 'Analisar link';
        status('Pronto.');
      }
    });

    btnDownload.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      if (!url) return toast('Cole um link primeiro.', 'warn');
      const maxHeight = parseInt($('#dl-quality')?.value || '0', 10);
      btnDownload.disabled = true;
      btnDownload.innerHTML = '<span class="spinner"></span> Baixando…';
      window.Store.setBusy('download', true);
      status('Baixando vídeo…', '', 2);
      try {
        const response = await window.vcs.url.download({
          url,
          options: {
            maxHeight,
            subtitles: Boolean($('#dl-subs')?.checked),
            downloadAudioOnly: Boolean($('#dl-audio')?.checked)
          }
        });
        if (!response.ok) throw new Error(response.error);
        window.Store.setBusy('download', false);
        const probe = response.result.probe;
        await loadSource(response.result.filePath, probe, url);
        toast('Vídeo baixado e carregado.', 'ok');
      } catch (error) {
        toast(String(error.message || error), 'err', 'Download falhou');
      } finally {
        btnDownload.disabled = false;
        btnDownload.textContent = 'Baixar vídeo';
        window.Store.setBusy('download', false);
        status('Pronto.', '', null);
      }
    });

    container.appendChild(
      el('div', { class: 'card' }, [
        el('h3', { text: 'Baixar de um link' }),
        el('div', { class: 'row' }, [urlInput, btnInfo, btnDownload]),
        el('div', { class: 'row row-wrap mt-12' }, [
          el('div', { class: 'field', style: { marginBottom: '0', minWidth: '190px' } }, [
            el('label', { text: 'Qualidade máxima' }),
            el('select', { class: 'input input-sm', id: 'dl-quality' }, [
              el('option', { value: '0', text: 'Melhor disponível' }),
              el('option', { value: '2160', text: '4K (2160p)' }),
              el('option', { value: '1080', text: 'Full HD (1080p)', selected: 'selected' }),
              el('option', { value: '720', text: 'HD (720p)' }),
              el('option', { value: '480', text: 'SD (480p)' })
            ])
          ]),
          el('label', { class: 'check' }, [
            el('input', { type: 'checkbox', id: 'dl-subs' }),
            el('span', {}, [el('span', { text: 'Baixar legendas da plataforma' }), el('small', { text: 'Se existirem, já vêm como .srt pronto para queimar.' })])
          ]),
          el('label', { class: 'check' }, [
            el('input', { type: 'checkbox', id: 'dl-audio' }),
            el('span', {}, [el('span', { text: 'Somente áudio (MP3)' }), el('small', { text: 'Para transcrever podcasts longos mais rápido.' })])
          ])
        ]),
        infoBox,
        el('div', { class: 'hint' }, [
          'O yt-dlp oficial é baixado automaticamente na primeira vez (verificado por SHA-256). ',
          'Alguns sites exigem login: nesse caso, baixe o vídeo no navegador e use a opção abaixo.'
        ])
      ])
    );

    // ---------------------------------------------------------- arquivo local -
    const drop = el('div', { class: 'source-drop mt-16' }, [
      el('h3', { text: 'Ou use um arquivo do seu computador' }),
      el('p', { text: 'Arraste o vídeo aqui, ou clique para procurar.' }),
      el('div', { class: 'row', style: { justifyContent: 'center' } }, [
        el('button', { class: 'btn btn-secondary', text: 'Escolher vídeo', onclick: () => pickFile() }),
        el('button', { class: 'btn btn-ghost', text: 'Adicionar 2º vídeo (tela dividida)', onclick: () => pickFile(true) })
      ])
    ]);

    ['dragenter', 'dragover'].forEach((eventName) =>
      drop.addEventListener(eventName, (event) => {
        event.preventDefault();
        drop.classList.add('is-over');
      })
    );
    ['dragleave', 'drop'].forEach((eventName) =>
      drop.addEventListener(eventName, (event) => {
        event.preventDefault();
        drop.classList.remove('is-over');
        if (eventName !== 'drop') return;
        const file = event.dataTransfer?.files?.[0];
        if (file?.path) handleDropped(file.path);
      })
    );
    container.appendChild(drop);

    // ------------------------------------------------------- fonte carregada --
    if (state.source) container.appendChild(sourceCard(state.source));

    async function pickFile(extra = false) {
      try {
        const result = await window.vcs.dialog.openMedia();
        if (!result) return;
        if (extra) {
          window.Store.addExtraSource({ path: result.path, probe: result.probe, title: result.path.split(/[\\/]/).pop() });
          toast('Segundo vídeo adicionado.', 'ok');
        } else {
          await loadSource(result.path, result.probe);
        }
      } catch (error) {
        toast(String(error.message || error), 'err', 'Não foi possível abrir o arquivo');
      }
    }

    async function handleDropped(filePath) {
      try {
        const probe = await window.vcs.media.probe(filePath);
        await loadSource(filePath, probe);
      } catch (error) {
        toast(String(error.message || error), 'err', 'Arquivo inválido');
      }
    }
  }

  /** Carrega um arquivo como fonte primária. */
  async function loadSource(filePath, probe, url = null) {
    if (!probe) probe = await window.vcs.media.probe(filePath);
    const title = url && window.Store.state.urlInfo?.title ? window.Store.state.urlInfo.title : filePath.split(/[\\/]/).pop();
    let thumbnail = null;
    try {
      thumbnail = await window.vcs.media.thumbnail({ filePath, time: Math.min(2, probe.duration / 3), width: 480 });
    } catch {
      thumbnail = null;
    }
    window.Store.setSource({ path: filePath, probe, title, thumbnail: thumbnail?.url || null, url });
    if (window.Store.state.project) window.Store.state.project.name = title.replace(/\.[^.]+$/, '').slice(0, 60) || 'Novo projeto';
    window.dispatchEvent(new CustomEvent('vcs:source-changed'));
    render($('#panel-source'));
  }

  /** Mostra as informações do link lido. */
  function renderInfo(box, info) {
    box.innerHTML = '';
    box.appendChild(
      el('div', { class: 'callout callout-info' }, [
        el('strong', { text: info.title }),
        el('div', { class: 'text-dim', style: { marginTop: '4px' } }, [
          el('span', { text: `${info.uploader ? `${info.uploader} · ` : ''}${shortTime(info.duration)} · ${info.height || '?'}p` }),
          info.isLive ? el('span', { class: 'badge badge-warn', text: 'ao vivo', style: { marginLeft: '8px' } }) : null
        ])
      ])
    );
  }

  /** Card com a mídia carregada. */
  function sourceCard(source) {
    const probe = source.probe || {};
    const card = el('div', { class: 'card mt-16' }, [
      el('h3', { text: 'Vídeo carregado' }),
      el('div', { class: 'media-card' }, [
        el('div', { class: 'media-thumb', style: source.thumbnail ? { backgroundImage: `url("${source.thumbnail}")` } : {} }),
        el('div', { class: 'media-info' }, [
          el('div', { class: 'media-title', text: source.title || source.path }),
          el('dl', { class: 'kv' }, [
            kv('Duração', shortTime(probe.duration || 0)),
            kv('Resolução', probe.width && probe.height ? `${probe.width}×${probe.height}` : '—'),
            kv('FPS', probe.fps ? String(probe.fps) : '—'),
            kv('Vídeo', probe.videoCodec || '—'),
            kv('Áudio', probe.hasAudio ? probe.audioCodec || 'sim' : 'sem áudio'),
            kv('Tamanho', bytes(probe.sizeBytes || 0))
          ]),
          el('div', { class: 'row mt-12 row-wrap' }, [
            el('button', { class: 'btn btn-secondary btn-sm', text: 'Ver metadados originais', onclick: () => showMetadata(source.path) }),
            el('button', { class: 'btn btn-ghost btn-sm', text: 'Abrir pasta', onclick: () => window.vcs.app.openPath(source.path, 'folder') }),
            el('button', { class: 'btn btn-ghost btn-sm', text: 'Ir para cortes →', onclick: () => window.dispatchEvent(new CustomEvent('vcs:goto', { detail: 'cuts' })) })
          ]),
          el('div', { class: 'hint', text: source.path })
        ])
      ])
    ]);

    const extras = window.Store.state.extraSources || [];
    if (extras.length) {
      card.appendChild(el('h3', { class: 'mt-16', text: 'Vídeos adicionais (tela dividida)' }));
      extras.forEach((extra, index) => {
        card.appendChild(
          el('div', { class: 'row row-between', style: { padding: '7px 0', borderTop: '1px solid var(--border-soft)' } }, [
            el('span', { class: 'text-dim', text: `${index + 2}. ${extra.path.split(/[\\/]/).pop()} — ${shortTime(extra.probe?.duration || 0)}` }),
            el('button', { class: 'btn btn-ghost btn-sm', text: 'Remover', onclick: () => { window.Store.removeExtraSource(index); render($('#panel-source')); } })
          ])
        );
      });
    }
    return card;
  }

  function kv(term, value) {
    return el('div', {}, [el('dt', { text: term }), el('dd', { text: value })]);
  }

  /** Modal com os metadados do arquivo (antes e depois do corte). */
  async function showMetadata(filePath) {
    try {
      const report = await window.vcs.metadata.inspect(filePath);
      const rows = [];
      for (const [key, value] of Object.entries(report.formatTags || {})) rows.push({ scope: 'arquivo', key, value });
      for (const stream of report.streamTags || []) {
        for (const [key, value] of Object.entries(stream.tags || {})) rows.push({ scope: `stream ${stream.index} (${stream.codecType})`, key, value });
      }

      window.U.modal({
        title: 'Metadados do arquivo',
        width: 'min(680px, 100%)',
        body: el('div', {}, [
          el('div', { class: `callout ${report.clean ? 'callout-ok' : 'callout-warn'}`, text: report.description }),
          rows.length
            ? el('div', { class: 'table-wrap mt-12' }, [
                el('table', {}, [
                  el('thead', {}, [el('tr', {}, [el('th', { text: 'Origem' }), el('th', { text: 'Campo' }), el('th', { text: 'Valor' })])]),
                  el('tbody', {}, rows.map((row) => el('tr', {}, [el('td', { text: row.scope }), el('td', { class: 'mono', text: row.key }), el('td', { class: 'mono', text: String(row.value).slice(0, 90) })])))
                ])
              ])
            : el('p', { class: 'text-dim mt-12', text: 'Nenhuma tag encontrada.' }),
          el('div', { class: 'hint mt-12', text: 'No corte final, a remoção de metadados apaga tudo isso (tags, encoder, datas, GPS e capítulos).' })
        ]),
        footer: [el('button', { class: 'btn btn-primary', text: 'Fechar', onclick: () => $('#modal-root').classList.add('is-hidden') })]
      });
    } catch (error) {
      toast(String(error.message || error), 'err', 'Falha ao ler metadados');
    }
  }

  Panels.source = { render, loadSource, showMetadata };
})();
