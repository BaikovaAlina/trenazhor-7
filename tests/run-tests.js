/* Автотесты: node tests/run-tests.js
 * 1) модуль проверки ответов (нормализация чисел, дробей, координат, списков, выражений);
 * 2) каждый генератор каждого урока: 80 вариантов, эталонный ответ должен проходить проверку,
 *    а заведомо неверный — нет.
 */
'use strict';
const path = require('path');
const root = path.join(__dirname, '..', 'js');
['core/utils.js', 'core/checker.js', 'core/figures.js', 'data/algebra.js', 'data/geometry.js', 'core/engine.js'].forEach((f) => require(path.join(root, f)));
const { check, answerText } = T.checker;

let fail = 0, pass = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.error('✗', msg); } }

/* ---------- 1. Модульные тесты проверки ---------- */
const num = (a, inp, exp = true) => ok(check({ type: 'num', a }, inp).ok === exp, `num ${a} ← "${inp}" ожидалось ${exp}`);
num(3.5, '3,5'); num(3.5, '7/2'); num(3.5, '3 1/2'); num(-0.5, '−0,5'); num(-0.5, '-1/2'); num(40, '40°'); num(12, '12 см'); num('7/3', '2 1/3'); num('7/3', '2,33', false); num(5, 'x = 5'); num(5, 'пять', false);
const ex = (a, inp, exp = true, form) => ok(check({ type: 'expr', a, form }, inp).ok === exp, `expr ${a} ← "${inp}" ожидалось ${exp}`);
ex('x^2+2x+1', 'x²+2x+1'); ex('x^2+2x+1', '1 + 2х + х^2'); ex('x^2+2x+1', '(x+1)^2', false, 'expanded'); ex('(x+1)^2', '(x+1)(x+1)', true, 'factored');
ex('(x+1)^2', 'x^2+2x+1', false, 'factored'); ex('-6a^2b^2', '−6a²b²', true, 'mono'); ex('a^8', 'a^3*a^5', false, 'mono'); ex('a^8', 'a⁸', true, 'mono');
ex('3x-5', 'y = 3x - 5'); ex('2x+3', '3+2*x'); ex('2x+3', '2x+4', false); ex('(x+3)/(x-3)', '(x+3):(x-3)'); ex('10a+b', 'b+10a'); ex('v*t+2u', 'vt + 2u'); ex('-(x-y)', 'y-x');
ex('x(x-3)(x+3)', '(x+3)x(x-3)', true, 'factored'); ex('-2(x-1)', '-2(x-1)', true, 'factored');
const co = (a, inp, exp = true) => ok(check({ type: 'coord', a }, inp).ok === exp, `coord ${a} ← "${inp}"`);
co([2, -3], '(2; -3)'); co([2, -3], '(2, −3)'); co([2, -3], 'x=2, y=-3'); co([2, -3], '2 -3'); co([1.5, 2], '(1,5; 2)'); co([2, -3], '(-3; 2)', false);
const li = (a, inp, exp = true, ordered) => ok(check({ type: 'list', a, ordered }, inp).ok === exp, `list ${a} ← "${inp}"`);
li([-2, 3], '3; -2'); li([-2, 3], '−2, 3'); li([-2, 3], '3', false); li([0, -4, 4], 'x=0; x=4; x=-4'); li([70, 110, 110], '110; 70; 110');
ok(check({ type: 'text', keys: [['серединн'], ['перпендикуляр']] }, 'Серединный перпендикуляр').ok, 'text keys');
ok(check({ type: 'multi', a: [0, 2] }, [2, 0]).ok && !check({ type: 'multi', a: [0, 2] }, [0]).ok, 'multi');
ok(check({ type: 'order', steps: ['a', 'b'] }, ['a', 'b']).ok && !check({ type: 'order', steps: ['a', 'b'] }, ['b', 'a']).ok, 'order');

/* ---------- 2. Все генераторы ---------- */
function canonical(t) {
  switch (t.type) {
    case 'num': return String(Array.isArray(t.a) ? t.a[0] : t.a);
    case 'expr': return Array.isArray(t.a) ? t.a[0] : t.a;
    case 'coord': return `(${t.a[0]}; ${t.a[1]})`;
    case 'list': return t.a.join('; ');
    case 'choice': return t.a;
    case 'multi': return t.a;
    case 'order': return t.steps;
    case 'text': return t.show || (Array.isArray(t.a) ? t.a[0] : t.a);
  }
}
function wrong(t) {
  switch (t.type) {
    case 'num': return String(T.checker.parseNum(String(Array.isArray(t.a) ? t.a[0] : t.a)) + 1.5);
    case 'expr': return '(' + (Array.isArray(t.a) ? t.a[0] : t.a) + ')+1';
    case 'coord': return `(${+t.a[0] + 1}; ${t.a[1]})`;
    case 'list': return t.a.map((x, i) => (i === 0 ? +x + 1 : x)).join('; ');
    case 'choice': return (t.a + 1) % t.opts.length;
    case 'multi': return t.a.slice(1);
    case 'order': return t.steps.slice().reverse();
    case 'text': return 'абракадабра';
  }
}
const TYPES = ['num', 'expr', 'coord', 'list', 'choice', 'multi', 'order', 'text'];
let generated = 0;
for (const l of T.engine.lessons()) {
  ok(l.theory && l.theory.length > 50, `${l.id}: нет памятки`);
  ok(['base', 'adv'].includes(l.level), `${l.id}: level`);
  l.gens.forEach((g, gi) => {
    for (let s = 0; s < 80; s++) {
      const R = T.util.rng(l.id + ':' + gi + ':' + s);
      let t;
      try { t = g(R); } catch (e) { ok(false, `${l.id}#${gi} seed ${s}: исключение ${e.message}`); break; }
      generated++;
      const where = `${l.id}#${gi} s${s} [${t.type}] ${String(t.q).replace(/<[^>]+>/g, '').slice(0, 70)}`;
      if (!TYPES.includes(t.type)) { ok(false, where + ': неизвестный тип'); break; }
      if (/undefined|NaN|Infinity/.test(t.q)) { ok(false, where + ': в условии undefined/NaN'); break; }
      if (t.type === 'choice') ok(Number.isInteger(t.a) && t.a >= 0 && t.a < t.opts.length, where + ': индекс ответа');
      const ans = answerText(t);
      if (/undefined|NaN|Infinity/.test(ans)) { ok(false, where + ': ответ ' + ans); break; }
      const r1 = check(t, canonical(t));
      if (!r1.ok) { ok(false, `${where}: эталон не принят (${canonical(t)}) ${r1.msg || ''}`); break; }
      pass++;
      const r2 = check(t, wrong(t));
      if (r2.ok) { ok(false, `${where}: неверный ответ принят (${wrong(t)})`); break; }
    }
  });
  // сборка вариантов: КР и ДЗ без повторов
  const cw = T.engine.buildTasks(l, 10, 'cw:' + l.id), hw = T.engine.buildTasks(l, 8, 'Иванов:' + l.id);
  ok(cw.length === 10 && hw.length === 8, `${l.id}: собрано ${cw.length}/${hw.length} заданий`);
  const hw2 = T.engine.buildTasks(l, 8, 'Иванов:' + l.id);
  ok(hw.map((t) => t.q).join() === hw2.map((t) => t.q).join(), `${l.id}: вариант ДЗ не детерминирован`);
}
const L = T.engine.lessons();
console.log(`Уроков: ${L.length} (алгебра ${L.filter((l) => l.subject === 'algebra').length}, геометрия ${L.filter((l) => l.subject === 'geometry').length}); генераторов: ${L.reduce((s, l) => s + l.gens.length, 0)}; проверено вариантов: ${generated}`);
console.log(`Тестов пройдено: ${pass}, ошибок: ${fail}`);
process.exit(fail ? 1 : 0);
