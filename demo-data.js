// Тестовые данные: 50 задач (10 «К выполнению», 30 «В работе», 10 «Выполнено»).
// Загружаются один раз. Прежние задачи сохраняются в резервную копию todo-items-backup.
// Чтобы загрузить тестовые задачи заново, откройте страницу с ?demo=1
(function () {
  const VERSION = 'demo-50-v1';
  const force = new URLSearchParams(location.search).has('demo');
  if (!force && localStorage.getItem('todo-demo-loaded') === VERSION) return;
  const prev = localStorage.getItem('todo-items');
  if (prev && !localStorage.getItem('todo-items-backup')) localStorage.setItem('todo-items-backup', prev);
  const todos = [
  {
    "id": "demo1",
    "num": 1,
    "text": "Настроить CI для фронтенда",
    "description": "Сборка и линтер на каждый пул-реквест.",
    "status": "active",
    "assignee": "Дмитрий Козлов",
    "start": "2026-11-17",
    "end": "2026-11-21",
    "files": []
  },
  {
    "id": "demo2",
    "num": 2,
    "text": "Сверстать страницу профиля",
    "description": "Аватар, имя, список последних действий.",
    "status": "active",
    "assignee": "Ольга Новикова",
    "start": "2026-11-12",
    "end": "2026-11-15",
    "files": []
  },
  {
    "id": "demo3",
    "num": 3,
    "text": "Добавить тёмную тему",
    "description": "Переключатель в настройках, сохранять выбор.",
    "status": "active",
    "assignee": "Ольга Новикова",
    "start": "2026-11-13",
    "end": "2026-11-20",
    "files": []
  },
  {
    "id": "demo4",
    "num": 4,
    "text": "Оптимизировать загрузку изображений",
    "description": "Ленивая загрузка и форматы WebP.",
    "status": "active",
    "assignee": "Алексей Смирнов",
    "start": "2026-11-12",
    "end": "2026-11-22",
    "files": []
  },
  {
    "id": "demo5",
    "num": 5,
    "text": "Написать юнит-тесты для корзины",
    "description": "Покрыть добавление, удаление и пересчёт суммы.",
    "status": "active",
    "assignee": "Дмитрий Козлов",
    "start": "2026-11-12",
    "end": "2026-11-15",
    "files": []
  },
  {
    "id": "demo6",
    "num": 6,
    "text": "Исправить баг с датой в отчётах",
    "description": "Даты сдвигаются на день из-за часового пояса.",
    "status": "active",
    "assignee": "Алексей Смирнов",
    "start": "2026-11-18",
    "end": "2026-11-21",
    "files": []
  },
  {
    "id": "demo7",
    "num": 7,
    "text": "Подключить аналитику",
    "description": "События регистрации и оплаты.",
    "status": "active",
    "assignee": "Дмитрий Козлов",
    "start": "2026-11-13",
    "end": "2026-11-23",
    "files": []
  },
  {
    "id": "demo8",
    "num": 8,
    "text": "Обновить зависимости проекта",
    "description": "Проверить совместимость после обновления.",
    "status": "active",
    "assignee": "Наталья Русакова",
    "start": "2026-11-12",
    "end": "2026-11-23",
    "files": []
  },
  {
    "id": "demo9",
    "num": 9,
    "text": "Сделать форму обратной связи",
    "description": "Имя, email, сообщение, валидация полей.",
    "status": "active",
    "assignee": "Игорь Петров",
    "start": "2026-11-15",
    "end": "2026-11-27",
    "files": []
  },
  {
    "id": "demo10",
    "num": 10,
    "text": "Добавить поиск по каталогу",
    "description": "Поиск по названию с подсветкой совпадений.",
    "status": "active",
    "assignee": "Ольга Новикова",
    "start": "2026-11-12",
    "end": "2026-11-23",
    "files": []
  },
  {
    "id": "demo11",
    "num": 11,
    "text": "Рефакторинг модуля авторизации",
    "description": "Вынести работу с токенами в отдельный сервис.",
    "status": "progress",
    "assignee": "Алексей Смирнов",
    "start": "2026-11-05",
    "end": "2026-11-07",
    "files": []
  },
  {
    "id": "demo12",
    "num": 12,
    "text": "Сверстать письмо-приветствие",
    "description": "Шаблон для новых пользователей.",
    "status": "progress",
    "assignee": "Алексей Смирнов",
    "start": "2026-11-11",
    "end": "2026-11-21",
    "files": []
  },
  {
    "id": "demo13",
    "num": 13,
    "text": "Настроить логирование ошибок",
    "description": "Отправлять ошибки клиента на сервер.",
    "status": "progress",
    "assignee": "Алексей Смирнов",
    "start": "2026-11-07",
    "end": "2026-11-15",
    "files": []
  },
  {
    "id": "demo14",
    "num": 14,
    "text": "Добавить пагинацию в список заказов",
    "description": "По 20 заказов на страницу.",
    "status": "progress",
    "assignee": "Ольга Новикова",
    "start": "2026-11-03",
    "end": "2026-11-06",
    "files": []
  },
  {
    "id": "demo15",
    "num": 15,
    "text": "Сделать экспорт в CSV",
    "description": "Выгрузка отчёта по продажам.",
    "status": "progress",
    "assignee": "Игорь Петров",
    "start": "2026-11-07",
    "end": "2026-11-17",
    "files": []
  },
  {
    "id": "demo16",
    "num": 16,
    "text": "Улучшить доступность кнопок",
    "description": "Подписи aria-label и фокус с клавиатуры.",
    "status": "progress",
    "assignee": "Ольга Новикова",
    "start": "2026-11-09",
    "end": "2026-11-12",
    "files": []
  },
  {
    "id": "demo17",
    "num": 17,
    "text": "Перевести интерфейс на английский",
    "description": "Вынести строки в файлы переводов.",
    "status": "progress",
    "assignee": "Алексей Смирнов",
    "start": "2026-11-02",
    "end": "2026-11-14",
    "files": []
  },
  {
    "id": "demo18",
    "num": 18,
    "text": "Добавить уведомления в браузере",
    "description": "Напоминания о сроках задач.",
    "status": "progress",
    "assignee": "Ольга Новикова",
    "start": "2026-11-06",
    "end": "2026-11-09",
    "files": []
  },
  {
    "id": "demo19",
    "num": 19,
    "text": "Сократить время сборки",
    "description": "Кэширование и разбиение на чанки.",
    "status": "progress",
    "assignee": "Наталья Русакова",
    "start": "2026-11-10",
    "end": "2026-11-21",
    "files": []
  },
  {
    "id": "demo20",
    "num": 20,
    "text": "Сделать адаптив для планшетов",
    "description": "Проверить ширины 768–1024 px.",
    "status": "progress",
    "assignee": "Дмитрий Козлов",
    "start": "2026-11-02",
    "end": "2026-11-07",
    "files": []
  },
  {
    "id": "demo21",
    "num": 21,
    "text": "Добавить фильтр по исполнителю",
    "description": "Выпадающий список на доске.",
    "status": "progress",
    "assignee": "Мария Иванова",
    "start": "2026-11-03",
    "end": "2026-11-11",
    "files": []
  },
  {
    "id": "demo22",
    "num": 22,
    "text": "Описать API в документации",
    "description": "Все эндпоинты с примерами запросов.",
    "status": "progress",
    "assignee": "Дмитрий Козлов",
    "start": "2026-11-04",
    "end": "2026-11-15",
    "files": []
  },
  {
    "id": "demo23",
    "num": 23,
    "text": "Настроить резервное копирование БД",
    "description": "Ежедневный бэкап с хранением 14 дней.",
    "status": "progress",
    "assignee": "Алексей Смирнов",
    "start": "2026-11-06",
    "end": "2026-11-12",
    "files": []
  },
  {
    "id": "demo24",
    "num": 24,
    "text": "Сделать страницу 404",
    "description": "Понятный текст и ссылка на главную.",
    "status": "progress",
    "assignee": "Наталья Русакова",
    "start": "2026-11-09",
    "end": "2026-11-14",
    "files": []
  },
  {
    "id": "demo25",
    "num": 25,
    "text": "Исправить вёрстку в Safari",
    "description": "Съезжает шапка на iOS.",
    "status": "progress",
    "assignee": "Ольга Новикова",
    "start": "2026-11-02",
    "end": "2026-11-08",
    "files": []
  },
  {
    "id": "demo26",
    "num": 26,
    "text": "Добавить сортировку таблицы",
    "description": "По дате, сумме и статусу.",
    "status": "progress",
    "assignee": "Игорь Петров",
    "start": "2026-11-04",
    "end": "2026-11-11",
    "files": []
  },
  {
    "id": "demo27",
    "num": 27,
    "text": "Ограничить частоту запросов к API",
    "description": "Не больше 60 запросов в минуту.",
    "status": "progress",
    "assignee": "Ольга Новикова",
    "start": "2026-11-04",
    "end": "2026-11-10",
    "files": []
  },
  {
    "id": "demo28",
    "num": 28,
    "text": "Сделать загрузку аватара",
    "description": "Обрезка до квадрата и сжатие.",
    "status": "progress",
    "assignee": "Ольга Новикова",
    "start": "2026-11-10",
    "end": "2026-11-13",
    "files": []
  },
  {
    "id": "demo29",
    "num": 29,
    "text": "Настроить HTTPS на тестовом стенде",
    "description": "Сертификат и редирект с HTTP.",
    "status": "progress",
    "assignee": "Мария Иванова",
    "start": "2026-11-05",
    "end": "2026-11-09",
    "files": []
  },
  {
    "id": "demo30",
    "num": 30,
    "text": "Провести код-ревью модуля оплаты",
    "description": "Проверить обработку ошибок банка.",
    "status": "progress",
    "assignee": "Дмитрий Козлов",
    "start": "2026-11-09",
    "end": "2026-11-18",
    "files": []
  },
  {
    "id": "demo31",
    "num": 31,
    "text": "Добавить двухфакторную авторизацию",
    "description": "Коды из приложения-аутентификатора.",
    "status": "progress",
    "assignee": "Наталья Русакова",
    "start": "2026-11-11",
    "end": "2026-11-23",
    "files": []
  },
  {
    "id": "demo32",
    "num": 32,
    "text": "Сделать дашборд метрик",
    "description": "Графики заказов и выручки по дням.",
    "status": "progress",
    "assignee": "Мария Иванова",
    "start": "2026-11-03",
    "end": "2026-11-14",
    "files": []
  },
  {
    "id": "demo33",
    "num": 33,
    "text": "Переписать стили на CSS-переменные",
    "description": "Единая палитра и отступы.",
    "status": "progress",
    "assignee": "Ольга Новикова",
    "start": "2026-11-06",
    "end": "2026-11-13",
    "files": []
  },
  {
    "id": "demo34",
    "num": 34,
    "text": "Добавить подтверждение email",
    "description": "Письмо со ссылкой подтверждения.",
    "status": "progress",
    "assignee": "Дмитрий Козлов",
    "start": "2026-11-04",
    "end": "2026-11-15",
    "files": []
  },
  {
    "id": "demo35",
    "num": 35,
    "text": "Исправить утечку памяти на графиках",
    "description": "Удалять обработчики при закрытии.",
    "status": "progress",
    "assignee": "Мария Иванова",
    "start": "2026-11-10",
    "end": "2026-11-13",
    "files": []
  },
  {
    "id": "demo36",
    "num": 36,
    "text": "Сделать импорт задач из файла",
    "description": "Поддержать CSV и JSON.",
    "status": "progress",
    "assignee": "Наталья Русакова",
    "start": "2026-11-04",
    "end": "2026-11-16",
    "files": []
  },
  {
    "id": "demo37",
    "num": 37,
    "text": "Добавить горячие клавиши",
    "description": "N — новая задача, / — поиск.",
    "status": "progress",
    "assignee": "Игорь Петров",
    "start": "2026-11-11",
    "end": "2026-11-17",
    "files": []
  },
  {
    "id": "demo38",
    "num": 38,
    "text": "Настроить мониторинг сервера",
    "description": "Оповещения при загрузке CPU выше 80%.",
    "status": "progress",
    "assignee": "Дмитрий Козлов",
    "start": "2026-11-02",
    "end": "2026-11-14",
    "files": []
  },
  {
    "id": "demo39",
    "num": 39,
    "text": "Сделать онбординг для новых пользователей",
    "description": "Три подсказки при первом входе.",
    "status": "progress",
    "assignee": "Игорь Петров",
    "start": "2026-11-07",
    "end": "2026-11-15",
    "files": []
  },
  {
    "id": "demo40",
    "num": 40,
    "text": "Обновить политику конфиденциальности",
    "description": "Согласовать текст с юристом.",
    "status": "progress",
    "assignee": "Дмитрий Козлов",
    "start": "2026-11-06",
    "end": "2026-11-08",
    "files": []
  },
  {
    "id": "demo41",
    "num": 41,
    "text": "Создать репозиторий проекта",
    "description": "Структура папок и README.",
    "status": "done",
    "assignee": "Ольга Новикова",
    "start": "2026-10-22",
    "end": "2026-10-26",
    "files": []
  },
  {
    "id": "demo42",
    "num": 42,
    "text": "Сверстать главную страницу",
    "description": "Шапка, блок с преимуществами, подвал.",
    "status": "done",
    "assignee": "Наталья Русакова",
    "start": "2026-10-30",
    "end": "2026-11-08",
    "files": []
  },
  {
    "id": "demo43",
    "num": 43,
    "text": "Настроить линтер и форматирование",
    "description": "ESLint и Prettier с общими правилами.",
    "status": "done",
    "assignee": "Алексей Смирнов",
    "start": "2026-10-27",
    "end": "2026-11-02",
    "files": []
  },
  {
    "id": "demo44",
    "num": 44,
    "text": "Сделать регистрацию по email",
    "description": "Форма, проверка пароля, письмо.",
    "status": "done",
    "assignee": "Дмитрий Козлов",
    "start": "2026-10-26",
    "end": "2026-11-03",
    "files": []
  },
  {
    "id": "demo45",
    "num": 45,
    "text": "Добавить сохранение в localStorage",
    "description": "Задачи не пропадают после обновления.",
    "status": "done",
    "assignee": "Алексей Смирнов",
    "start": "2026-10-18",
    "end": "2026-10-21",
    "files": []
  },
  {
    "id": "demo46",
    "num": 46,
    "text": "Сделать перетаскивание карточек",
    "description": "Drag-and-drop между колонками.",
    "status": "done",
    "assignee": "Ольга Новикова",
    "start": "2026-10-19",
    "end": "2026-10-27",
    "files": []
  },
  {
    "id": "demo47",
    "num": 47,
    "text": "Добавить кнопку удаления задачи",
    "description": "С подтверждением перед удалением.",
    "status": "done",
    "assignee": "Дмитрий Козлов",
    "start": "2026-10-25",
    "end": "2026-10-29",
    "files": []
  },
  {
    "id": "demo48",
    "num": 48,
    "text": "Сделать переключатель вида",
    "description": "Доска или список с фильтрами.",
    "status": "done",
    "assignee": "Мария Иванова",
    "start": "2026-10-25",
    "end": "2026-11-02",
    "files": []
  },
  {
    "id": "demo49",
    "num": 49,
    "text": "Добавить панель описания задачи",
    "description": "Открывается справа по клику.",
    "status": "done",
    "assignee": "Алексей Смирнов",
    "start": "2026-10-21",
    "end": "2026-10-26",
    "files": []
  },
  {
    "id": "demo50",
    "num": 50,
    "text": "Подготовить демо для команды",
    "description": "Показать доску на планёрке.",
    "status": "done",
    "assignee": "Алексей Смирнов",
    "start": "2026-10-31",
    "end": "2026-11-04",
    "files": []
  }
];
  localStorage.setItem('todo-items', JSON.stringify({ nextNum: todos.length + 1, todos }));
  localStorage.setItem('todo-demo-loaded', VERSION);
  localStorage.removeItem('todo-demo-files'); // свежий набор задач — вложения добавятся заново
  if (force) history.replaceState(null, '', location.pathname);
})();

// Тестовые вложения (папка attachments/): скриншоты, PDF, архивы и файл ровно в 1 байт.
// Добавляются в тестовые задачи один раз и только если в задаче ещё нет файлов — ваши правки не трогаем.
(function () {
  const VERSION = 'demo-files-v1';
  if (localStorage.getItem('todo-demo-files')) return; // уже добавлены (любой версии)
  const f = (name, size, type) => ({ id: 'demo-' + name, name, size, type, data: 'attachments/' + name });
  const FILES = {
    demo1: [
      f('screenshot-board.png', 105490, 'image/png'),
      f('screenshot-list.png', 137986, 'image/png'),
      f('screenshot-task-card.png', 161235, 'image/png'),
      f('tz-kanban.pdf', 42333, 'application/pdf'),
      f('design-assets.zip', 255238, 'application/zip'),
    ],
    demo2: [
      f('screenshot-employees.png', 59318, 'image/png'),
      f('empty.txt', 1, 'text/plain'),
    ],
    demo11: [
      f('test-report.pdf', 27565, 'application/pdf'),
      f('logs.zip', 353, 'application/zip'),
    ],
  };
  try {
    const data = JSON.parse(localStorage.getItem('todo-items'));
    if (!data || !Array.isArray(data.todos)) return;
    data.todos.forEach(t => { if (FILES[t.id] && !(t.files && t.files.length)) t.files = FILES[t.id]; });
    localStorage.setItem('todo-items', JSON.stringify(data));
    localStorage.setItem('todo-demo-files', VERSION);
  } catch { /* повреждённые данные — пропускаем */ }
})();
