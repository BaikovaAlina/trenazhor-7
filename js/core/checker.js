/* Проверка ответов.
 * Типы: num (число/дробь), expr (выражение), coord (пара чисел), list (набор чисел),
 *       choice, multi, order, text.
 * Выражения сравниваются численно: подставляем случайные значения переменных
 * в ответ ученика и в эталон. Дополнительно проверяется форма записи
 * (раскрыты ли скобки, разложено ли на множители, стандартный вид одночлена).
 */
(function () {
  'use strict';
  const T = (globalThis.T = globalThis.T || {});

  /* ---------- Нормализация ввода ---------- */
  const CYR = { а: 'a', в: 'b', с: 'c', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', т: 't', у: 'y', х: 'x' };
  const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };

  function base(s) {
    return String(s == null ? '' : s)
      .trim()
      .replace(/[−–—‒]/g, '-')
      .replace(/[·×∙⋅•]/g, '*')
      .replace(/:/g, '/')
      .replace(/\u00a0/g, ' ');
  }

  /** выражение: латиница, степени через ^, без пробелов, десятичная точка */
  function normExpr(s) {
    let t = base(s).toLowerCase().replace(/ё/g, 'е');
    t = t.replace(/[авсекмнортух]/g, (ch) => CYR[ch]);
    t = t.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (g) => '^' + [...g].map((c) => SUP[c]).join(''));
    t = t.replace(/\s+/g, '').replace(/,/g, '.').replace(/\[/g, '(').replace(/\]/g, ')');
    t = t.replace(/^(y|f\(x\)|p\(x\)|p)=/, ''); // «y = 2x+1» → «2x+1»
    return t;
  }

  /** число: «3,5», «-7/2», «1 1/2», «40°», «12 см» → значение или NaN */
  function parseNum(s) {
    let t = base(s).toLowerCase().replace(/ё/g, 'е');
    t = t.replace(/(°|градус[а-я]*|град\.?|см²?|мм|дм|км|м|руб[а-я.]*|р\.|ч\.?|час[а-я]*|км\/ч)\s*$/, '').trim();
    t = t.replace(/^(x|y|a|х|у)\s*=\s*/, '');
    t = t.replace(/,/g, '.');
    let mm = t.match(/^(-)?(\d+)\s+(\d+)\/(\d+)$/); // смешанное число
    if (mm) {
      const v = +mm[2] + +mm[3] / +mm[4];
      return mm[1] ? -v : v;
    }
    t = t.replace(/\s+/g, '');
    mm = t.match(/^([+-]?\d*\.?\d+)\/([+-]?\d*\.?\d+)$/);
    if (mm) return +mm[2] === 0 ? NaN : +mm[1] / +mm[2];
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return parseFloat(t);
    return NaN;
  }

  const close = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

  /* ---------- Парсер выражений (рекурсивный спуск, неявное умножение) ---------- */
  function tokenize(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/[0-9.]/.test(c)) {
        let j = i;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        const v = Number(s.slice(i, j));
        if (Number.isNaN(v)) throw new Error('число');
        out.push({ t: 'n', v });
        i = j;
      } else if (/[a-z]/.test(c)) {
        out.push({ t: 'v', v: c });
        i++;
      } else if ('+-*/^()|'.includes(c)) {
        out.push({ t: c });
        i++;
      } else throw new Error('символ ' + c);
    }
    return out;
  }

  function parse(src) {
    const tk = tokenize(src);
    let p = 0;
    let absDepth = 0;
    const peek = () => tk[p];
    const eat = (t) => {
      if (!tk[p] || tk[p].t !== t) throw new Error('ожидалось ' + t);
      return tk[p++];
    };
    function expr() {
      let node = term();
      while (peek() && (peek().t === '+' || peek().t === '-')) {
        const op = tk[p++].t;
        node = { op, a: node, b: term() };
      }
      return node;
    }
    function startsFactor(x) {
      if (!x) return false;
      if (x.t === '|') return absDepth === 0; // открывающий модуль только снаружи
      return x.t === 'n' || x.t === 'v' || x.t === '(';
    }
    function term() {
      let node = unary();
      for (;;) {
        const x = peek();
        if (x && (x.t === '*' || x.t === '/')) {
          p++;
          node = { op: x.t, a: node, b: unary() };
        } else if (startsFactor(x)) {
          node = { op: '*', a: node, b: power(), implicit: true };
        } else break;
      }
      return node;
    }
    function unary() {
      const x = peek();
      if (x && x.t === '-') { p++; return { op: 'neg', a: unary() }; }
      if (x && x.t === '+') { p++; return unary(); }
      return power();
    }
    function power() {
      const b = primary();
      if (peek() && peek().t === '^') {
        p++;
        return { op: '^', a: b, b: unary() };
      }
      return b;
    }
    function primary() {
      const x = tk[p++];
      if (!x) throw new Error('конец');
      if (x.t === 'n') return { op: 'n', v: x.v };
      if (x.t === 'v') return { op: 'v', v: x.v };
      if (x.t === '(') { const e = expr(); eat(')'); return { op: 'par', a: e }; }
      if (x.t === '|') { absDepth++; const e = expr(); eat('|'); absDepth--; return { op: 'abs', a: e }; }
      throw new Error('неожиданно ' + x.t);
    }
    const tree = expr();
    if (p !== tk.length) throw new Error('лишние символы');
    return tree;
  }

  function evalAst(n, env) {
    switch (n.op) {
      case 'n': return n.v;
      case 'v': return n.v in env ? env[n.v] : NaN;
      case 'par': return evalAst(n.a, env);
      case 'abs': return Math.abs(evalAst(n.a, env));
      case 'neg': return -evalAst(n.a, env);
      case '+': return evalAst(n.a, env) + evalAst(n.b, env);
      case '-': return evalAst(n.a, env) - evalAst(n.b, env);
      case '*': return evalAst(n.a, env) * evalAst(n.b, env);
      case '/': return evalAst(n.a, env) / evalAst(n.b, env);
      case '^': return Math.pow(evalAst(n.a, env), evalAst(n.b, env));
    }
    return NaN;
  }

  const strip = (n) => (n.op === 'par' ? strip(n.a) : n);
  function isProduct(n) {
    n = strip(n);
    if (n.op === 'neg') return isProduct(n.a);
    return n.op === '*' || n.op === '^' || n.op === '/';
  }

  /** проверка формы записи выражения */
  function formOk(form, s, ast) {
    switch (form) {
      case 'expanded': return !/[()]/.test(s); // скобки раскрыты
      case 'factored': return /\(/.test(s) && isProduct(ast); // произведение множителей
      case 'mono': return /^-?(\d+(\.\d+)?)?\*?([a-z](\^\d+)?\*?)*$/.test(s) && new Set(s.match(/[a-z]/g) || []).size === (s.match(/[a-z]/g) || []).length;
      case 'nofrac': return !/\//.test(s);
      default: return true;
    }
  }

  const VALS = [1.37, -0.83, 2.21, -1.69, 0.57, 3.11, -2.43];
  function exprEqual(a, b) {
    const A = parse(normExpr(a));
    const B = parse(normExpr(b));
    const vars = new Set((normExpr(a) + normExpr(b)).match(/[a-z]/g) || []);
    let tested = 0;
    for (let k = 0; k < 7; k++) {
      const env = {};
      let i = k;
      for (const v of vars) env[v] = VALS[i++ % VALS.length] + 0.1 * k;
      const x = evalAst(A, env);
      const y = evalAst(B, env);
      if (!Number.isFinite(x) && !Number.isFinite(y)) continue;
      if (!close(x, y)) return false;
      tested++;
    }
    return tested > 0;
  }

  /* ---------- Пары и списки ---------- */
  function splitPair(s) {
    let t = base(s).replace(/[()[\]{}]/g, ' ').replace(/[xyху]\s*=/gi, ' ').trim();
    let parts;
    if (t.includes(';')) parts = t.split(';');
    else if ((t.match(/,/g) || []).length === 1) parts = t.split(',');
    else parts = t.split(/[\s,]+/);
    return parts.map((x) => x.trim()).filter(Boolean);
  }
  function splitList(s) {
    let t = base(s).replace(/[{}()[\]]/g, ' ').replace(/(^|[;\s])[a-zх]\d?\s*=/gi, '$1').trim();
    if (!t) return [];
    const parts = t.includes(';') ? t.split(';') : t.split(/[\s,]+/);
    return parts.map((x) => x.trim()).filter(Boolean);
  }

  const normText = (s) => base(s).toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '');

  /* ---------- Главная функция ---------- */
  /**
   * @returns {{ok:boolean, msg?:string}} msg — подсказка о формате (не о решении)
   */
  function check(task, input) {
    const alts = Array.isArray(task.a) && !['list', 'coord', 'multi', 'order'].includes(task.type) ? task.a : [task.a];
    try {
      switch (task.type) {
        case 'num': {
          const v = parseNum(input);
          if (Number.isNaN(v)) return { ok: false, msg: 'Введите число (например: 12; −3,5; 7/2)' };
          return { ok: alts.some((a) => close(v, typeof a === 'number' ? a : parseNum(a))) };
        }
        case 'expr': {
          const s = normExpr(input);
          if (!s) return { ok: false, msg: 'Введите выражение' };
          let ast;
          try { ast = parse(s); } catch (e) { return { ok: false, msg: 'Не удалось прочитать выражение. Степень пишите так: x^2 или x²' }; }
          const eq = alts.some((a) => exprEqual(s, a));
          if (!eq) return { ok: false };
          if (task.form && !formOk(task.form, s, ast)) {
            const why = { expanded: 'Значение верное, но нужно раскрыть скобки и привести подобные', factored: 'Значение верное, но нужно записать в виде произведения (разложить на множители)', mono: 'Значение верное, но запишите одночлен в стандартном виде', nofrac: 'Сократите дробь до конца' };
            return { ok: false, msg: why[task.form] };
          }
          if (task.not && new RegExp(task.not).test(s)) return { ok: false, msg: task.notMsg || 'Упростите выражение до конца' };
          return { ok: true };
        }
        case 'coord': {
          const p = splitPair(input).map(parseNum);
          if (p.length !== 2 || p.some(Number.isNaN)) return { ok: false, msg: 'Запишите пару чисел так: (2; −3)' };
          const want = task.a.map((x) => (typeof x === 'number' ? x : parseNum(x)));
          return { ok: close(p[0], want[0]) && close(p[1], want[1]) };
        }
        case 'list': {
          const raw = splitList(input);
          const p = raw.map(parseNum);
          if (!p.length || p.some(Number.isNaN)) return { ok: false, msg: 'Запишите числа через точку с запятой: 2; −5' };
          const want = task.a.map((x) => (typeof x === 'number' ? x : parseNum(x)));
          if (p.length !== want.length) return { ok: false, msg: want.length > p.length ? 'Найдены не все ответы' : undefined };
          const A = task.ordered ? p : p.slice().sort((x, y) => x - y);
          const B = task.ordered ? want : want.slice().sort((x, y) => x - y);
          return { ok: A.every((x, i) => close(x, B[i])) };
        }
        case 'choice':
          return { ok: Number(input) === task.a };
        case 'multi': {
          const got = (Array.isArray(input) ? input : []).map(Number).sort();
          const want = task.a.slice().sort();
          return { ok: got.length === want.length && got.every((x, i) => x === want[i]) };
        }
        case 'order': {
          const got = Array.isArray(input) ? input : [];
          return { ok: got.length === task.steps.length && got.every((s, i) => s === task.steps[i]) };
        }
        case 'text': {
          const t = normText(input);
          if (!t) return { ok: false, msg: 'Введите ответ' };
          if (task.keys) return { ok: task.keys.every((group) => group.some((k) => t.includes(normText(k)))) };
          return { ok: alts.some((a) => normText(a) === t) };
        }
      }
    } catch (e) {
      return { ok: false, msg: 'Ошибка формата ответа' };
    }
    return { ok: false };
  }

  /** правильный ответ в читаемом виде (для отчёта и «Показать ответ») */
  function answerText(task) {
    const f = T.fmt;
    switch (task.type) {
      case 'num': { const a = Array.isArray(task.a) ? task.a[0] : task.a; return typeof a === 'number' ? f.n(a) : String(a).replace('.', ','); }
      case 'expr': {
        const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
        return (Array.isArray(task.a) ? task.a[0] : task.a).replace(/\^(\d+)/g, (_, d) => [...d].map((c) => SUPS[c]).join('')).replace(/-/g, '−').replace(/\*/g, '·');
      }
      case 'coord': return '(' + task.a.map((x) => (typeof x === 'number' ? f.n(x) : x)).join('; ') + ')';
      case 'list': return task.a.map((x) => (typeof x === 'number' ? f.n(x) : x)).join('; ');
      case 'choice': return task.opts[task.a];
      case 'multi': return task.a.map((i) => task.opts[i]).join('; ');
      case 'order': return task.steps.map((s, i) => i + 1 + ') ' + s).join(' ');
      case 'text': return task.show || (Array.isArray(task.a) ? task.a[0] : task.a || '');
    }
    return '';
  }

  T.checker = { check, answerText, parseNum, normExpr, parse, exprEqual };
})();
