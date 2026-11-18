/* Движок: каталог уроков и сборка вариантов (без DOM — тестируется в Node). */
(function () {
  'use strict';
  const T = (globalThis.T = globalThis.T || {});

  /** плоский список уроков с метаданными и сквозной нумерацией по предмету */
  function catalog() {
    const out = [];
    for (const subj of Object.values(T.subjects || {})) {
      let no = 0;
      subj.modules.forEach((mod, mi) => {
        mod.lessons.forEach((l) => {
          no++;
          out.push(Object.assign(l, { subject: subj.id, subjectTitle: subj.title, module: mod, moduleNo: mi + 1, no }));
        });
      });
    }
    return out;
  }
  let _cat = null;
  const lessons = () => (_cat = _cat || catalog());
  const lessonById = (id) => lessons().find((l) => l.id === id);

  /** Собрать count заданий из генераторов урока(ов). Одинаковое зерно → одинаковый вариант. */
  function buildTasks(source, count, seed) {
    const R = T.util.rng(seed);
    const list = Array.isArray(source) ? source : [source];
    // пары [урок, генератор]
    const gens = [];
    list.forEach((l) => l.gens.forEach((g) => gens.push([l, g])));
    const tasks = [];
    const seen = new Set();
    let pool = [];
    let guard = 0;
    while (tasks.length < count && guard++ < count * 20) {
      if (!pool.length) pool = R.shuffle(gens);
      const [lesson, g] = pool.shift();
      let t = null;
      for (let k = 0; k < 6; k++) {
        const cand = g(R);
        if (!seen.has(cand.q)) { t = cand; break; }
      }
      if (!t) continue;
      seen.add(t.q);
      // для заданий на упорядочивание заранее перемешиваем шаги (детерминированно)
      const copy = Object.assign({}, t, { lessonId: lesson.id, lessonTitle: lesson.title });
      if (copy.type === 'order') {
        let sh;
        do sh = R.shuffle(copy.steps); while (copy.steps.length > 1 && sh.every((s, i) => s === copy.steps[i]));
        copy.shuffled = sh;
      }
      tasks.push(copy);
    }
    return tasks;
  }

  /** короткий код варианта для отчёта учителю */
  const variantCode = (seed) => (T.util.hash(String(seed)) % 46656).toString(36).toUpperCase().padStart(3, '0');

  T.engine = { lessons, lessonById, buildTasks, variantCode };
})();
