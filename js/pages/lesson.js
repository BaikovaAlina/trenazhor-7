/* Страница урока: «Классная работа» (cw) и «Домашнее задание» (hw). */
(function () {
  'use strict';
  const { $, esc, qs, askName, showTheory } = T.ui;
  const cfg = window.APP_CONFIG || {};
  const id = qs('id');
  const mode = qs('mode') === 'hw' ? 'hw' : 'cw';
  const lesson = T.engine.lessonById(id);

  const renderName = () => ($('#student span').textContent = T.stats.getName() || 'Представься');
  renderName();

  if (!lesson) {
    $('#title').textContent = 'Урок не найден';
    $('#runner').innerHTML = '<p class="card">Такого урока нет. <a href="index.html">Вернуться к списку уроков</a></p>';
    return;
  }

  document.title = `${mode === 'hw' ? 'Д' : 'К'}-${lesson.no} · ${lesson.title} · Математика 7`;
  $('#crumbs').textContent = `${lesson.subjectTitle} · Модуль ${lesson.moduleNo}. ${lesson.module.title} · ${lesson.level === 'adv' ? 'углублённый' : 'базовый'} уровень · ${lesson.umk}`;
  $('#title').textContent = `Урок ${lesson.no}. ${lesson.title}`;
  $('#tabs').innerHTML = `<a class="tab ${mode === 'cw' ? 'on' : ''}" href="lesson.html?id=${id}&mode=cw">✏️ Классная работа</a>
    <a class="tab ${mode === 'hw' ? 'on' : ''}" href="lesson.html?id=${id}&mode=hw">🏠 Домашнее задание</a>`;
  $('#theory-btn').addEventListener('click', () => showTheory(lesson));
  $('#student').addEventListener('click', async () => {
    const before = T.stats.getName();
    const n = await askName();
    renderName();
    if (n && n !== before && mode === 'hw') location.reload(); // у другого ученика — свой вариант
  });

  // навигация «предыдущий / следующий урок» в пределах предмета
  const same = T.engine.lessons().filter((l) => l.subject === lesson.subject);
  const k = same.indexOf(lesson);
  $('#nav').innerHTML = (k > 0 ? `<a class="btn ghost" href="lesson.html?id=${same[k - 1].id}&mode=${mode}">← Урок ${same[k - 1].no}</a>` : '<span></span>') +
    (k < same.length - 1 ? `<a class="btn ghost" href="lesson.html?id=${same[k + 1].id}&mode=${mode}">Урок ${same[k + 1].no} →</a>` : '');

  const meta = { subject: lesson.subjectTitle, lessonTitle: lesson.title, lessonNo: lesson.no, level: lesson.level, lessonId: lesson.id };

  function startCW() {
    const seed = 'cw:' + id + ':' + Date.now();
    const tasks = T.engine.buildTasks(lesson, cfg.CLASSWORK_SIZE || 10, seed);
    $('#info').innerHTML = `<span>✏️ Классная работа: <b>${tasks.length}</b> заданий</span><span>Попыток — сколько угодно, есть подсказки и «Показать ответ»</span>`;
    T.runner.createRunner({ root: $('#runner'), tasks, mode: 'cw', meta, variant: T.engine.variantCode(seed), onNew: () => { startCW(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  }

  async function startHW() {
    let name = T.stats.getName();
    if (!name) {
      $('#runner').innerHTML = '<div class="card"><p>Чтобы начать домашнее задание, представься — учитель увидит твою фамилию и имя.</p><button class="btn big" id="ask">👤 Ввести имя</button></div>';
      $('#ask').onclick = async () => { if (await askName(true)) { renderName(); startHW(); } };
      name = await askName(true);
      if (!name) return;
      renderName();
    }
    const aKey = `tr7:hwAttempt:${name}:${id}`;
    const attempt = T.stats.ls.get(aKey, 1);
    const seed = `hw|${name.toLowerCase()}|${id}|${attempt}`;
    const tasks = T.engine.buildTasks(lesson, cfg.HOMEWORK_SIZE || 8, seed);
    const variant = T.engine.variantCode(seed);
    $('#info').innerHTML = `<span>👤 <b>${esc(name)}</b></span><span>🔢 Вариант <b>${variant}</b>${attempt > 1 ? ` · попытка <b>${attempt}</b>` : ''}</span>
      <span>Попыток на задание: <b>${cfg.HOMEWORK_ATTEMPTS || 2}</b> (в заданиях с выбором — 1)</span><span>Ответы сохраняются автоматически</span>`;
    T.runner.createRunner({
      root: $('#runner'), tasks, mode: 'hw', meta, variant, attempt,
      persistKey: `tr7:hw:${name}:${id}:${attempt}`,
      onNew: () => { T.stats.ls.set(aKey, attempt + 1); startHW(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
    });
  }

  mode === 'hw' ? startHW() : startCW();
  T.telegram.flushQueue();
})();
