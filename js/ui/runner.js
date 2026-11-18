/* Интерактивный тренажёр: отрисовка заданий, проверка, прогресс, итоги, отправка учителю. */
(function () {
  'use strict';
  const T = (globalThis.T = globalThis.T || {});
  const { $, $$, esc, el, toast } = T.ui;
  const cfg = () => globalThis.APP_CONFIG || {};
  const PRAISE = ['Верно! 👍', 'Отлично! ✨', 'Правильно! ✅', 'Молодец! 🎉', 'Так держать! 💪', 'Точно! 🎯'];
  const FMT = {
    num: 'Число: 12; −3,5; 7/2',
    expr: 'Степень: x^2 или x². Знак умножения можно не писать: 3ab',
    coord: 'Пара чисел: (2; −3)',
    list: 'Числа через точку с запятой: 2; −5',
    text: 'Ответ словами',
  };

  /**
   * @param {object} o {root, tasks, mode:'cw'|'hw'|'tr', meta:{subject, lessonTitle, lessonNo, level, lessonId},
   *                    variant, attempt, persistKey, onNew}
   */
  function createRunner(o) {
    const { root, tasks, mode } = o;
    const isCW = mode === 'cw';
    const saved = o.persistKey ? T.stats.ls.get(o.persistKey, null) : null;
    const st = saved || { answers: {}, start: Date.now(), sent: false, recorded: false };
    const save = () => o.persistKey && T.stats.ls.set(o.persistKey, st);
    save();

    const maxTries = (t) => {
      if (isCW) return Infinity;
      if (['choice', 'multi', 'order'].includes(t.type)) return 1;
      return cfg().HOMEWORK_ATTEMPTS || 2;
    };
    const A = (i) => (st.answers[i] = st.answers[i] || { tries: 0, ok: false, final: false, given: '' });

    /* ---------- разметка ---------- */
    root.innerHTML = '';
    const progress = el(`<div class="progress"><div class="bar"><i class="g"></i><i class="r"></i></div>
      <div class="counters"><span>Выполнено: <b data-c="done">0</b> из ${tasks.length}</span><span class="ok">✓ <span data-c="ok">0</span></span><span class="bad">✗ <span data-c="bad">0</span></span><span>⏱ <span data-c="time">0:00</span></span></div></div>`);
    root.appendChild(progress);
    const list = el('<div class="tasks"></div>');
    root.appendChild(list);
    tasks.forEach((t, i) => list.appendChild(renderTask(t, i)));
    root._tasks = tasks; // для автотестов в браузере
    const result = el('<div class="card result"></div>');
    root.appendChild(result);

    /* ---------- задание ---------- */
    function renderTask(t, i) {
      const card = el(`<div class="card task" id="task-${i + 1}" data-i="${i}">
        ${mode === 'tr' ? `<div class="from">${esc(t.lessonTitle)}</div>` : ''}
        <div class="q"><span class="tn">№${i + 1}.</span> ${t.q}</div>
        <div class="answer"></div><div class="feedback" aria-live="polite"></div><div class="task-tools"></div></div>`);
      const box = $('.answer', card);
      const a = A(i);

      if (t.type === 'choice' || t.type === 'multi') {
        const multi = t.type === 'multi';
        const opts = el('<div class="opts"></div>');
        t.opts.forEach((txt, k) => {
          const b = el(`<button type="button" class="opt" data-k="${k}">${multi ? '<span class="box">✓</span>' : ''}<span>${txt}</span></button>`);
          b.addEventListener('click', () => {
            if (A(i).final) return;
            if (multi) b.classList.toggle('sel');
            else submit(i, k);
          });
          opts.appendChild(b);
        });
        box.appendChild(opts);
        if (multi) {
          box.appendChild(el('<div class="fmt-hint">Можно выбрать несколько вариантов</div>'));
          const go = el('<button type="button" class="btn">Проверить</button>');
          go.addEventListener('click', () => submit(i, $$('.opt.sel', box).map((x) => +x.dataset.k)));
          box.appendChild(go);
        }
      } else if (t.type === 'order') {
        const seq = el('<div class="order-seq"></div>'), pool = el('<div class="order-pool"></div>');
        const steps = t.shuffled || t.steps;
        const renum = () => $$('.step', seq).forEach((s, k) => ($('b', s).textContent = k + 1 + '.'));
        steps.forEach((s) => {
          const b = el(`<button type="button" class="step"><b></b>${esc(s)}</button>`);
          b.dataset.s = s;
          b.addEventListener('click', () => {
            if (A(i).final) return;
            (b.parentNode === pool ? seq : pool).appendChild(b);
            if (b.parentNode === pool) $('b', b).textContent = '';
            renum();
          });
          pool.appendChild(b);
        });
        box.append(el('<div class="fmt-hint">Нажимайте на шаги в правильном порядке. Нажмите на шаг ещё раз, чтобы вернуть его.</div>'), seq, pool);
        const go = el('<button type="button" class="btn">Проверить</button>');
        go.addEventListener('click', () => submit(i, $$('.step', seq).map((x) => x.dataset.s)));
        box.appendChild(go);
      } else {
        const inp = el(`<input type="text" inputmode="${t.type === 'num' ? 'decimal' : 'text'}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Ответ" aria-label="Ответ к заданию ${i + 1}">`);
        const go = el('<button type="button" class="btn">Проверить</button>');
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(i, inp.value); } });
        go.addEventListener('click', () => submit(i, inp.value));
        box.append(inp, go, el(`<div class="fmt-hint">${FMT[t.type] || ''}</div>`));
        if (t.type === 'expr' || t.type === 'list' || t.type === 'coord') box.appendChild(T.ui.mathKeyboard(inp));
        if (a.given) inp.value = a.given;
      }

      const tools = $('.task-tools', card);
      if (isCW && t.hint) {
        const h = el('<button type="button" class="linkbtn">💡 Подсказка</button>');
        h.addEventListener('click', () => setFb(card, 'info', '💡 ' + esc(t.hint)));
        tools.appendChild(h);
      }
      if (a.final || a.tries) setTimeout(() => paint(i), 0);
      return card;
    }

    function setFb(card, cls, html) {
      const f = $('.feedback', card);
      f.className = 'feedback ' + cls;
      f.innerHTML = html;
    }

    function givenText(t, v) {
      if (t.type === 'choice') return t.opts[v] || '';
      if (t.type === 'multi') return v.map((k) => t.opts[k]).join('; ') || '(ничего не выбрано)';
      if (t.type === 'order') return v.map((s) => t.steps.indexOf(s) + 1).join('-');
      return String(v);
    }

    function submit(i, value) {
      const t = tasks[i], a = A(i);
      if (a.final) return;
      const card = $(`#task-${i + 1}`, root);
      if (t.type === 'multi' && !value.length) return setFb(card, 'info', 'Выберите хотя бы один вариант');
      if (t.type === 'order' && value.length !== t.steps.length) return setFb(card, 'info', 'Расставьте все шаги');
      if (typeof value === 'string' && !value.trim()) return setFb(card, 'info', 'Сначала впишите ответ');
      const res = T.checker.check(t, value);
      if (!res.ok && res.msg) return setFb(card, 'info', '⚠️ ' + esc(res.msg)); // формат — попытка не тратится
      a.tries++;
      a.given = typeof value === 'string' ? value : '';
      a.givenText = givenText(t, value);
      a.raw = value;
      if (res.ok) { a.ok = true; a.final = true; a.secondTry = a.tries > 1; }
      else if (a.tries >= maxTries(t)) a.final = true;
      save();
      paint(i, true);
      update();
    }

    function paint(i, fresh) {
      const t = tasks[i], a = A(i), card = $(`#task-${i + 1}`, root);
      if (!card) return;
      card.classList.toggle('correct', a.ok);
      card.classList.toggle('wrong', !a.ok && a.tries > 0);
      const rightHtml = `<span class="right-answer">Правильный ответ: <b>${esc(T.checker.answerText(t))}</b></span>`;
      if (a.ok) setFb(card, 'ok', '✅ ' + (fresh ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : 'Верно') + (a.secondTry && !isCW ? ' (со 2-й попытки)' : ''));
      else if (a.final) setFb(card, 'bad', a.revealed ? '👀 Ответ показан (задание не засчитано)' + rightHtml : `❌ Неверно${a.givenText ? ': «' + esc(a.givenText) + '»' : ''}` + rightHtml);
      else if (a.tries) {
        const left = maxTries(t) - a.tries;
        setFb(card, 'bad', '❌ Неверно. ' + (isCW ? 'Попробуй ещё раз!' : `Осталось попыток: ${left}`) + (t.hint && !isCW ? ' 💡 ' + esc(t.hint) : ''));
        if (isCW && !$('.reveal', card)) {
          const r = el('<button type="button" class="linkbtn reveal">👀 Показать ответ</button>');
          r.addEventListener('click', () => { a.final = true; a.revealed = true; save(); paint(i); update(); });
          $('.task-tools', card).appendChild(r);
        }
      }
      if (a.final) {
        $$('input,button.btn,.opt,.step', card).forEach((x) => (x.disabled = true));
        $$('.kbd', card).forEach((x) => x.remove());
        $$('.reveal', card).forEach((x) => x.remove());
        if (t.type === 'choice' || t.type === 'multi') {
          const chosen = t.type === 'choice' ? [a.raw] : a.raw || [];
          const right = t.type === 'choice' ? [t.a] : t.a;
          $$('.opt', card).forEach((b) => {
            const k = +b.dataset.k;
            if (chosen.includes(k)) b.classList.add('sel');
            if (right.includes(k)) b.classList.add('right');
            else if (chosen.includes(k)) b.classList.add('miss');
          });
        }
        if (t.type === 'order' && Array.isArray(a.raw)) {
          const seq = $('.order-seq', card), pool = $('.order-pool', card);
          if (seq && !seq.children.length) a.raw.forEach((s, k) => { const b = $$('.step', pool).find((x) => x.dataset.s === s); if (b) { $('b', b).textContent = k + 1 + '.'; seq.appendChild(b); } });
        }
      }
    }

    /* ---------- прогресс и итоги ---------- */
    const counts = () => {
      let ok = 0, bad = 0, done = 0, second = 0;
      tasks.forEach((_, i) => { const a = A(i); if (a.final) done++; if (a.ok) ok++; if (a.final && !a.ok) bad++; if (a.ok && a.secondTry) second++; });
      return { ok, bad, done, second, total: tasks.length };
    };
    const elapsed = () => Math.round(((st.finishedAt || Date.now()) - st.start) / 1000);
    const fmtT = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

    function buildResult() {
      const c = counts();
      const percent = Math.round((c.ok / c.total) * 100);
      const g = T.stats.grade(percent);
      const errors = [];
      tasks.forEach((t, i) => {
        const a = A(i);
        if (!a.ok) errors.push({ n: i + 1, q: t.q, given: a.final ? (a.revealed ? 'ответ подсмотрен' : a.givenText) : 'нет ответа', right: T.checker.answerText(t) });
      });
      return {
        student: T.stats.getName(), subject: o.meta.subject, lessonTitle: o.meta.lessonTitle, lessonNo: o.meta.lessonNo, level: o.meta.level,
        mode, correct: c.ok, total: c.total, percent, grade: g.grade, gradeLabel: g.label, seconds: elapsed(),
        variant: o.variant, attempt: o.attempt || 1, errors, unanswered: c.total - c.done, secondTry: c.second,
      };
    }

    function update() {
      const c = counts();
      $('.bar .g', progress).style.width = (c.ok / c.total) * 100 + '%';
      $('.bar .r', progress).style.width = (c.bad / c.total) * 100 + '%';
      $('[data-c=done]', progress).textContent = c.done;
      $('[data-c=ok]', progress).textContent = c.ok;
      $('[data-c=bad]', progress).textContent = c.bad;
      const finished = c.done === c.total;
      if (finished && !st.finishedAt) { st.finishedAt = Date.now(); save(); }
      renderResult(finished);
      if (finished && !st.recorded) {
        st.recorded = true; save();
        const r = buildResult();
        T.stats.addHistory({ lessonId: o.meta.lessonId, mode, percent: r.percent, grade: r.grade, total: r.total });
        if (mode === 'hw' && cfg().AUTO_SEND_HOMEWORK && !st.sent) send(true);
        setTimeout(() => result.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
      }
    }

    function renderResult(finished) {
      const r = buildResult();
      result.innerHTML = `<h2 style="margin-top:0">${finished ? '🏁 Итоги работы' : '📊 Статистика'}</h2>
        <div class="result-body">${finished ? `<div class="grade g${r.grade}">${r.grade}</div>` : ''}
        <div><div style="font-size:20px">Верно: <b>${r.correct}</b> из ${r.total} · <b>${r.percent}%</b></div>
        <div>Отметка: <b>${r.grade}</b> (${r.gradeLabel})${finished ? '' : ' — предварительно'}</div>
        <div>Время: ${fmtT(r.seconds)}${r.variant ? ' · вариант ' + esc(r.variant) : ''}${r.attempt > 1 ? ' · попытка ' + r.attempt : ''}</div>
        ${r.secondTry && !isCW ? `<div>Со второй попытки: ${r.secondTry}</div>` : ''}
        ${finished ? '' : `<div class="sub">Без ответа: ${r.unanswered}</div>`}</div></div>
        <p class="sub" style="margin:10px 0 6px">Шкала: ${(cfg().GRADE_SCALE || []).map((s) => `«${s.grade}» — от ${s.min}%`).join(', ')}</p>
        <div class="row">
          <button class="btn green big" data-act="send">📩 ${st.sent ? 'Отправить ещё раз' : 'Отправить учителю'}</button>
          <button class="btn ghost" data-act="copy">📋 Скопировать результат</button>
          ${o.onNew ? `<button class="btn ghost" data-act="new">🔄 ${isCW || mode === 'tr' ? 'Новый вариант' : 'Начать заново (новый вариант)'}</button>` : ''}
        </div><div class="send-status ${st.sent ? 'ok' : ''}">${st.sent ? '✅ Результат отправлен учителю' : ''}</div>`;
      $('[data-act=send]', result).onclick = () => send(false);
      $('[data-act=copy]', result).onclick = copy;
      const nb = $('[data-act=new]', result);
      if (nb) nb.onclick = () => {
        if (mode === 'hw' && !confirm('Начать ДЗ заново? Будет выдан новый вариант, а учитель увидит номер попытки.')) return;
        o.onNew();
      };
    }

    async function send(auto) {
      const status = $('.send-status', result);
      const c = counts();
      if (!auto && c.done < c.total && !confirm(`Выполнено ${c.done} из ${c.total}. Отправить результат сейчас?`)) return;
      let name = T.stats.getName();
      if (!name) { name = await T.ui.askName(true); if (!name) return; }
      status.className = 'send-status wait';
      status.textContent = '⏳ Отправляю…';
      const r = buildResult();
      const res = await T.telegram.sendToTelegram(T.telegram.buildTelegramMessage(r));
      if (res.ok) {
        st.sent = true; save();
        renderResult(c.done === c.total);
        toast('✅ Результат отправлен учителю');
      } else {
        status.className = 'send-status bad';
        status.textContent = '⚠️ ' + res.error;
      }
    }

    async function copy() {
      const txt = T.telegram.buildTelegramMessage(buildResult()).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      try { await navigator.clipboard.writeText(txt); toast('📋 Скопировано — можно вставить в сообщение учителю'); }
      catch (_) { T.ui.modal(`<h2 style="margin-top:0">Результат</h2><textarea style="width:100%;height:260px">${esc(txt)}</textarea>`); }
    }

    const timer = setInterval(() => {
      if (!document.body.contains(root)) return clearInterval(timer);
      $('[data-c=time]', progress).textContent = fmtT(elapsed());
    }, 1000);
    update();
    return { update };
  }

  T.runner = { createRunner };
})();
