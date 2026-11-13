const STORAGE_KEY = 'todo-items';
const SETTINGS_KEY = 'todo-settings';
const COLUMNS = [
  { id: 'active', title: 'К выполнению' },
  { id: 'progress', title: 'В работе' },
  { id: 'done', title: 'Выполнено' },
];
const STATUS_TITLE = Object.fromEntries(COLUMNS.map(c => [c.id, c.title]));

const $ = id => document.getElementById(id);
const main = $('main'), layout = $('layout'), details = $('details'), search = $('search');
const dialog = $('add-dialog'), addForm = $('add-form'), addTitle = $('add-title'), addDesc = $('add-desc');
const MAX_FILE = 2 * 1024 * 1024; // 2 МБ на файл: localStorage вмещает около 5 МБ всего
let draftFiles = [];

// Права текущего пользователя (см. auth.js)
const user = window.Auth?.user || null;
const isCreator = user?.role === 'creator';
const can = { create: isCreator, edit: isCreator, remove: isCreator, take: !!user && !isCreator, move: !!user };

let state = loadTodos();
let settings = loadSettings();
let selectedId = null;

// ---------- Хранение ----------
function loadTodos() {
  let data;
  try { data = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { data = null; }
  // Самая первая версия хранила просто массив задач с полем done
  if (Array.isArray(data)) {
    data = { nextNum: data.length + 1, todos: data.map((t, i) => ({ id: t.id, num: i + 1, text: t.text, status: t.done ? 'done' : 'active' })) };
  }
  if (!data || !Array.isArray(data.todos)) data = { nextNum: 1, todos: [] };
  // Статусы прошлой версии доски переводим в новые три колонки
  const map = { todo: 'active', review: 'progress' };
  data.todos.forEach(t => {
    t.status = map[t.status] || t.status;
    if (!STATUS_TITLE[t.status]) t.status = 'active';
    if (typeof t.description !== 'string') t.description = '';
    t.start ??= ''; t.end ??= ''; t.assignee ??= '';
    if (!Array.isArray(t.files)) t.files = [];
  });
  return data;
}
function loadSettings() {
  let s;
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch { s = null; }
  return { view: s?.view === 'list' ? 'list' : 'kanban', filter: s?.filter || 'all', assignees: Array.isArray(s?.assignees) ? s.assignees : [] };
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { alert('Не удалось сохранить: в хранилище браузера закончилось место. Удалите часть прикреплённых файлов.'); return false; }
}
const saveSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
const findTodo = id => state.todos.find(t => t.id === id);

// ---------- Действия ----------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
function addTodo(data) {
  const todo = { id: uid(), num: state.nextNum++, status: 'active', ...data };
  state.todos.push(todo);
  if (!save()) { state.todos.pop(); state.nextNum--; return false; }
  renderMain();
  return true;
}

// ---------- Файлы ----------
function formatSize(b) {
  if (b < 1024) return `${b} Б`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} КБ`;
  return `${(b / 1024 / 1024).toFixed(1)} МБ`;
}
function readFiles(fileList) {
  const ok = [], skipped = [];
  const jobs = [...fileList].map(f => {
    if (f.size > MAX_FILE) { skipped.push(f.name); return null; }
    return new Promise(res => {
      const r = new FileReader();
      r.onload = () => { ok.push({ id: uid(), name: f.name, size: f.size, type: f.type, data: r.result }); res(); };
      r.onerror = () => { skipped.push(f.name); res(); };
      r.readAsDataURL(f);
    });
  });
  return Promise.all(jobs).then(() => {
    if (skipped.length) alert(`Не прикреплены (больше 2 МБ или ошибка чтения): ${skipped.join(', ')}`);
    return ok;
  });
}
const isImage = f => !!f.data && (/^image\//.test(f.type || '') || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name));
function fileList(files, onRemove) {
  const ul = el('ul', 'file-list');
  const images = files.filter(isImage);
  files.forEach(f => {
    const li = el('li');
    if (isImage(f)) {
      // Скриншот: миниатюра и имя открывают просмотрщик, листать можно между всеми картинками задачи
      li.classList.add('is-image');
      const open = e => { e.preventDefault(); e.stopPropagation(); openViewer(images, images.indexOf(f)); };
      const thumb = el('button', 'thumb'); thumb.type = 'button'; thumb.title = 'Открыть просмотр';
      const img = el('img'); img.src = f.data; img.alt = f.name; img.loading = 'lazy';
      thumb.append(img); thumb.addEventListener('click', open);
      const name = el('a', 'fname', f.name); name.href = f.data; name.title = 'Открыть просмотр';
      name.addEventListener('click', open);
      li.append(thumb, name, el('span', 'fsize', formatSize(f.size)));
    } else {
      const name = el(f.data ? 'a' : 'span', 'fname', fileIcon(f) + ' ' + f.name);
      if (f.data) { name.href = f.data; name.download = f.name; name.title = 'Скачать'; }
      li.append(name, el('span', 'fsize', formatSize(f.size)));
    }
    if (onRemove) {
      const rm = el('button', 'icon-btn', '×');
      rm.type = 'button'; rm.title = 'Убрать файл';
      rm.addEventListener('click', e => { e.stopPropagation(); onRemove(f.id); });
      li.append(rm);
    }
    ul.appendChild(li);
  });
  return ul;
}
function fileIcon(f) {
  if (/pdf$/i.test(f.type || '') || /\.pdf$/i.test(f.name)) return '📄';
  if (/zip|rar|7z|tar|gzip/i.test(f.type || '') || /\.(zip|rar|7z|tar|gz)$/i.test(f.name)) return '🗜️';
  return '📎';
}

// ---------- Просмотрщик скриншотов ----------
const viewer = $('viewer');
let viewerList = [], viewerIndex = 0;
function openViewer(list, index) {
  viewerList = list; viewerIndex = Math.max(0, index);
  showViewerImage();
  if (!viewer.open) viewer.showModal();
}
function showViewerImage() {
  const f = viewerList[viewerIndex];
  $('viewer-img').src = f.data; $('viewer-img').alt = f.name;
  $('viewer-name').textContent = f.name;
  $('viewer-download').href = f.data; $('viewer-download').download = f.name;
  const many = viewerList.length > 1;
  $('viewer-count').textContent = many ? `${viewerIndex + 1} из ${viewerList.length}` : '';
  $('viewer-prev').hidden = $('viewer-next').hidden = !many;
}
function stepViewer(d) {
  if (viewerList.length < 2) return;
  viewerIndex = (viewerIndex + d + viewerList.length) % viewerList.length; // по кругу
  showViewerImage();
}
$('viewer-prev').addEventListener('click', e => { e.stopPropagation(); stepViewer(-1); });
$('viewer-next').addEventListener('click', e => { e.stopPropagation(); stepViewer(1); });
$('viewer-close').addEventListener('click', e => { e.stopPropagation(); viewer.close(); });
viewer.addEventListener('click', e => { e.stopPropagation(); if (e.target === viewer || e.target.classList.contains('viewer-stage')) viewer.close(); });
viewer.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') { e.preventDefault(); stepViewer(-1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); stepViewer(1); }
});

function setupDrop(zone, onFiles) {
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('over'); onFiles(e.dataTransfer.files); });
}
const initials = name => name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
const formatDate = d => d ? new Date(d + 'T00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '';
function todayLocal() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
const isOverdue = t => t.end && t.status !== 'done' && t.end < todayLocal();
function metaBits(t) {
  const bits = [];
  if (t.assignee) { const a = el('span', 'avatar', initials(t.assignee)); a.title = t.assignee; bits.push(a); }
  if (t.end) { const d = el('span', 'due' + (isOverdue(t) ? ' overdue' : ''), '⏱ до ' + formatDate(t.end)); d.title = (t.start ? `с ${formatDate(t.start)} ` : '') + `до ${formatDate(t.end)}`; bits.push(d); }
  if (t.files.length) bits.push(el('span', 'attach', `📎 ${t.files.length}`));
  return bits;
}
function setStatus(id, status) {
  const t = findTodo(id);
  if (!t || t.status === status) return;
  t.status = status;
  save(); renderMain();
  if (selectedId === id) renderDetails();
}
async function takeTodo(id) {
  const t = findTodo(id);
  if (!t || !can.take || t.assignee === user.name) return;
  const ok = await askConfirm({
    title: 'Взять задачу на себя?',
    text: t.assignee
      ? `Задача TASK-${t.num} «${t.text}» сейчас назначена на ${t.assignee}. После подтверждения исполнителем станете вы.`
      : `Задача TASK-${t.num} «${t.text}» будет назначена на вас.`,
    ok: 'Взять',
  });
  if (!ok) return;
  const cur = findTodo(id);
  if (!cur || !can.take || cur.assignee === user.name) return;
  cur.assignee = user.name;
  save(); renderMain(); if (selectedId === id) renderDetails();
}
async function removeTodo(id) {
  if (!can.remove) return;
  const t = findTodo(id);
  if (!t) return;
  const ok = await askConfirm({
    title: 'Удалить задачу?',
    text: `Задача TASK-${t.num} «${t.text}» будет удалена безвозвратно вместе с описанием и файлами. Отменить это действие нельзя.`,
    ok: 'Удалить', danger: true,
  });
  if (!ok) return;
  state.todos = state.todos.filter(x => x.id !== id);
  save();
  if (selectedId === id) closeDetails(true); else renderMain();
}

// ---------- Окно подтверждения в стиле доски ----------
// Пока окно подтверждения открыто (и ещё мгновение после закрытия), клики и Esc не закрывают карточку задачи
let confirmLock = 0;
function askConfirm({ title, text, ok = 'Да', cancel = 'Отмена', danger = false }) {
  confirmLock++;
  return new Promise(resolve => {
    const dlg = el('dialog', 'dialog confirm-dialog');
    const okBtn = el('button', danger ? 'confirm-ok danger-fill' : 'confirm-ok', ok);
    const cancelBtn = el('button', 'confirm-cancel', cancel);
    okBtn.type = cancelBtn.type = 'button';
    const actions = el('div', 'confirm-actions');
    actions.append(cancelBtn, okBtn);
    dlg.append(el('h3', '', title), el('p', '', text), actions);
    let finished = false;
    const finish = result => {
      if (finished) return;
      finished = true;
      if (dlg.open) dlg.close();
      setTimeout(() => { dlg.remove(); confirmLock--; resolve(result); }, 0);
    };
    okBtn.addEventListener('click', e => { e.stopPropagation(); finish(true); });
    cancelBtn.addEventListener('click', e => { e.stopPropagation(); finish(false); });
    dlg.addEventListener('click', e => { e.stopPropagation(); if (e.target === dlg) finish(false); });
    dlg.addEventListener('keydown', e => e.stopPropagation());
    dlg.addEventListener('cancel', e => { e.preventDefault(); finish(false); }); // Esc
    dlg.addEventListener('close', () => finish(false));
    document.body.appendChild(dlg);
    dlg.showModal();
    (danger ? cancelBtn : okBtn).focus();
  });
}

// ---------- Адреса: /board, /list, /task/{номер} ----------
// Задача открывается поверх текущего вида; при закрытии адрес возвращается на /board или /list.
const viewPath = () => (settings.view === 'list' ? '/list' : '/board');
const taskPath = t => `/task/${t.num}`;
// BASE — папка сайта без «/» в конце: '' локально, '/имя-репозитория' на GitHub Pages (см. <base> в index.html)
const BASE = (document.querySelector('base')?.getAttribute('href') || '/').replace(/\/+$/, '');
function setUrl(path, replace) {
  const full = BASE + path;
  if (location.protocol === 'file:' || location.pathname === full) return;
  history[replace ? 'replaceState' : 'pushState']({ view: settings.view }, '', full);
}
function updateTitle() {
  const t = selectedId && findTodo(selectedId);
  if (page === 'employees') { document.title = 'Сотрудники · Тестовое задание для Елены'; return; }
  if (page === 'help') { document.title = 'Справка · Тестовое задание для Елены'; return; }
  document.title = t ? `TASK-${t.num} · Тестовое задание для Елены` : (settings.view === 'list' ? 'Список · Тестовое задание для Елены' : 'Доска · Тестовое задание для Елены');
}
function goTo(newPage) {
  page = newPage; selectedId = null;
  setUrl(page === 'employees' ? '/employees' : page === 'help' ? '/help' : viewPath());
  updateTitle(); render();
}
function openDetails(id) {
  page = 'tasks';
  selectedId = id;
  const t = findTodo(id);
  if (t) setUrl(taskPath(t));
  updateTitle(); render();
}
// replace = true — заменить адрес задачи (например, после удаления), чтобы «назад» не вёл на удалённую задачу
function closeDetails(replace) { selectedId = null; setUrl(viewPath(), replace === true); updateTitle(); render(); }
function setView(view) {
  settings.view = view; saveSettings();
  if (selectedId) { const t = findTodo(selectedId); if (t) setUrl(taskPath(t), true); } // вид под открытой задачей
  else setUrl(viewPath());
  updateTitle(); render();
}
// Разбирает текущий адрес: прямая ссылка или кнопки «назад/вперёд» в браузере
let page = 'tasks'; // 'tasks' — доска/список, 'employees' — сотрудники, 'help' — справка
function applyRoute() {
  if (!user) return; // без входа не показываем «задача не найдена» на экране входа; после входа страница перезагрузится и маршрут применится
  let path = location.pathname;
  if (BASE && path.startsWith(BASE)) path = path.slice(BASE.length);
  path = path.replace(/\/+$/, '').replace(/^\/index\.html$/, '') || '/';
  const m = path.match(/^\/task\/(\d+)$/);
  page = path === '/employees' ? 'employees' : path === '/help' ? 'help' : 'tasks';
  if (page === 'employees' || page === 'help') {
    selectedId = null;
  } else if (path === '/board' || path === '/list') {
    settings.view = path === '/list' ? 'list' : 'kanban'; saveSettings(); selectedId = null;
  } else if (m) {
    const t = state.todos.find(x => x.num === Number(m[1]));
    if (history.state && history.state.view) settings.view = history.state.view;
    if (t) selectedId = t.id;
    else { selectedId = null; alert(`Задача TASK-${m[1]} не найдена`); setUrl(viewPath(), true); }
  } else {
    selectedId = null;
    if (location.protocol !== 'file:') setUrl(viewPath(), true); // «/» и неизвестные адреса ведут на сохранённый вид
  }
  updateTitle();
}
window.addEventListener('popstate', () => { applyRoute(); render(); });
document.querySelectorAll('.topnav a').forEach(a => a.addEventListener('click', e => {
  if (location.protocol === 'file:') return;
  e.preventDefault(); goTo(a.dataset.page);
}));
// Кнопка «?» ведёт на страницу справки /help
$('help-btn').addEventListener('click', e => {
  if (location.protocol === 'file:' || e.metaKey || e.ctrlKey || e.shiftKey) return; // новая вкладка — как обычная ссылка
  e.preventDefault(); goTo('help');
});

// ---------- Отрисовка ----------
function render() { renderNav(); renderToolbar(); renderMain(); renderDetails(); }
function renderNav() {
  document.querySelectorAll('.topnav a').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  $('help-btn').classList.toggle('active', page === 'help');
  $('page-title').textContent = page === 'employees' ? 'Сотрудники' : page === 'help' ? 'Справка' : 'Задачи';
  document.querySelector('.toolbar').hidden = page !== 'tasks';
  $('add-btn').hidden = !can.create || page !== 'tasks';
}

function renderToolbar() {
  document.querySelectorAll('.view-switch button').forEach(b => b.classList.toggle('active', b.dataset.view === settings.view));
}

function visibleTodos() {
  const q = search.value.trim().toLowerCase();
  const who = settings.assignees;
  return state.todos.filter(t => (!who.length || who.includes(t.assignee)) && (!q || t.text.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || `task-${t.num}`.includes(q)));
}

function renderMain() {
  main.innerHTML = '';
  main.classList.remove('is-board');
  if (page === 'employees') { main.appendChild(renderEmployees()); return; }
  if (page === 'help') { main.appendChild(renderHelp()); return; }
  if (settings.view === 'list') { main.appendChild(renderList()); return; }
  const view = renderBoard();
  if (view.classList.contains('board-scroll')) main.classList.add('is-board');
  main.appendChild(view);
}

// ---------- Сотрудники ----------
// Смотреть могут все; создавать и удалять — только руководитель
function renderEmployees() {
  const wrap = el('div', 'employees');
  const accounts = window.Auth.accounts().slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const head = el('div', 'employees-head');
  head.append(el('span', 'employees-count', `Всего сотрудников: ${accounts.length}`));
  if (isCreator) {
    const addEmp = el('button', 'primary', '+ Добавить сотрудника');
    addEmp.type = 'button';
    addEmp.addEventListener('click', openEmpDialog);
    head.append(addEmp);
  } else {
    head.append(el('span', 'readonly-note', 'Только просмотр: добавлять, редактировать и удалять сотрудников может руководитель.'));
  }
  wrap.append(head);

  const table = el('table', 'emp-table');
  const cols = ['Имя', 'Фамилия', 'Должность', 'Логин', 'Тип аккаунта', 'Задач'];
  if (isCreator) cols.push('');
  const thead = el('thead'); const hr = el('tr');
  cols.forEach(c => hr.append(el('th', '', c)));
  thead.append(hr);
  const tbody = el('tbody');
  accounts.forEach(a => {
    const tasks = state.todos.filter(t => t.assignee === a.name);
    const active = tasks.filter(t => t.status !== 'done').length;
    const tr = el('tr');
    const first = el('td');
    const nameBox = el('div', 'emp-name');
    nameBox.append(el('span', 'avatar', initials(a.name)), el('span', '', a.firstName));
    if (user && a.login === user.login) nameBox.append(el('span', 'mine', 'это вы'));
    first.append(nameBox);
    const count = el('td', 'emp-tasks');
    if (tasks.length) {
      const link = el('button', 'emp-tasks-link');
      link.type = 'button';
      link.append(el('b', '', String(tasks.length)));
      link.append(el('span', 'emp-sub', ` (не выполнено: ${active})`));
      link.setAttribute('aria-label', `Показать задачи сотрудника ${a.name} в списке`);
      link.title = 'Показать задачи в списке';
      link.addEventListener('click', () => showEmployeeTasks(a.name));
      count.append(link);
    } else {
      count.append(el('b', '', '0'));
    }
    tr.append(first, el('td', '', a.lastName), el('td', '', a.position || '—'), el('td', 'emp-login', a.login),
      el('td', '', '')); 
    tr.lastChild.append(el('span', 'role ' + a.role, window.Auth.ROLE_TITLE[a.role] || a.role));
    tr.append(count);
    if (isCreator) {
      const td = el('td', 'emp-actions');
      const edit = el('button', 'secondary emp-edit', 'Редактировать');
      edit.type = 'button';
      edit.addEventListener('click', () => openEmpDialog(a));
      td.append(edit);
      if (a.login !== user.login) {
        const del = el('button', 'danger', 'Удалить');
        del.type = 'button';
        del.addEventListener('click', () => removeEmployee(a, tasks.length));
        td.append(del);
      }
      tr.append(td);
    }
    tbody.append(tr);
  });
  table.append(thead, tbody);
  const scroll = el('div', 'emp-scroll');
  scroll.append(table);
  wrap.append(scroll);
  return wrap;
}
function showEmployeeTasks(name) {
  settings.view = 'list';
  settings.filter = 'all';
  settings.assignees = [name];
  saveSettings();
  page = 'tasks';
  selectedId = null;
  setUrl('/list'); // pushState, чтобы «назад» вернул на /employees
  updateTitle();
  renderFilterButton();
  render();
}
async function removeEmployee(a, taskCount) {
  const ok = await askConfirm({
    title: 'Удалить сотрудника?',
    text: `Аккаунт ${a.name} (${a.login}) будет удалён безвозвратно, войти под ним больше не получится.` +
      (taskCount ? ` Его задачи (${taskCount}) останутся на доске, исполнитель в них будет отмечен как «без аккаунта».` : ''),
    ok: 'Удалить', danger: true,
  });
  if (ok && window.Auth.removeAccount(a.login)) { fillAssignees(); renderMain(); }
}
const empDialog = $('emp-dialog');
let editingLogin = null; // логин сотрудника, которого редактируем; null — создаём нового
function openEmpDialog(a) {
  if (!isCreator) return;
  const editing = a && a.login ? a : null;
  editingLogin = editing ? editing.login : null;
  $('emp-form').reset(); $('emp-error').textContent = '';
  $('emp-title').textContent = editing ? 'Редактировать сотрудника' : 'Новый сотрудник';
  $('emp-submit').textContent = editing ? 'Сохранить' : 'Создать';
  $('emp-password-label').textContent = editing ? 'Новый пароль' : 'Пароль *';
  $('emp-password').placeholder = editing ? 'Пусто — не менять' : '';
  if (editing) {
    $('emp-first').value = editing.firstName; $('emp-last').value = editing.lastName;
    $('emp-position').value = editing.position || ''; $('emp-login').value = editing.login;
    $('emp-role').value = editing.role;
  }
  // Свой тип аккаунта поменять нельзя — иначе можно случайно лишиться прав
  const self = editing && editing.login === user.login;
  $('emp-role').disabled = !!self;
  $('emp-role').title = self ? 'Свой тип аккаунта поменять нельзя' : '';
  empDialog.showModal(); $('emp-first').focus();
}
$('emp-cancel').addEventListener('click', () => empDialog.close());
$('emp-form').addEventListener('submit', async e => {
  e.preventDefault();
  const data = {
    firstName: $('emp-first').value, lastName: $('emp-last').value, position: $('emp-position').value,
    login: $('emp-login').value, password: $('emp-password').value, role: $('emp-role').value,
  };
  if (editingLogin) {
    const res = await window.Auth.updateAccount(editingLogin, data);
    if (res.error) { $('emp-error').textContent = res.error; return; }
    // Задачи и фильтр по исполнителю переносим на новое имя
    if (res.oldName !== res.name) {
      state.todos.forEach(t => { if (t.assignee === res.oldName) t.assignee = res.name; });
      settings.assignees = settings.assignees.map(n => n === res.oldName ? res.name : n);
      save(); saveSettings();
    }
    empDialog.close();
    if (editingLogin === user.login) { location.reload(); return; } // обновить имя в шапке
    fillAssignees(); renderFilters(); renderMain();
    return;
  }
  const err = await window.Auth.createAccount(data);
  if (err) { $('emp-error').textContent = err; return; }
  empDialog.close(); fillAssignees(); renderMain();
});

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function doneCheckbox(t) {
  const cb = el('input');
  cb.type = 'checkbox';
  cb.checked = t.status === 'done';
  cb.title = 'Выполнено';
  cb.addEventListener('click', e => e.stopPropagation());
  cb.addEventListener('change', () => setStatus(t.id, cb.checked ? 'done' : 'active'));
  return cb;
}

function hasSearchOrAssigneeFilter() {
  return !!search.value.trim() || settings.assignees.length > 0;
}

function renderBoardEmpty(kind) {
  // kind: 'none' — задач нет вообще; 'filtered' — поиск или фильтр ничего не нашёл
  const wrap = el('div', 'board-empty');
  if (kind === 'filtered') {
    wrap.append(el('p', 'empty-title', 'Ничего не найдено'));
    return wrap;
  }
  wrap.append(el('p', 'empty-title', 'Задач пока нет'));
  if (isCreator) {
    const b = el('button', 'primary', '+ Добавить задачу');
    b.type = 'button';
    b.addEventListener('click', () => $('add-btn').click());
    wrap.append(b);
  } else {
    wrap.append(el('p', 'empty-sub', 'Их добавит руководитель'));
  }
  return wrap;
}

async function dropTaskOnColumn(id, colId) {
  const t = findTodo(id);
  if (!t || t.status === colId) return;
  if (!isCreator) {
    const ok = await askConfirm({
      title: 'Переместить задачу?',
      text: 'Вы уверены, что задачу нужно переместить по статусам?',
      ok: 'Переместить',
    });
    if (!ok) return;
  }
  setStatus(id, colId);
}

// Автопрокрутка доски у левого/правого края во время перетаскивания (мышь и касание)
const boardDrag = { el: null, vx: 0, raf: 0, touch: null };
function stopBoardDragScroll() {
  boardDrag.vx = 0;
  if (boardDrag.raf) { cancelAnimationFrame(boardDrag.raf); boardDrag.raf = 0; }
}
function endBoardDrag() {
  boardDrag.el = null;
  stopBoardDragScroll();
  document.querySelectorAll('.column.drag-over').forEach(c => c.classList.remove('drag-over'));
}
function tickBoardDragScroll() {
  boardDrag.raf = 0;
  if (!boardDrag.el || !boardDrag.vx) return;
  boardDrag.el.scrollLeft += boardDrag.vx;
  boardDrag.raf = requestAnimationFrame(tickBoardDragScroll);
}
function updateBoardDragScroll(clientX) {
  const box = boardDrag.el;
  if (!box) { stopBoardDragScroll(); return; }
  const r = box.getBoundingClientRect();
  const edge = 56;
  let vx = 0;
  if (clientX < r.left + edge) {
    const t = Math.min(1, Math.max(0, (r.left + edge - clientX) / edge));
    vx = -Math.max(3, t * 20);
  } else if (clientX > r.right - edge) {
    const t = Math.min(1, Math.max(0, (clientX - (r.right - edge)) / edge));
    vx = Math.max(3, t * 20);
  }
  boardDrag.vx = vx;
  if (vx && !boardDrag.raf) boardDrag.raf = requestAnimationFrame(tickBoardDragScroll);
  if (!vx) stopBoardDragScroll();
}
if (!window.__boardDragBound) {
  window.__boardDragBound = true;
  document.addEventListener('dragover', e => { if (boardDrag.el) updateBoardDragScroll(e.clientX); });
  document.addEventListener('dragend', endBoardDrag);
  document.addEventListener('drop', endBoardDrag);
  document.addEventListener('touchmove', e => {
    const td = boardDrag.touch;
    if (!td || !td.dragging) return;
    const p = e.touches[0];
    if (!p) return;
    e.preventDefault();
    td.ghost.style.left = (p.clientX - td.ox) + 'px';
    td.ghost.style.top = (p.clientY - td.oy) + 'px';
    updateBoardDragScroll(p.clientX);
    const hit = document.elementFromPoint(p.clientX, p.clientY)?.closest('.column');
    document.querySelectorAll('.column.drag-over').forEach(c => { if (c !== hit) c.classList.remove('drag-over'); });
    if (hit) hit.classList.add('drag-over');
  }, { passive: false });
  document.addEventListener('touchend', e => {
    const td = boardDrag.touch;
    if (!td) return;
    const p = e.changedTouches[0];
    const hit = p && document.elementFromPoint(p.clientX, p.clientY)?.closest('.column');
    const id = td.id, colId = hit?.dataset.col;
    td.ghost.remove();
    td.card.classList.remove('dragging');
    td.card.__suppressClick = true;
    boardDrag.touch = null;
    endBoardDrag();
    if (id && colId) dropTaskOnColumn(id, colId);
  });
  document.addEventListener('touchcancel', () => {
    const td = boardDrag.touch;
    if (!td) return;
    td.ghost.remove();
    td.card.classList.remove('dragging');
    boardDrag.touch = null;
    endBoardDrag();
  });
}

function bindCardTouchDrag(card, t) {
  card.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    const p = e.touches[0];
    const start = { x: p.clientX, y: p.clientY };
    const onMove = ev => {
      const q = ev.touches[0];
      if (!q || boardDrag.touch) return;
      const dx = q.clientX - start.x, dy = q.clientY - start.y;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.3) { document.removeEventListener('touchmove', onMove); return; }
      const r = card.getBoundingClientRect();
      const ghost = card.cloneNode(true);
      ghost.classList.add('card-ghost');
      ghost.style.width = r.width + 'px';
      ghost.style.left = r.left + 'px';
      ghost.style.top = r.top + 'px';
      document.body.append(ghost);
      card.classList.add('dragging');
      boardDrag.el = card.closest('.board-scroll');
      boardDrag.touch = { card, ghost, id: t.id, ox: q.clientX - r.left, oy: q.clientY - r.top, dragging: true };
      document.removeEventListener('touchmove', onMove);
    };
    document.addEventListener('touchmove', onMove, { passive: true });
    const stopPrep = () => document.removeEventListener('touchmove', onMove);
    document.addEventListener('touchend', stopPrep, { once: true });
    document.addEventListener('touchcancel', stopPrep, { once: true });
  }, { passive: true });
}

function renderBoard() {
  const todos = visibleTodos();
  if (!state.todos.length) return renderBoardEmpty('none');
  if (!todos.length && hasSearchOrAssigneeFilter()) return renderBoardEmpty('filtered');

  const scroll = el('div', 'board-scroll');
  const board = el('div', 'board');
  COLUMNS.forEach(col => {
    const items = todos.filter(t => t.status === col.id);
    const column = el('section', 'column');
    column.dataset.col = col.id;
    const title = el('div', 'column-title', col.title);
    title.appendChild(el('span', 'count', items.length));
    const cards = el('div', 'cards');
    if (!items.length) cards.appendChild(el('div', 'empty', 'Перетащите задачу сюда'));

    items.forEach(t => {
      const card = el('article', 'card' + (t.status === 'done' ? ' is-done' : '') + (t.id === selectedId ? ' selected' : ''));
      card.dataset.taskId = t.id;
      card.draggable = true;
      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
        boardDrag.el = card.closest('.board-scroll');
      });
      card.addEventListener('dragend', () => { card.classList.remove('dragging'); endBoardDrag(); });
      card.addEventListener('click', e => { if (card.__suppressClick) { card.__suppressClick = false; e.preventDefault(); return; } openDetails(t.id); });
      bindCardTouchDrag(card, t);

      const foot = el('div', 'card-foot');
      if (can.take && t.assignee !== user.name) foot.append(takeButton(t));

      const meta = el('div', 'card-meta');
      meta.append(...metaBits(t));
      card.append(el('div', 'key', `TASK-${t.num}`), el('div', 'card-text', t.text));
      if (meta.children.length) card.append(meta);
      if (foot.children.length) card.append(foot);
      cards.appendChild(card);
    });

    column.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; column.classList.add('drag-over'); });
    column.addEventListener('dragleave', e => { if (!column.contains(e.relatedTarget)) column.classList.remove('drag-over'); });
    column.addEventListener('drop', async e => {
      e.preventDefault();
      column.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      await dropTaskOnColumn(id, col.id);
    });

    column.append(title, cards);
    board.appendChild(column);
  });
  scroll.appendChild(board);
  return scroll;
}

function takeButton(t) {
  const b = el('button', 'take-btn', 'Взять на себя');
  b.type = 'button';
  b.title = t.assignee ? `Сейчас: ${t.assignee}` : 'Назначить себя исполнителем';
  b.addEventListener('click', e => { e.stopPropagation(); takeTodo(t.id); });
  return b;
}

function renderList() {
  const wrap = el('div');
  const filters = el('div', 'filters');
  const visible = visibleTodos();
  [{ id: 'all', title: 'Все' }, ...COLUMNS].forEach(f => {
    const b = el('button', 'filter' + (settings.filter === f.id ? ' active' : ''));
    b.type = 'button';
    const n = f.id === 'all' ? visible.length : visible.filter(t => t.status === f.id).length;
    b.textContent = `${f.title} (${n})`;
    b.addEventListener('click', () => { settings.filter = f.id; saveSettings(); renderMain(); });
    filters.appendChild(b);
  });

  const list = el('div', 'list');
  const items = visible.filter(t => settings.filter === 'all' || t.status === settings.filter);
  if (!items.length) {
    let msg;
    if (!state.todos.length) {
      msg = isCreator ? 'Задач пока нет — добавьте первую!' : 'Задач пока нет. Их добавит руководитель';
    } else if (hasSearchOrAssigneeFilter()) {
      msg = 'Ничего не найдено';
    } else {
      msg = 'Здесь задач нет'; // пустой фильтр по статусу, без поиска
    }
    list.appendChild(el('div', 'empty', msg));
  }
  items.forEach(t => {
    const row = el('div', 'row' + (t.status === 'done' ? ' is-done' : '') + (t.id === selectedId ? ' selected' : ''));
    row.dataset.taskId = t.id;
    row.addEventListener('click', () => openDetails(t.id));
    const del = el('button', 'icon-btn', '×');
    del.type = 'button';
    del.title = 'Удалить';
    del.addEventListener('click', e => { e.stopPropagation(); removeTodo(t.id); });
    const meta = el('span', 'meta'); meta.append(...metaBits(t));
    row.append(doneCheckbox(t), el('span', 'key', `TASK-${t.num}`), el('span', 'text', t.text), meta);
    if (can.take && t.assignee !== user.name) row.append(takeButton(t));
    row.append(el('span', `status status-${t.status}`, STATUS_TITLE[t.status]));
    if (can.remove) row.append(del);
    list.appendChild(row);
  });

  wrap.append(filters, list);
  return wrap;
}

function renderDetails() {
  const t = selectedId && findTodo(selectedId);
  if (!t) { selectedId = null; details.hidden = true; layout.classList.remove('split'); details.innerHTML = ''; return; }
  details.hidden = false;
  layout.classList.add('split');
  details.innerHTML = '';

  const head = el('div', 'details-head');
  const close = el('button', 'icon-btn close', '×');
  close.type = 'button';
  close.title = 'Закрыть';
  close.addEventListener('click', closeDetails);
  head.append(el('span', 'key', `TASK-${t.num}`), close);

  const title = el('input', 'title-input');
  title.value = t.text;
  title.maxLength = 200;
  title.readOnly = !can.edit;
  title.addEventListener('input', () => { if (!can.edit) return; const v = title.value.trim(); if (v) { t.text = v; save(); renderMain(); } });
  title.addEventListener('blur', () => { title.value = t.text; });

  const row = el('div', 'details-row');
  // Статус только показывается; менять его можно перетаскиванием или кнопкой «Выполнено»
  const statusLabel = el('span', `status status-${t.status} status-view`, STATUS_TITLE[t.status]);
  statusLabel.title = 'Текущий статус';
  const del = el('button', 'danger', 'Удалить задачу');
  del.type = 'button';
  del.addEventListener('click', () => removeTodo(t.id));
  row.append(statusLabel);
  if (can.remove) row.append(del);

  const label = el('label', 'field-label', 'Описание');
  const desc = el('textarea', 'desc');
  desc.placeholder = 'Добавьте описание задачи…';
  desc.value = t.description;
  desc.readOnly = !can.edit;
  if (!can.edit) desc.placeholder = 'Описания нет';
  const saved = el('div', 'saved');
  let timer;
  desc.addEventListener('input', () => {
    if (!can.edit) return;
    t.description = desc.value;
    save();
    saved.textContent = 'Сохранено';
    clearTimeout(timer);
    timer = setTimeout(() => { saved.textContent = ''; renderMain(); }, 800);
  });

  const metaGrid = el('div', 'meta-grid');
  const dateError = el('p', 'form-error date-error');
  const dateInputs = {};
  const field = (labelText, key, type) => {
    const l = el('label', '', labelText);
    const i = el('input');
    i.type = type; i.value = t[key];
    if (!can.edit) i.disabled = true;
    i.addEventListener('change', () => {
      if (!can.edit) return;
      const start = (key === 'start' ? i.value : dateInputs.start.value).trim();
      const end = (key === 'end' ? i.value : dateInputs.end.value).trim();
      if (start && end && end < start) {
        dateInputs.start.value = t.start;
        dateInputs.end.value = t.end;
        dateError.textContent = 'Дата окончания не может быть раньше даты начала';
        return;
      }
      dateError.textContent = '';
      t[key] = i.value.trim();
      save(); renderMain();
    });
    dateInputs[key] = i;
    l.appendChild(i);
    return l;
  };
  const assigneeField = el('label', '', 'Исполнитель');
  const assigneeSelect = el('select', 'assignee-select');
  fillAssigneeSelect(assigneeSelect, t.assignee);
  assigneeSelect.disabled = !can.edit;
  assigneeSelect.addEventListener('change', () => {
    if (!can.edit) return;
    t.assignee = assigneeSelect.value;
    save(); renderMain(); renderFilters(); renderDetails();
  });
  assigneeField.appendChild(assigneeSelect);
  if (can.take && t.assignee !== user.name) assigneeField.append(takeButton(t));
  metaGrid.append(assigneeField, field('Дата начала', 'start', 'date'), field('Дата окончания', 'end', 'date'), dateError);

  const filesLabel = el('span', 'field-label', `Файлы (${t.files.length})`);
  const zone = el('label', 'dropzone');
  const picker = el('input'); picker.type = 'file'; picker.multiple = true; picker.hidden = true;
  zone.append(picker, document.createTextNode('Перетащите файлы сюда или '), el('u', '', 'выберите'));
  const attach = files => readFiles(files).then(added => {
    if (!added.length) return;
    t.files.push(...added);
    if (!save()) t.files.splice(-added.length);
    renderMain(); renderDetails();
  });
  picker.addEventListener('change', () => attach(picker.files));
  setupDrop(zone, attach);
  // Прикреплять и удалять любые файлы могут все пользователи
  const list = fileList(t.files, fid => { t.files = t.files.filter(f => f.id !== fid); save(); renderMain(); renderDetails(); });

  details.append(head);
  if (!can.edit) details.append(el('p', 'readonly-note', 'Вы исполнитель: можно взять задачу на себя, менять статус, прикреплять и удалять файлы. Остальные поля только для чтения.'));
  details.append(title, row, metaGrid, label, desc, saved, filesLabel);
  details.append(zone); // прикреплять файлы могут все
  details.append(list);

  // Кнопки внизу карточки: «Выполнено» и «Вернуть»
  const actions = el('div', 'details-actions');
  const doneBtn = el('button', 'btn-done', t.status === 'done' ? '✓ Уже выполнено' : 'Выполнено');
  doneBtn.type = 'button';
  doneBtn.disabled = t.status === 'done';
  doneBtn.addEventListener('click', async () => {
    if (await askConfirm({ title: 'Отметить как выполненную?', text: `Задача TASK-${t.num} переместится в колонку «Выполнено».`, ok: 'Выполнено' })) setStatus(t.id, 'done');
  });
  const backBtn = el('button', 'btn-back', 'Вернуть');
  backBtn.type = 'button';
  backBtn.title = 'Закрыть карточку и вернуться к задачам';
  backBtn.addEventListener('click', async () => {
    if (await askConfirm({ title: 'Вернуть задачу в список', text: 'Задача снимется с вас, чтобы её мог взять любой другой из сотрудников', ok: 'Вернуть' })) {
      t.assignee = ''; // снимаем исполнителя, чтобы задачу мог взять другой сотрудник
      save(); fillAssignees();
      closeDetails();
    }
  });
  actions.append(doneBtn, backBtn);
  details.append(actions);
}

// ---------- События ----------
document.querySelectorAll('.view-switch button').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.view !== settings.view) setView(b.dataset.view);
}));
search.addEventListener('input', renderMain);

// Заполняет выпадающий список исполнителей всеми зарегистрированными аккаунтами
function fillAssigneeSelect(select, current) {
  select.innerHTML = '';
  const none = el('option', '', 'Не назначен'); none.value = ''; select.appendChild(none);
  const accounts = (window.Auth?.accounts() || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  accounts.forEach(a => {
    const o = el('option', '', `${a.name} (${a.login})`);
    o.value = a.name;
    select.appendChild(o);
  });
  // Исполнитель из старых или тестовых задач, у которого нет аккаунта, остаётся в списке, чтобы не потеряться
  if (current && !accounts.some(a => a.name === current)) {
    const o = el('option', '', `${current} (без аккаунта)`); o.value = current; select.appendChild(o);
  }
  select.value = current || '';
}
function fillAssignees() { fillAssigneeSelect($('add-assignee'), ''); }
function renderDraftFiles() {
  const old = $('add-file-list');
  const ul = fileList(draftFiles, fid => { draftFiles = draftFiles.filter(f => f.id !== fid); renderDraftFiles(); });
  ul.id = 'add-file-list';
  old.replaceWith(ul);
}
const addDraft = files => readFiles(files).then(added => { draftFiles.push(...added); renderDraftFiles(); });

$('add-btn').addEventListener('click', () => {
  addForm.reset(); draftFiles = []; renderDraftFiles(); $('add-error').textContent = '';
  fillAssignees(); dialog.showModal(); addTitle.focus();
});
$('add-cancel').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); }); // клик по затемнению
$('add-files').addEventListener('change', e => { addDraft(e.target.files); e.target.value = ''; });
setupDrop($('add-drop'), addDraft);
addForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!can.create) return;
  const text = addTitle.value.trim();
  const start = $('add-start').value, end = $('add-end').value;
  const err = $('add-error');
  if (!text) { err.textContent = 'Введите название задачи'; addTitle.focus(); return; }
  if (start && end && end < start) { err.textContent = 'Дата окончания не может быть раньше даты начала'; return; }
  const ok = addTodo({ text, description: addDesc.value.trim(), start, end, assignee: $('add-assignee').value, files: draftFiles });
  if (ok) dialog.close();
});

// ---------- Фильтр по исполнителю ('' = без исполнителя) ----------
const filtersBtn = $('filters-btn'), filtersPanel = $('filters-panel');
function renderFilters() {
  const counts = {};
  state.todos.forEach(t => { counts[t.assignee] = (counts[t.assignee] || 0) + 1; });
  const names = Object.keys(counts).sort((a, b) => (a === '') - (b === '') || a.localeCompare(b, 'ru'));
  settings.assignees = settings.assignees.filter(n => n in counts);
  const box = $('assignee-options');
  box.innerHTML = '';
  if (!names.length) box.appendChild(el('div', 'empty', 'Задач пока нет'));
  names.forEach(n => {
    const l = el('label');
    const cb = el('input'); cb.type = 'checkbox'; cb.checked = settings.assignees.includes(n);
    cb.addEventListener('change', () => {
      settings.assignees = cb.checked ? [...settings.assignees, n] : settings.assignees.filter(x => x !== n);
      saveSettings(); renderFilterButton(); renderMain();
    });
    l.append(cb, el('span', n ? '' : 'none', n || 'Без исполнителя'), el('span', 'n', counts[n]));
    box.appendChild(l);
  });
  renderFilterButton();
}
function renderFilterButton() {
  const n = settings.assignees.length;
  $('filters-count').hidden = !n;
  $('filters-count').textContent = n;
  filtersBtn.classList.toggle('on', n > 0);
}
filtersBtn.addEventListener('click', () => {
  const open = filtersPanel.hidden;
  if (open) renderFilters();
  filtersPanel.hidden = !open;
  filtersBtn.setAttribute('aria-expanded', open);
});
$('filters-reset').addEventListener('click', () => { settings.assignees = []; saveSettings(); renderFilters(); renderMain(); });
document.addEventListener('click', e => {
  if (!filtersPanel.hidden && !e.target.closest('.filter-wrap')) { filtersPanel.hidden = true; filtersBtn.setAttribute('aria-expanded', false); }
});

// Клик вне панели закрывает её (клик по другой задаче просто переключает панель)
document.addEventListener('click', e => {
  if (!selectedId || confirmLock || document.querySelector('dialog[open]') || !document.contains(e.target)) return; // элемент уже перерисован
  if (e.target.closest('dialog, .details, [data-task-id], .toolbar, .topbar, .filters')) return;
  closeDetails();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && selectedId && !confirmLock && !document.querySelector('dialog[open]')) closeDetails(); });

// ---------- Пользователь в шапке ----------
function renderUserBox() {
  const box = $('user-box');
  box.innerHTML = '';
  if (!user) return;
  const out = el('button', 'logout-btn');
  out.type = 'button';
  out.setAttribute('aria-label', 'Выйти');
  out.title = 'Выйти';
  out.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
  out.addEventListener('click', async () => {
    const ok = await askConfirm({
      title: 'Выйти из аккаунта?',
      text: 'Задачи сохранятся в браузере.',
      ok: 'Выйти',
    });
    if (ok) window.Auth.logout();
  });
  const meta = el('span', 'user-meta');
  meta.append(el('span', 'user-name', user.name), el('span', 'user-role', window.Auth.ROLE_TITLE[user.role]));
  box.append(meta, out);
}
$('add-btn').hidden = !can.create;

// ---------- Инструкция (README.md) ----------
function escapeHtml(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function inlineMd(t) {
  return escapeHtml(t)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img class="help-img" alt="$1" src="$2">')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s)<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
}
// Небольшой разборщик Markdown: заголовки, списки, таблицы, блоки кода, картинки, жирный текст и код в строке
function renderMarkdown(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  let html = '', i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      const code = []; i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++].replace(/^ {3}/, ''));
      i++; html += `<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`; continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) { html += `<h${h[1].length}>${inlineMd(h[2])}</h${h[1].length}>`; i++; continue; }
    if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => inlineMd(c.trim()));
      html += '<table><thead><tr>' + cells(rows[0]).map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
        rows.slice(2).map(r => '<tr>' + cells(r).map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      let items = [];
      while (i < lines.length && (/^\s*([-*]|\d+\.)\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && !/^\s*```/.test(lines[i])))) {
        const l = lines[i++];
        if (/^\s*([-*]|\d+\.)\s+/.test(l) && !(/^\s{3,}/.test(l) && items.length)) items.push(l.replace(/^\s*([-*]|\d+\.)\s+/, ''));
        else if (items.length) items[items.length - 1] += '<br>' + l.trim().replace(/^([-*])\s+/, '• ');
        if (i < lines.length && /^\s*```/.test(lines[i]) && items.length) {
          const code = []; i++;
          while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++].trim());
          i++; items[items.length - 1] += `<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`;
        }
      }
      const tag = ordered ? 'ol' : 'ul';
      html += `<${tag}>` + items.map(it => `<li>${it.includes('<pre>') ? it : inlineMd(it).replace(/&lt;br&gt;/g, '<br>')}</li>`).join('') + `</${tag}>`;
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||\s*```|\s*([-*]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
    html += `<p>${inlineMd(para.join(' '))}</p>`;
  }
  return html;
}
// ---------- Страница справки /help ----------
let helpHtml = null; // README, переведённый в HTML; загружается один раз
function renderHelp() {
  const wrap = el('div', 'help-page');
  const body = el('article', 'help-body');
  body.innerHTML = helpHtml || '<p>Загрузка…</p>';
  wrap.append(body);
  if (!helpHtml) loadHelp();
  return wrap;
}
async function loadHelp() {
  try {
    const res = await fetch('README.md', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    helpHtml = renderMarkdown(await res.text());
  } catch {
    helpHtml = '<p>Не удалось загрузить README.md. Откройте доску через локальный сервер: <code>python3 server.py</code>, затем <code>http://localhost:8000/help</code>.</p>';
  }
  if (page === 'help') renderMain();
}

renderUserBox();
renderFilterButton();
applyRoute();
render();
