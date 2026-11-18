/* Общие утилиты: генератор случайных чисел с зерном, форматирование формул, конструкторы заданий. */
(function () {
  'use strict';
  const T = (globalThis.T = globalThis.T || {});

  /* ---------- Хеш строки и ГСЧ mulberry32 (одинаковое зерно → одинаковый вариант) ---------- */
  function hash(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }

  function rng(seed) {
    let s = typeof seed === 'string' ? hash(seed) : seed >>> 0;
    const next = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const int = (a, b) => a + Math.floor(next() * (b - a + 1));
    return {
      next,
      int,
      /** целое из [a;b], не равное 0 и не входящее в except */
      nz: (a, b, except = []) => {
        let v;
        do v = int(a, b); while (v === 0 || except.includes(v));
        return v;
      },
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      shuffle: (arr) => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      },
      sign: () => (next() < 0.5 ? -1 : 1),
      chance: (p) => next() < p,
    };
  }

  /* ---------- Математика ---------- */
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
  const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
  const round = (x, d = 6) => Math.round(x * 10 ** d) / 10 ** d;
  /** несократимая дробь в виде строки "p/q" (или целое) */
  function fracStr(p, q) {
    if (q < 0) { p = -p; q = -q; }
    const g = gcd(p, q) || 1;
    p /= g; q /= g;
    return q === 1 ? String(p) : p + '/' + q;
  }
  const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));

  /* ---------- Форматирование ---------- */
  /** число для показа: минус «−», десятичная запятая */
  function n(x) {
    const s = String(round(x, 6)).replace('.', ',');
    return s.replace(/^-/, '−');
  }
  /** число в скобках, если отрицательное: (−3) */
  const np = (x) => (x < 0 ? '(' + n(x) + ')' : n(x));
  /** многочлен в ASCII из пар [коэффициент, 'x^2'] → "3x^2-2x+5" */
  function poly(terms) {
    let s = '';
    for (const [c, v] of terms) {
      if (!c) continue;
      const a = Math.abs(c);
      const body = v ? (a === 1 ? '' : String(a).replace('.', ',')) + v : String(a).replace('.', ',');
      s += s === '' ? (c < 0 ? '-' : '') + body : (c < 0 ? '-' : '+') + body;
    }
    return s || '0';
  }
  /** «+ 3» / «− 3» — слагаемое со знаком для записи выражений */
  const sg = (c) => (c < 0 ? '-' + Math.abs(c) : '+' + c);
  /** ASCII-формула → красивый HTML (степени, «·», «−», пробелы вокруг + и −) */
  function m(s) {
    let h = String(s)
      .replace(/([^(\s^=,;:|<>[])([+\-])/g, '$1 $2 ')
      .replace(/=/g, ' = ')
      .replace(/\^\(([^)]*)\)/g, '<sup>$1</sup>')
      .replace(/\^(-?[0-9a-zA-Z]+)/g, '<sup>$1</sup>')
      .replace(/\*/g, '·')
      .replace(/-/g, '−')
      .replace(/\s+/g, ' ');
    return '<span class="m">' + h.trim() + '</span>';
  }
  /** дробь «столбиком» */
  const fr = (a, b) => '<span class="fr"><span>' + a + '</span><span>' + b + '</span></span>';

  /* ---------- Конструкторы заданий ---------- */
  const task = (type) => (q, a, o = {}) => Object.assign({ q, type, a }, o);
  const K = {
    N: task('num'), // число / дробь
    E: task('expr'), // алгебраическое выражение
    P: task('coord'), // координаты / пара чисел
    L: task('list'), // список чисел
    X: task('text'), // текстовый ответ
    /** выбор одного варианта: a — индекс верного */
    C: (q, opts, a, o = {}) => Object.assign({ q, type: 'choice', opts, a }, o),
    /** выбор нескольких вариантов: a — массив индексов */
    M: (q, opts, a, o = {}) => Object.assign({ q, type: 'multi', opts, a }, o),
    /** упорядочивание шагов (доказательство/построение): steps в верном порядке */
    O: (q, steps, o = {}) => Object.assign({ q, type: 'order', steps, a: steps }, o),
    /** «Да / Нет» */
    YN: (q, yes, o = {}) => Object.assign({ q, type: 'choice', opts: ['Да', 'Нет'], a: yes ? 0 : 1 }, o),
  };

  T.util = { hash, rng, gcd, lcm, round, fracStr, fact };
  T.fmt = { n, np, poly, sg, m, fr };
  T.K = K;
})();
