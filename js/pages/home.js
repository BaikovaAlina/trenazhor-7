/* Главная страница: каталог модулей и уроков с фильтрами, статистика, проверка связи. */
(function () {
  'use strict';
  const { $, $$, esc, askName, showTheory, toast } = T.ui;
  T.engine.lessons(); // проставляет сквозные номера уроков
  const F_KEY = 'tr7:filters';
  const filters = Object.assign({ subject: 'all', level: 'all', q: '' }, T.stats.ls.get(F_KEY, {}));

  function renderName() {
    const n = T.stats.getName();
    $('#student span').textContent = n || 'Представься';
  }
  $('#student').addEventListener('click', async () => { await askName(); renderName(); });

  function renderSummary() {
    const s = T.stats.summary();
    if (!s) return;
    $('#summary').innerHTML = `<h3>📊 Мои результаты</h3><div class="stat-grid">
      <div class="stat"><b>${s.works}</b><span>работ выполнено</span></div>
      <div class="stat"><b>${s.lessons}</b><span>уроков пройдено</span></div>
      <div class="stat"><b>${s.avg}%</b><span>средний результат</span></div>
      <div class="stat"><b>${s.grade}</b><span>средняя отметка</span></div></div>`;
  }

  function renderCatalog() {
    const q = filters.q.trim().toLowerCase();
    const root = $('#catalog');
    root.innerHTML = '';
    let shown = 0;
    for (const subj of Object.values(T.subjects)) {
      if (filters.subject !== 'all' && filters.subject !== subj.id) continue;
      subj.modules.forEach((mod, mi) => {
        const ls = mod.lessons.filter((l) => (filters.level === 'all' || l.level === filters.level) && (!q || (l.title + ' ' + mod.title + ' ' + l.umk).toLowerCase().includes(q)));
        if (!ls.length) return;
        shown += ls.length;
        const sec = document.createElement('section');
        sec.innerHTML = `<h2 class="module-title">${subj.id === 'algebra' ? '🔢' : '📐'} ${esc(subj.title)} · Модуль ${mi + 1}. ${esc(mod.title)} <small>${ls.length} ${ls.length === 1 ? 'урок' : ls.length < 5 ? 'урока' : 'уроков'}</small></h2><div class="lessons"></div>`;
        const grid = $('.lessons', sec);
        ls.forEach((l) => {
          const best = T.stats.best(l.id, 'hw');
          const card = document.createElement('article');
          card.className = 'card lesson ' + subj.id;
          card.innerHTML = `${best ? `<span class="badge done" title="Лучший результат ДЗ">ДЗ: ${best.percent}% · «${best.grade}»</span>` : ''}
            <div class="head"><div class="num">${l.no}</div><div><h3>${esc(l.title)}</h3>
            <div class="meta"><span class="badge ${l.level === 'adv' ? 'adv' : ''}">${l.level === 'adv' ? 'углублённый' : 'базовый'}</span>${subj.id === 'geometry' ? '<span class="badge geo">геометрия</span>' : ''} ${esc(l.umk)}</div></div></div>
            <div class="actions">
              <a class="btn" href="lesson.html?id=${l.id}&mode=cw">✏️ К-${l.no} · Классная</a>
              <a class="btn orange" href="lesson.html?id=${l.id}&mode=hw">🏠 Д-${l.no} · Домашняя</a>
              <button class="btn ghost" type="button" data-theory="${l.id}" title="Памятка">📘</button>
            </div>`;
          grid.appendChild(card);
        });
        root.appendChild(sec);
      });
    }
    if (!shown) root.innerHTML = '<p class="empty">Ничего не найдено. Измените фильтры или запрос 🙂</p>';
  }

  $('#catalog').addEventListener('click', (e) => {
    const b = e.target.closest('[data-theory]');
    if (b) showTheory(T.engine.lessonById(b.dataset.theory));
  });

  $$('.seg[data-filter]').forEach((seg) => {
    const key = seg.dataset.filter;
    $$('button', seg).forEach((b) => {
      b.classList.toggle('on', b.dataset.v === filters[key]);
      b.addEventListener('click', () => {
        filters[key] = b.dataset.v;
        $$('button', seg).forEach((x) => x.classList.toggle('on', x === b));
        T.stats.ls.set(F_KEY, filters);
        renderCatalog();
      });
    });
  });
  const search = $('#search');
  search.value = filters.q;
  search.addEventListener('input', () => { filters.q = search.value; T.stats.ls.set(F_KEY, filters); renderCatalog(); });

  /* ---- блок учителя ---- */
  const tgStatus = $('#tg-status');
  tgStatus.innerHTML = T.telegram.isConfigured()
    ? '✅ Отправка результатов в Telegram настроена. Нажмите кнопку, чтобы отправить тестовое сообщение.'
    : '⚠️ Отправка не настроена: в config.js остались плейсхолдеры. Добавьте секреты TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в GitHub (см. инструкцию) — Actions подставит их при публикации.';
  $('#tg-test').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const r = await T.telegram.sendTest(T.stats.getName());
    e.target.disabled = false;
    toast(r.ok ? '✅ Тестовое сообщение отправлено — проверьте Telegram' : '⚠️ ' + r.error, 6000);
  });

  renderName();
  renderSummary();
  renderCatalog();
  T.telegram.flushQueue().then((n) => n && toast(`📨 Отправлено сохранённых результатов: ${n}`));
})();
