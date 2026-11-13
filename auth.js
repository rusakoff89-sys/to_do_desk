// Аккаунты и вход. Всё хранится локально в браузере (localStorage).
// Роли: creator — руководитель (всё можно), executor — исполнитель
// (берёт задачи на себя и двигает их по статусам, но не удаляет и не редактирует).
// Важно: это локальная демо-авторизация в браузере, а не защита на сервере.
(function () {
  const ACCOUNTS_KEY = 'todo-accounts';
  const SESSION_KEY = 'todo-session';
  const ROLE_TITLE = { creator: 'Руководитель', executor: 'Исполнитель' };
  const DEFAULTS = [
    { login: 'admin', password: 'admin123', name: 'Наталья Петрова', role: 'creator', position: 'Руководитель проекта' },
    { login: 'alexey', password: '12345', name: 'Алексей Смирнов', role: 'executor', position: 'Frontend-разработчик' },
    { login: 'maria', password: '12345', name: 'Мария Иванова', role: 'executor', position: 'Тестировщик' },
  ];
  const DEFAULT_POSITION = Object.fromEntries(DEFAULTS.map(a => [a.login, a.position]));
  // Дополняет старые аккаунты полями «имя», «фамилия», «должность»
  function normalize(a) {
    const parts = (a.name || '').trim().split(/\s+/);
    const firstName = a.firstName ?? parts[0] ?? '';
    const lastName = a.lastName ?? parts.slice(1).join(' ');
    return { ...a, firstName, lastName, position: a.position ?? DEFAULT_POSITION[a.login] ?? '', name: `${firstName} ${lastName}`.trim() };
  }

  async function hash(text) {
    if (window.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('todo:' + text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 5381; for (const c of 'todo:' + text) h = (h * 33 + c.charCodeAt(0)) >>> 0; // запасной вариант
    return 'x' + h.toString(16);
  }
  function loadAccounts() {
    try { const a = JSON.parse(localStorage.getItem(ACCOUNTS_KEY)); return Array.isArray(a) ? a.map(normalize) : null; } catch { return null; }
  }
  async function accounts() {
    let list = loadAccounts();
    if (!list) {
      list = await Promise.all(DEFAULTS.map(async a => normalize({ login: a.login, name: a.name, role: a.role, position: a.position, hash: await hash(a.password) })));
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
    }
    return list;
  }

  const session = localStorage.getItem(SESSION_KEY);
  const user = session && (loadAccounts() || []).find(a => a.login === session) || null;

  const saveAccounts = list => localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
  const isCreator = () => user?.role === 'creator';

  window.Auth = {
    user: user && normalize(user),
    ROLE_TITLE,
    logout() { localStorage.removeItem(SESSION_KEY); location.reload(); },
    // Все аккаунты без хэшей паролей — для списка исполнителей и страницы сотрудников
    accounts() { return (loadAccounts() || []).map(({ hash, ...a }) => a); },
    // Создать сотрудника (только руководитель). Возвращает текст ошибки или null.
    async createAccount({ firstName, lastName, position, login, password, role }) {
      if (!isCreator()) return 'Создавать сотрудников может только руководитель';
      firstName = (firstName || '').trim(); lastName = (lastName || '').trim(); position = (position || '').trim(); login = (login || '').trim();
      if (!firstName || !lastName) return 'Заполните имя и фамилию';
      if (!login) return 'Заполните логин';
      if (!/^[A-Za-z0-9._-]+$/.test(login)) return 'Логин — латинские буквы, цифры, точка, дефис или подчёркивание';
      if ((password || '').length < 4) return 'Пароль — минимум 4 символа';
      if (!ROLE_TITLE[role]) return 'Выберите тип аккаунта';
      const list = await accounts();
      if (list.some(a => a.login === login)) return 'Такой логин уже занят';
      list.push(normalize({ login, firstName, lastName, position, role, hash: await hash(password) }));
      saveAccounts(list);
      return null;
    },
    // Изменить сотрудника (только руководитель). Пароль меняется, только если он введён.
    // Возвращает { error } или { oldName, name, login }.
    async updateAccount(oldLogin, { firstName, lastName, position, login, password, role }) {
      if (!isCreator()) return { error: 'Редактировать сотрудников может только руководитель' };
      firstName = (firstName || '').trim(); lastName = (lastName || '').trim(); position = (position || '').trim(); login = (login || '').trim();
      if (!firstName || !lastName) return { error: 'Заполните имя и фамилию' };
      if (!login) return { error: 'Заполните логин' };
      if (!/^[A-Za-z0-9._-]+$/.test(login)) return { error: 'Логин — латинские буквы, цифры, точка, дефис или подчёркивание' };
      if (password && password.length < 4) return { error: 'Новый пароль — минимум 4 символа' };
      if (!ROLE_TITLE[role]) return { error: 'Выберите тип аккаунта' };
      const list = await accounts();
      const i = list.findIndex(a => a.login === oldLogin);
      if (i < 0) return { error: 'Сотрудник не найден' };
      if (login !== oldLogin && list.some(a => a.login === login)) return { error: 'Такой логин уже занят' };
      if (oldLogin === user.login && role !== user.role) return { error: 'Свой тип аккаунта поменять нельзя' };
      const old = list[i];
      list[i] = normalize({ ...old, login, firstName, lastName, position, role, name: undefined, hash: password ? await hash(password) : old.hash });
      saveAccounts(list);
      if (oldLogin === user.login && login !== oldLogin) localStorage.setItem(SESSION_KEY, login); // остаёмся в системе под новым логином
      return { oldName: old.name, name: list[i].name, login };
    },
    // Удалить сотрудника (только руководитель, себя удалить нельзя)
    removeAccount(login) {
      if (!isCreator() || login === user.login) return false;
      const list = loadAccounts() || [];
      saveAccounts(list.filter(a => a.login !== login));
      return true;
    },
  };

  // ---------- Экран входа ----------
  function showLogin() {
    document.body.classList.add('logged-out');
    const wrap = document.createElement('div');
    wrap.className = 'auth';
    wrap.innerHTML = `
      <div class="auth-card">
        <div class="logo">✓ <span>Тестовое задание для Елены</span></div>
        <div class="auth-tabs">
          <button type="button" data-tab="login" class="active">Вход</button>
          <button type="button" data-tab="register">Регистрация</button>
        </div>
        <form id="login-form" class="auth-form">
          <label>Логин<input name="login" autocomplete="username" required></label>
          <label>Пароль<input name="password" type="password" autocomplete="current-password" required></label>
          <p class="form-error"></p>
          <button class="primary" type="submit">Войти</button>
          <div class="demo-accounts">
            <div class="demo-title">Тестовые аккаунты (нажмите, чтобы подставить):</div>
            ${DEFAULTS.map(a => `<button type="button" class="demo-acc" data-login="${a.login}" data-password="${a.password}">
              <b>${a.login}</b> / ${a.password} · ${a.name} · ${ROLE_TITLE[a.role]}</button>`).join('')}
          </div>
        </form>
        <form id="register-form" class="auth-form" hidden>
          <div class="auth-row">
            <label>Имя<input name="firstName" maxlength="50" required></label>
            <label>Фамилия<input name="lastName" maxlength="50" required></label>
          </div>
          <label>Должность<input name="position" maxlength="80" placeholder="Например, дизайнер"></label>
          <label>Логин<input name="login" maxlength="50" autocomplete="username" required></label>
          <label>Пароль<input name="password" type="password" minlength="4" autocomplete="new-password" required></label>
          <label>Тип аккаунта
            <select name="role">
              <option value="creator">Руководитель — создаёт, редактирует, удаляет</option>
              <option value="executor">Исполнитель — берёт задачи и меняет статус</option>
            </select>
          </label>
          <p class="form-error"></p>
          <button class="primary" type="submit">Создать аккаунт и войти</button>
        </form>
      </div>`;
    document.body.appendChild(wrap);

    const loginForm = wrap.querySelector('#login-form');
    const regForm = wrap.querySelector('#register-form');
    wrap.querySelectorAll('.auth-tabs button').forEach(b => b.addEventListener('click', () => {
      wrap.querySelectorAll('.auth-tabs button').forEach(x => x.classList.toggle('active', x === b));
      loginForm.hidden = b.dataset.tab !== 'login';
      regForm.hidden = b.dataset.tab !== 'register';
    }));
    wrap.querySelectorAll('.demo-acc').forEach(b => b.addEventListener('click', () => {
      loginForm.login.value = b.dataset.login;
      loginForm.password.value = b.dataset.password;
    }));

    const enter = login => { localStorage.setItem(SESSION_KEY, login); location.reload(); };

    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const err = loginForm.querySelector('.form-error');
      const list = await accounts();
      const acc = list.find(a => a.login === loginForm.login.value.trim());
      if (!acc || acc.hash !== await hash(loginForm.password.value)) { err.textContent = 'Неверный логин или пароль'; return; }
      enter(acc.login);
    });
    regForm.addEventListener('submit', async e => {
      e.preventDefault();
      const err = regForm.querySelector('.form-error');
      const firstName = regForm.firstName.value.trim(), lastName = regForm.lastName.value.trim(), position = regForm.position.value.trim();
      const login = regForm.login.value.trim(), password = regForm.password.value;
      if (!firstName || !lastName || !login) { err.textContent = 'Заполните имя, фамилию и логин'; return; }
      if (password.length < 4) { err.textContent = 'Пароль — минимум 4 символа'; return; }
      const list = await accounts();
      if (list.some(a => a.login === login)) { err.textContent = 'Такой логин уже занят'; return; }
      list.push(normalize({ login, firstName, lastName, position, role: regForm.role.value, hash: await hash(password) }));
      saveAccounts(list);
      enter(login);
    });
  }

  if (!user) {
    accounts(); // создаём тестовые аккаунты при первом запуске
    document.addEventListener('DOMContentLoaded', showLogin);
    if (document.readyState !== 'loading') showLogin();
  }
})();
