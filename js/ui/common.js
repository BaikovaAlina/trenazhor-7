/* Общие элементы интерфейса: модальные окна, имя ученика, памятки, всплывающие сообщения. */
(function () {
  'use strict';
  const T = (globalThis.T = globalThis.T || {});
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const qs = (k) => new URLSearchParams(location.search).get(k);

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  let toastTimer;
  function toast(msg, ms = 3200) {
    let t = $('.toast');
    if (!t) { t = el('<div class="toast" role="status"></div>'); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
  }

  function modal(innerHtml, { onClose } = {}) {
    const m = el(`<div class="modal" role="dialog" aria-modal="true"><div class="card"><button class="close" aria-label="Закрыть">×</button>${innerHtml}</div></div>`);
    const close = () => { m.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    m.addEventListener('click', (e) => { if (e.target === m || e.target.classList.contains('close')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(m);
    return { el: m, close };
  }

  /** окно ввода имени; resolve(имя) или null */
  function askName(required = false) {
    return new Promise((resolve) => {
      const cur = T.stats.getName();
      let done = false;
      const mm = modal(`<h2 style="margin-top:0">👋 Как тебя зовут?</h2>
        <p class="sub">Фамилия, имя и класс — так учитель узнает, чья это работа. Имя запомнится на этом устройстве.</p>
        <form><input type="text" name="n" maxlength="60" placeholder="Например: Иванов Иван, 7Б" value="${esc(cur)}" autocomplete="name" required>
        <div class="row"><button class="btn big green" type="submit">Сохранить ✓</button>${required ? '' : '<button class="btn ghost" type="button" data-cancel>Позже</button>'}</div></form>`,
      { onClose: () => { if (!done) resolve(null); } });
      const f = $('form', mm.el), inp = $('input', mm.el);
      setTimeout(() => inp.focus(), 50);
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = inp.value.trim();
        if (v.length < 2) { inp.focus(); return; }
        T.stats.setName(v);
        done = true;
        mm.close();
        resolve(v);
      });
      const c = $('[data-cancel]', mm.el);
      if (c) c.addEventListener('click', () => mm.close());
    });
  }

  function showTheory(lesson) {
    modal(`<div class="theory"><p class="sub">${esc(lesson.subjectTitle)} · модуль ${lesson.moduleNo} · урок ${lesson.no}</p>
      <h2 style="margin-top:0">📘 ${esc(lesson.title)}</h2>${lesson.theory}
      <p class="sub" style="margin-top:14px">Источник: ${esc(lesson.umk)} · уровень: ${lesson.level === 'adv' ? 'углублённый' : 'базовый'}</p></div>`);
  }

  /** экранная клавиатура для ввода выражений */
  function mathKeyboard(input, onEnter) {
    const keys = ['x', 'y', 'a', 'b', '²', '³', '^', '(', ')', '−', '+', '·', '/', ';', '|'];
    const box = el(`<div class="kbd">${keys.map((k) => `<button type="button" tabindex="-1" data-k="${esc(k)}">${esc(k)}</button>`).join('')}<button type="button" tabindex="-1" data-k="⌫" aria-label="Стереть">⌫</button></div>`);
    box.addEventListener('mousedown', (e) => e.preventDefault()); // не терять фокус
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const k = b.dataset.k;
      const s = input.selectionStart ?? input.value.length, f = input.selectionEnd ?? s;
      if (k === '⌫') {
        const from = s === f ? Math.max(0, s - 1) : s;
        input.value = input.value.slice(0, from) + input.value.slice(f);
        input.setSelectionRange(from, from);
      } else {
        const ins = k === '−' ? '-' : k;
        input.value = input.value.slice(0, s) + ins + input.value.slice(f);
        input.setSelectionRange(s + ins.length, s + ins.length);
      }
      input.focus();
      input.dispatchEvent(new Event('input'));
    });
    return box;
  }

  T.ui = { $, $$, esc, el, qs, toast, modal, askName, showTheory, mathKeyboard };
})();
