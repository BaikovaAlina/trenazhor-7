/* Сводный тренажёр: задания из выбранных тем вперемешку. */
(function () {
  'use strict';
  const { $, $$, esc, askName } = T.ui;
  const SEL_KEY = 'tr7:trainerSel';
  const f = { subject: 'all', level: 'all' };
  let count = 10;
  const selected = new Set(T.stats.ls.get(SEL_KEY, []));

  const renderName = () => ($('#student span').textContent = T.stats.getName() || 'Представься');
  $('#student').addEventListener('click', async () => { await askName(); renderName(); });
  renderName();

  function visible() {
    return T.engine.lessons().filter((l) => (f.subject === 'all' || l.subject === f.subject) && (f.level === 'all' || l.level === f.level));
  }
  function renderPicker() {
    $('#picker').innerHTML = visible().map((l) => `<label><input type="checkbox" value="${l.id}" ${selected.has(l.id) ? 'checked' : ''}>
      <span>${l.subject === 'algebra' ? '🔢' : '📐'} <b>${l.no}.</b> ${esc(l.title)} ${l.level === 'adv' ? '<span class="badge adv">угл.</span>' : ''}</span></label>`).join('');
  }
  $('#picker').addEventListener('change', (e) => {
    if (e.target.checked) selected.add(e.target.value); else selected.delete(e.target.value);
    T.stats.ls.set(SEL_KEY, [...selected]);
  });
  $('#all-on').onclick = () => { visible().forEach((l) => selected.add(l.id)); T.stats.ls.set(SEL_KEY, [...selected]); renderPicker(); };
  $('#all-off').onclick = () => { visible().forEach((l) => selected.delete(l.id)); T.stats.ls.set(SEL_KEY, [...selected]); renderPicker(); };

  $$('.seg[data-filter]').forEach((seg) => $$('button', seg).forEach((b) => b.addEventListener('click', () => {
    f[seg.dataset.filter] = b.dataset.v;
    $$('button', seg).forEach((x) => x.classList.toggle('on', x === b));
    renderPicker();
  })));
  $$('#count button').forEach((b) => b.addEventListener('click', () => {
    count = +b.dataset.v;
    $$('#count button').forEach((x) => x.classList.toggle('on', x === b));
  }));

  function start() {
    const ls = T.engine.lessons().filter((l) => selected.has(l.id) && visible().includes(l));
    if (!ls.length) { T.ui.toast('Отметьте хотя бы одну тему'); return; }
    const seed = 'tr:' + Date.now();
    const tasks = T.engine.buildTasks(ls, count, seed);
    const subj = [...new Set(ls.map((l) => l.subjectTitle))].join(' + ');
    $('#setup').classList.add('hidden');
    const back = document.createElement('div');
    back.className = 'row';
    back.style.margin = '8px 0';
    back.innerHTML = `<button class="btn ghost small" type="button">⚙️ Изменить темы</button><span class="sub" style="margin:0">Тем: ${ls.length} · заданий: ${tasks.length}</span>`;
    $('button', back).onclick = () => { $('#setup').classList.remove('hidden'); $('#runner').innerHTML = ''; };
    const holder = document.createElement('div');
    $('#runner').innerHTML = '';
    $('#runner').append(back, holder);
    T.runner.createRunner({
      root: holder, tasks, mode: 'tr', variant: T.engine.variantCode(seed),
      meta: { subject: subj, lessonTitle: ls.length === 1 ? ls[0].title : `Сводный тренажёр (${ls.length} тем: ${ls.slice(0, 4).map((l) => l.no).join(', ')}${ls.length > 4 ? '…' : ''})`, lessonId: 'trainer' },
      onNew: () => { start(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
    });
  }
  $('#start').onclick = start;

  if (!selected.size) T.engine.lessons().slice(0, 3).forEach((l) => selected.add(l.id));
  renderPicker();
})();
