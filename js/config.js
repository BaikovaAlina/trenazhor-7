/* Конфигурация сайта.
 * ВНИМАНИЕ: в репозитории здесь только плейсхолдеры!
 * Реальные значения подставляет GitHub Actions (.github/workflows/deploy.yml)
 * из секретов TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID при публикации на GitHub Pages.
 */
window.APP_CONFIG = {
  TELEGRAM_BOT_TOKEN: '__TELEGRAM_BOT_TOKEN__',
  TELEGRAM_CHAT_ID: '__TELEGRAM_CHAT_ID__',

  SCHOOL_TITLE: 'Математика · 7 класс',
  /* Шкала перевода процента в отметку (можно изменить под положение о ВСОКО школы) */
  GRADE_SCALE: [
    { min: 90, grade: 5, label: 'отлично' },
    { min: 70, grade: 4, label: 'хорошо' },
    { min: 50, grade: 3, label: 'удовлетворительно' },
    { min: 0, grade: 2, label: 'неудовлетворительно' },
  ],
  CLASSWORK_SIZE: 10, // заданий в классной работе
  HOMEWORK_SIZE: 8, // заданий в домашней работе
  HOMEWORK_ATTEMPTS: 2, // попыток на каждое задание ДЗ
  AUTO_SEND_HOMEWORK: true, // отправлять результат ДЗ автоматически после последнего задания
};
