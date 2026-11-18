/* Отправка результатов учителю через Telegram Bot API (без собственного сервера).
 * Запрос отправляется как application/x-www-form-urlencoded: это «простой» CORS-запрос
 * без предварительного OPTIONS, он стабильно работает из браузера.
 */
(function () {
  'use strict';
  const T = (globalThis.T = globalThis.T || {});
  const QUEUE_KEY = 'tr7:tgQueue';
  const MAX_LEN = 4000; // лимит Telegram — 4096 символов

  const cfg = () => globalThis.APP_CONFIG || {};
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  /** HTML задания → короткий текст */
  function plain(html, max = 90) {
    let s = String(html)
      .replace(/<svg[\s\S]*?<\/svg>/g, ' [рисунок] ')
      .replace(/<sup>(.*?)<\/sup>/g, '^$1')
      .replace(/<span class="fr"><span>(.*?)<\/span><span>(.*?)<\/span><\/span>/g, '($1)/($2)')
      .replace(/<br\s*\/?>/g, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }

  function isConfigured() {
    const { TELEGRAM_BOT_TOKEN: t, TELEGRAM_CHAT_ID: c } = cfg();
    return !!t && !!c && !t.startsWith('__') && !String(c).startsWith('__');
  }

  const fmtTime = (sec) => {
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return m ? `${m} мин ${s} с` : `${s} с`;
  };

  /**
   * @param {object} r — результат: {student, subject, lessonTitle, lessonNo, level, mode, correct, total,
   *   percent, grade, gradeLabel, seconds, variant, attempt, errors:[{n, q, given, right}], unanswered}
   */
  function buildTelegramMessage(r) {
    const modeTitle = r.mode === 'hw' ? '🏠 Домашнее задание' : r.mode === 'cw' ? '✏️ Классная работа' : '🎯 Тренажёр';
    const medal = { 5: '🏆', 4: '👍', 3: '🙂', 2: '⚠️' }[r.grade] || '';
    const lines = [
      `<b>${modeTitle}</b>`,
      `👤 Ученик: <b>${esc(r.student || 'без имени')}</b>`,
      `📚 ${esc(r.subject)}${r.lessonNo ? ' · урок ' + r.lessonNo : ''}: <b>${esc(r.lessonTitle)}</b>`,
      r.level ? `🎚 Уровень: ${r.level === 'adv' ? 'углублённый' : 'базовый'}` : '',
      `✅ Верно: <b>${r.correct} из ${r.total}</b> (${r.percent}%)`,
      `${medal} Отметка: <b>${r.grade}</b> (${esc(r.gradeLabel)})`,
      `⏱ Время: ${fmtTime(r.seconds)}`,
      r.variant ? `🔢 Вариант: ${esc(r.variant)}${r.attempt > 1 ? ' · попытка ' + r.attempt : ''}` : '',
      `📅 ${new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}`,
    ].filter(Boolean);
    if (r.unanswered) lines.push(`⏳ Без ответа: ${r.unanswered}`);
    if (r.errors && r.errors.length) {
      lines.push('', '<b>❌ Ошибки:</b>');
      for (const e of r.errors) {
        const row = `${e.n}. ${esc(plain(e.q))}\n    ответ: «${esc(plain(e.given || '—', 60))}», верно: «${esc(plain(e.right, 60))}»`;
        if (lines.join('\n').length + row.length > MAX_LEN - 60) { lines.push('… (список ошибок сокращён)'); break; }
        lines.push(row);
      }
    } else if (r.correct === r.total) {
      lines.push('', '🎉 Без ошибок!');
    }
    return lines.join('\n').slice(0, MAX_LEN);
  }

  const ERRORS = {
    401: 'Неверный токен бота. Проверьте секрет TELEGRAM_BOT_TOKEN.',
    400: 'Чат не найден. Учитель должен открыть бота и нажать /start; проверьте TELEGRAM_CHAT_ID.',
    403: 'Бот заблокирован получателем или не добавлен в группу.',
    429: 'Слишком много сообщений. Попробуйте через минуту.',
  };

  async function rawSend(text, timeoutMs = 15000) {
    const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat } = cfg();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const body = new URLSearchParams({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: 'true' });
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', body, signal: ctrl.signal });
      let data = {};
      try { data = await res.json(); } catch (_) { /* пустой ответ */ }
      if (!res.ok || !data.ok) {
        const err = new Error(ERRORS[res.status] || data.description || 'Ошибка Telegram ' + res.status);
        err.fatal = res.status >= 400 && res.status < 500 && res.status !== 429;
        throw err;
      }
      return data;
    } catch (e) {
      if (e.name === 'AbortError') { const er = new Error('Нет ответа от Telegram (таймаут). Проверьте интернет.'); er.network = true; throw er; }
      if (e instanceof TypeError) { const er = new Error('Нет связи с Telegram. Проверьте интернет (в некоторых сетях Telegram может быть заблокирован).'); er.network = true; throw er; }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Отправка с одной повторной попыткой; при сетевой ошибке сообщение ставится в очередь */
  async function sendToTelegram(text) {
    if (!isConfigured()) {
      return { ok: false, error: 'Отправка не настроена: секреты Telegram не подставлены (см. README). Результат можно скопировать и отправить учителю вручную.' };
    }
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await rawSend(text);
        return { ok: true };
      } catch (e) {
        if (e.fatal || attempt === 2) {
          if (e.network) queue(text);
          return { ok: false, error: e.message + (e.network ? ' Результат сохранён и будет отправлен автоматически при следующем открытии сайта.' : '') };
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  function queue(text) {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    q.push(text);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-20)));
  }
  /** повторная отправка неотправленных результатов */
  async function flushQueue() {
    if (!isConfigured()) return 0;
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    if (!q.length) return 0;
    const rest = [];
    let sent = 0;
    for (const t of q) {
      try { await rawSend(t); sent++; } catch (e) { if (!e.fatal) rest.push(t); }
    }
    localStorage.setItem(QUEUE_KEY, JSON.stringify(rest));
    return sent;
  }

  function sendTest(student) {
    return sendToTelegram(`🔔 <b>Проверка связи</b>\nТренажёр «Математика 7» подключён.\n👤 ${esc(student || 'гость')}\n📅 ${new Date().toLocaleString('ru-RU')}`);
  }

  T.telegram = { buildTelegramMessage, sendToTelegram, sendTest, flushQueue, isConfigured, plain };
})();
