/* SVG-чертежи для геометрических задач (встраиваются прямо в текст задания). */
(function () {
  'use strict';
  const T = (globalThis.T = globalThis.T || {});
  const INK = '#1d3b8a';
  const RED = '#c62828';
  const wrap = (w, h, body) =>
    `<svg class="fig" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" font-family="Georgia, serif" font-size="15">${body}</svg>`;
  const line = (x1, y1, x2, y2, c = INK, w = 2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  const text = (x, y, s, c = INK, extra = '') => `<text x="${x}" y="${y}" fill="${c}" text-anchor="middle" dominant-baseline="middle" ${extra}>${s}</text>`;
  const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="3" fill="${INK}"/>`;

  /** Две параллельные прямые a, b и секущая c; углы пронумерованы 1–8.
   *  Верхнее пересечение: 1 — слева сверху, 2 — справа сверху, 3 — слева снизу, 4 — справа снизу.
   *  Нижнее: 5, 6, 7, 8 аналогично. marks: {номер: 'подпись'} — выделить красным. */
  function parallel(marks = {}, labels = true) {
    const P = [[150, 60], [110, 160]]; // точки пересечения
    let b = line(20, 60, 290, 60) + line(20, 160, 290, 160) + line(175, 0, 85, 220);
    b += text(280, 46, 'a') + text(280, 146, 'b') + text(178, 14, 'c');
    const off = [[-26, -14], [22, -14], [-28, 15], [20, 15]];
    P.forEach(([x, y], k) => {
      off.forEach(([dx, dy], i) => {
        const num = k * 4 + i + 1;
        if (!labels && !marks[num]) return;
        const mk = marks[num];
        b += text(x + dx, y + dy, mk ? mk : num, mk ? RED : '#555', mk ? 'font-weight="bold"' : 'font-size="13"');
      });
    });
    return wrap(300, 220, b);
  }

  /** Треугольник с подписями вершин, углов и сторон.
   *  o = {v:['A','B','C'], ang:{A:'40°'}, side:{AB:'7'}, right:'C', median/height/bisector: 'B'} */
  function triangle(o = {}) {
    const v = o.v || ['A', 'B', 'C'];
    const pts = o.pts || [[30, 175], [120, 30], [270, 175]];
    const [A, B, C] = pts;
    let b = `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="#e8efff" fill-opacity="0.45" stroke="${INK}" stroke-width="2"/>`;
    const cx = (A[0] + B[0] + C[0]) / 3, cy = (A[1] + B[1] + C[1]) / 3;
    pts.forEach(([x, y], i) => {
      const dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy);
      b += text(x + (dx / L) * 16, y + (dy / L) * 16, v[i], INK, 'font-weight="bold" font-style="italic"');
      const a = o.ang && o.ang[v[i]];
      if (a) b += text(x - (dx / L) * 30, y - (dy / L) * 26, a, RED, 'font-size="13"');
    });
    const sides = { [v[0] + v[1]]: [A, B], [v[1] + v[2]]: [B, C], [v[0] + v[2]]: [A, C] };
    for (const k in o.side || {}) {
      const s = sides[k] || sides[k.split('').reverse().join('')];
      if (!s) continue;
      const mx = (s[0][0] + s[1][0]) / 2, my = (s[0][1] + s[1][1]) / 2;
      const dx = mx - cx, dy = my - cy, L = Math.hypot(dx, dy) || 1;
      b += text(mx + (dx / L) * 16, my + (dy / L) * 14, o.side[k], RED, 'font-size="13"');
    }
    if (o.height) { // высота из вершины B на AC (AC горизонтальна)
      b += line(B[0], B[1], B[0], A[1], INK, 1.5) + `<path d="M${B[0]} ${A[1] - 10} h10 v10" fill="none" stroke="${INK}"/>` + text(B[0] - 4, A[1] + 14, o.height, INK, 'font-style="italic"');
    }
    if (o.median) {
      const M = [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2];
      b += line(B[0], B[1], M[0], M[1], INK, 1.5) + text(M[0] + 4, M[1] + 14, o.median, INK, 'font-style="italic"');
    }
    if (o.right) {
      const i = v.indexOf(o.right);
      const P = pts[i], Q = pts[(i + 1) % 3], R = pts[(i + 2) % 3];
      const u = (X) => { const dx = X[0] - P[0], dy = X[1] - P[1], L = Math.hypot(dx, dy); return [(dx / L) * 12, (dy / L) * 12]; };
      const [a1, a2] = u(Q), [b1, b2] = u(R);
      b += `<path d="M${P[0] + a1} ${P[1] + a2} L${P[0] + a1 + b1} ${P[1] + a2 + b2} L${P[0] + b1} ${P[1] + b2}" fill="none" stroke="${INK}"/>`;
    }
    return wrap(300, 200, b);
  }

  /** Лучи из точки O: names = ['A','C','B'] (по часовой от горизонтального), углы в градусах на рисунке */
  function rays(names = ['A', 'C', 'B'], angles = [0, 50, 120], marks = []) {
    const O = [40, 170];
    let b = dot(O[0], O[1]) + text(O[0] - 12, O[1] + 12, 'O', INK, 'font-style="italic"');
    names.forEach((nm, i) => {
      const t = (angles[i] * Math.PI) / 180;
      const x = O[0] + Math.cos(t) * 230, y = O[1] - Math.sin(t) * 150;
      b += line(O[0], O[1], x, y) + text(O[0] + Math.cos(t) * 245, O[1] - Math.sin(t) * 160, nm, INK, 'font-style="italic" font-weight="bold"');
    });
    marks.forEach(([i, j, s]) => {
      const t = (((angles[i] + angles[j]) / 2) * Math.PI) / 180;
      b += text(O[0] + Math.cos(t) * 70, O[1] - Math.sin(t) * 60, s, RED, 'font-size="13"');
    });
    return wrap(300, 190, b);
  }

  /** «Зигзаг»: AB ∥ CD, точка E между прямыми, отмечены ∠ABE и ∠CDE */
  function zigzag(a1, a2) {
    let b = line(20, 40, 280, 40) + line(20, 170, 280, 170);
    b += line(70, 40, 200, 105) + line(200, 105, 80, 170);
    b += dot(70, 40) + dot(80, 170) + dot(200, 105);
    b += text(66, 26, 'B', INK, 'font-style="italic" font-weight="bold"') + text(284, 26, 'A', INK, 'font-style="italic" font-weight="bold"');
    b += text(284, 186, 'C', INK, 'font-style="italic" font-weight="bold"') + text(80, 188, 'D', INK, 'font-style="italic" font-weight="bold"') + text(216, 105, 'E', INK, 'font-style="italic" font-weight="bold"');
    b += text(110, 54, a1, RED, 'font-size="13"') + text(120, 156, a2, RED, 'font-size="13"') + text(178, 105, '?', RED, 'font-weight="bold"');
    return wrap(300, 200, b);
  }

  /** Прямая и луч из точки на ней: смежные углы */
  function adjacent(m1, m2) {
    let b = line(10, 150, 290, 150) + line(150, 150, 220, 30) + dot(150, 150);
    b += text(16, 136, 'A', INK, 'font-style="italic"') + text(284, 136, 'B', INK, 'font-style="italic"') + text(150, 168, 'O', INK, 'font-style="italic"') + text(230, 22, 'C', INK, 'font-style="italic"');
    b += text(110, 128, m1, RED, 'font-size="13"') + text(200, 132, m2, RED, 'font-size="13"');
    return wrap(300, 180, b);
  }

  T.fig = { parallel, triangle, rays, zigzag, adjacent };
})();
