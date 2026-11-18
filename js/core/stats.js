/* Статистика: оценка по шкале, хранение имени ученика, истории и прогресса в localStorage. */
(function () {
  'use strict';
  const T = (globalThis.T = globalThis.T || {});
  const NAME_KEY = 'tr7:student';
  const HIST_KEY = 'tr7:history';

  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* приватный режим */ } },
    del(k) { try { localStorage.removeItem(k); } catch (_) { /* ignore */ } },
  };

  function grade(percent) {
    const scale = (globalThis.APP_CONFIG && APP_CONFIG.GRADE_SCALE) || [{ min: 90, grade: 5, label: 'отлично' }, { min: 70, grade: 4, label: 'хорошо' }, { min: 50, grade: 3, label: 'удовлетворительно' }, { min: 0, grade: 2, label: 'неудовлетворительно' }];
    return scale.find((s) => percent >= s.min) || scale[scale.length - 1];
  }

  const getName = () => ls.get(NAME_KEY, '');
  const setName = (n) => ls.set(NAME_KEY, String(n).trim().slice(0, 60));

  /** запись о завершённой работе: {key, lessonId, mode, percent, grade, date} */
  function addHistory(rec) {
    const h = ls.get(HIST_KEY, []);
    h.push(Object.assign({ date: Date.now() }, rec));
    ls.set(HIST_KEY, h.slice(-300));
  }
  const history = () => ls.get(HIST_KEY, []);
  /** лучший результат по уроку и режиму */
  function best(lessonId, mode) {
    const r = history().filter((x) => x.lessonId === lessonId && x.mode === mode);
    return r.length ? r.reduce((a, b) => (b.percent > a.percent ? b : a)) : null;
  }
  function summary() {
    const h = history();
    if (!h.length) return null;
    const avg = Math.round(h.reduce((s, x) => s + x.percent, 0) / h.length);
    const lessons = new Set(h.map((x) => x.lessonId)).size;
    const tasks = h.reduce((s, x) => s + (x.total || 0), 0);
    return { works: h.length, lessons, avg, tasks, grade: grade(avg).grade };
  }

  T.stats = { ls, grade, getName, setName, addHistory, history, best, summary };
})();
