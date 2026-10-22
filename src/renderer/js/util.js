/**
 * Utilitários de DOM e UX do renderer (sem dependências).
 */
(function () {
  'use strict';

  /** Cria um elemento com atributos e filhos. */
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else node.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of [].concat(children)) {
      if (child === null || child === undefined || child === false) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }

  /** Atalho para querySelector. */
  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $$(selector, root = document) {
    return [...root.querySelectorAll(selector)];
  }

  /** Escapa HTML para inserção segura via innerHTML. */
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Formata segundos como M:SS (ou H:MM:SS). */
  function shortTime(seconds) {
    const total = Math.max(0, Number(seconds) || 0);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = Math.floor(total % 60);
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }

  /** Formata segundos como HH:MM:SS.mmm (editável na tabela). */
  function timecode(seconds) {
    const total = Math.max(0, Number(seconds) || 0);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = Math.floor(total % 60);
    const ms = Math.round((total - Math.floor(total)) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  /** Interpreta HH:MM:SS.mmm, MM:SS ou segundos. */
  function parseTime(value) {
    const text = String(value ?? '').trim().replace(',', '.');
    if (!text) return 0;
    if (!text.includes(':')) return Math.max(0, parseFloat(text) || 0);
    const parts = text.split(':').map((part) => parseFloat(part) || 0);
    while (parts.length < 3) parts.unshift(0);
    const [h, m, s] = parts.slice(-3);
    return Math.max(0, h * 3600 + m * 60 + s);
  }

  /** Formata bytes. */
  function bytes(size) {
    const value = Number(size) || 0;
    if (value < 1024) return `${value} B`;
    const units = ['KB', 'MB', 'GB'];
    let scaled = value / 1024;
    let index = 0;
    while (scaled >= 1024 && index < units.length - 1) {
      scaled /= 1024;
      index += 1;
    }
    return `${scaled.toFixed(scaled >= 100 ? 0 : 1)} ${units[index]}`;
  }

  /** Debounce simples. */
  function debounce(fn, wait = 220) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /** Toast no canto inferior direito. */
  function toast(message, kind = 'info', title = null, timeout = 4200) {
    const root = document.getElementById('toasts');
    if (!root) return;
    const node = el('div', { class: `toast ${kind}` }, [
      title ? el('strong', { text: title }) : null,
      el('small', { text: message })
    ]);
    root.appendChild(node);
    setTimeout(() => {
      node.style.opacity = '0';
      node.style.transform = 'translateX(18px)';
      node.style.transition = 'opacity .18s, transform .18s';
      setTimeout(() => node.remove(), 200);
    }, timeout);
  }

  /** Atualiza a barra de status. */
  function status(text, meta = '', percent = null) {
    const textNode = document.getElementById('status-text');
    const metaNode = document.getElementById('status-meta');
    const wrap = document.getElementById('status-progress-wrap');
    const bar = document.getElementById('status-progress-bar');
    if (textNode && text !== undefined) textNode.textContent = text;
    if (metaNode) metaNode.textContent = meta;
    if (wrap && bar) {
      if (percent === null || percent === undefined) wrap.classList.add('is-hidden');
      else {
        wrap.classList.remove('is-hidden');
        bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
      }
    }
  }

  /**
   * Modal genérico.
   * @param {{title:string,body:HTMLElement|HTMLElement[]|string,footer?:HTMLElement[],width?:string,onClose?:Function}} options
   */
  function modal(options) {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    const close = () => {
      root.classList.add('is-hidden');
      root.innerHTML = '';
      if (options.onClose) options.onClose();
    };

    const body = typeof options.body === 'string' ? el('div', { html: options.body }) : options.body;
    const box = el('div', { class: 'modal', style: options.width ? { width: options.width } : {} }, [
      el('div', { class: 'modal-head' }, [
        el('h3', { text: options.title || '' }),
        el('button', { class: 'close-x', text: '×', onclick: close, title: 'Fechar' })
      ]),
      el('div', { class: 'modal-body' }, [body]),
      options.footer ? el('div', { class: 'modal-foot' }, options.footer) : null
    ]);

    root.appendChild(box);
    root.classList.remove('is-hidden');
    root.onclick = (event) => {
      if (event.target === root) close();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        close();
        window.removeEventListener('keydown', onKey);
      }
    };
    window.addEventListener('keydown', onKey);
    return { close, box };
  }

  /** Pede confirmação ao usuário. */
  function confirmDialog(title, message) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
        instance.close();
      };
      const instance = modal({
        title,
        body: el('p', { text: message, style: { margin: '0', lineHeight: '1.6' } }),
        footer: [
          el('button', { class: 'btn btn-ghost', text: 'Cancelar', onclick: () => finish(false) }),
          el('button', { class: 'btn btn-primary', text: 'Confirmar', onclick: () => finish(true) })
        ],
        onClose: () => finish(false)
      });
    });
  }

  /** Pede um texto ao usuário. */
  function promptDialog(title, label, initialValue = '') {
    return new Promise((resolve) => {
      let settled = false;
      const input = el('input', { class: 'input', value: initialValue });
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
        instance.close();
      };
      const instance = modal({
        title,
        width: 'min(460px, 100%)',
        body: el('div', { class: 'field' }, [el('label', { text: label }), input]),
        footer: [
          el('button', { class: 'btn btn-ghost', text: 'Cancelar', onclick: () => finish(null) }),
          el('button', { class: 'btn btn-primary', text: 'OK', onclick: () => finish(input.value.trim() || null) })
        ],
        onClose: () => finish(null)
      });
      setTimeout(() => input.focus(), 40);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') finish(input.value.trim() || null);
      });
    });
  }

  /** Agrupa controles num campo rotulado. */
  function field(label, control, hint = null) {
    return el('div', { class: 'field' }, [
      label ? el('label', { text: label }) : null,
      control,
      hint ? el('div', { class: 'field-hint', text: hint }) : null
    ]);
  }

  /** Cria um input numérico com sufixo. */
  function numberInput({ value, min, max, step = 1, onInput, suffix = '', disabled = false }) {
    const input = el('input', {
      class: 'input',
      type: 'number',
      value: value ?? '',
      min: min ?? undefined,
      max: max ?? undefined,
      step,
      disabled: disabled || undefined
    });
    input.addEventListener('input', () => {
      const parsed = parseFloat(input.value);
      if (onInput) onInput(Number.isFinite(parsed) ? parsed : null, input);
    });
    return suffix ? el('div', { class: 'row' }, [input, el('span', { class: 'text-faint', text: suffix })]) : input;
  }

  /** Cria um range com leitura do valor. */
  function rangeInput({ value, min, max, step = 0.01, onInput, format = (v) => v.toFixed(2) }) {
    const label = el('span', { class: 'text-dim mono', text: format(Number(value)), style: { minWidth: '52px', textAlign: 'right', fontSize: '11.5px' } });
    const input = el('input', { type: 'range', min, max, step, value });
    input.addEventListener('input', () => {
      const parsed = parseFloat(input.value);
      label.textContent = format(parsed);
      if (onInput) onInput(parsed);
    });
    return el('div', { class: 'row' }, [input, label]);
  }

  /** Seleção em grade de "cards". */
  function optionCard({ title, description, meta = [], selected = false, onClick, thumb = null }) {
    return el(
      'button',
      { class: `option${selected ? ' is-selected' : ''}`, type: 'button', onclick: onClick },
      [
        thumb,
        el('div', { class: 'option-title', text: title }),
        description ? el('div', { class: 'option-desc', text: description }) : null,
        meta.length ? el('div', { class: 'option-meta' }, meta.map((item) => el('span', { class: 'chip', text: item }))) : null
      ]
    );
  }

  /** Miniatura de proporção (desenha um retângulo na proporção certa). */
  function ratioThumb(width, height, boxHeight = 44) {
    const ratio = width / height;
    const w = ratio >= 1 ? boxHeight * ratio : boxHeight;
    const h = ratio >= 1 ? boxHeight : boxHeight / ratio;
    return el('div', { class: 'ratio-thumb' }, [el('i', { style: { width: `${Math.min(w, 120)}px`, height: `${Math.min(h, boxHeight)}px` } })]);
  }

  /** Cor por pontuação (verde/amarelo/vermelho). */
  function scoreColor(score) {
    if (score >= 78) return '#2fd07a';
    if (score >= 60) return '#a3e635';
    if (score >= 42) return '#ffb020';
    return '#ff8a5c';
  }

  /**
   * Re-quebra as legendas para caber no limite de caracteres por linha,
   * dividindo as longas em duas e distribuindo o tempo proporcionalmente.
   * Espelha o comportamento de `reflowCues` do motor (lado principal).
   */
  function reflow(cues, maxCharsPerLine = 22, maxLines = 2) {
    const limit = Math.max(6, Math.round(maxCharsPerLine));
    const output = [];

    for (const cue of cues || []) {
      const words = String(cue.text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
      const lines = [];
      let current = '';
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length <= limit) current = candidate;
        else {
          if (current) lines.push(current);
          if (word.length > limit) {
            for (let i = 0; i < word.length; i += limit) lines.push(word.slice(i, i + limit));
            current = '';
          } else current = word;
        }
      }
      if (current) lines.push(current);

      if (lines.length <= maxLines) {
        output.push({ ...cue, text: lines.join('\n') });
        continue;
      }
      const chunks = [];
      for (let i = 0; i < lines.length; i += maxLines) chunks.push(lines.slice(i, i + maxLines));
      const totalChars = chunks.reduce((sum, chunk) => sum + chunk.join(' ').length, 0) || 1;
      const duration = Math.max(0.2, cue.end - cue.start);
      let cursor = cue.start;
      chunks.forEach((chunk, index) => {
        const share = (chunk.join(' ').length / totalChars) * duration;
        const start = Math.round(cursor * 1000) / 1000;
        const end = index === chunks.length - 1 ? cue.end : Math.round((cursor + share) * 1000) / 1000;
        output.push({ ...cue, start, end, text: chunk.join('\n') });
        cursor += share;
      });
    }

    return output.map((cue, index) => ({ ...cue, index: index + 1 }));
  }

  window.U = {
    el,
    $,
    $$,
    esc,
    shortTime,
    timecode,
    parseTime,
    bytes,
    debounce,
    reflow,
    toast,
    status,
    modal,
    confirmDialog,
    promptDialog,
    field,
    numberInput,
    rangeInput,
    optionCard,
    ratioThumb,
    scoreColor
  };
})();
