/**
 * Отрисовка экранов (без addEventListener для глобальных кнопок — см. events.js).
 */

import { db } from '../core/db.js';
import { roundMoney, MAX_NAME_LEN, MAX_PERCENT } from '../core/utils.js';
import {
  getActiveUser,
  calcBalance,
  calcTotalBalance,
  groupLogsByMonth,
  updateUserName,
  updateUserPercent,
  deleteUser,
} from '../services/salaryService.js';
import { isAdmin } from '../services/authService.js';
import { updateAllActionButtons } from './actionButtons.js';

export function applyRoleVisibility() {
  const admin = isAdmin();
  document.querySelectorAll('[data-auth="admin"]').forEach((el) => {
    el.hidden = !admin;
  });
  const title = document.getElementById('usersScreenTitle');
  if (title) title.textContent = admin ? 'Сотрудники' : 'Моя карточка';
  const pill = document.getElementById('balancePillLabel');
  if (pill) pill.textContent = admin ? 'Общий баланс' : 'Мой баланс';
  const suffix = document.getElementById('detailPercentSuffix');
  if (suffix) suffix.textContent = admin ? '(в настройках)' : '';
}

export function refreshTotalBalance() {
  const tb = document.getElementById('totalBalance');
  if (tb) tb.textContent = String(calcTotalBalance());
}

function appendLogRow(container, log) {
  if (!log || (log.type !== 'income' && log.type !== 'withdraw')) return;
  const div = document.createElement('div');
  const span = document.createElement('span');
  const amt = roundMoney(log.amount);
  const dateStr = log.date != null ? String(log.date) : '';

  if (log.type === 'income') {
    span.className = 'green';
    span.textContent = `+${amt} ₽`;
  } else {
    span.className = 'red';
    span.textContent = `-${amt} ₽`;
  }
  div.appendChild(span);
  div.appendChild(document.createTextNode(` (${dateStr})`));
  container.appendChild(div);
}

export function renderUsers() {
  const el = document.getElementById('users');
  if (!el) return;

  el.textContent = '';
  const activeId = db.activeUserId;

  db.users.forEach((user) => {
    const balance = calcBalance(user.logs);

    const div = document.createElement('div');
    div.className =
      'card card--clickable js-user-card' + (user.id === activeId ? ' is-active' : '');
    div.setAttribute('role', 'button');
    div.tabIndex = 0;
    div.dataset.userId = user.id;

    const nameDiv = document.createElement('div');
    nameDiv.className = 'user-card__name';
    nameDiv.textContent = user.name;

    const meta = document.createElement('div');
    meta.className = 'user-card__meta';
    meta.appendChild(document.createTextNode('Баланс: '));
    const strong = document.createElement('strong');
    strong.textContent = `${balance} ₽`;
    meta.appendChild(strong);
    meta.appendChild(document.createTextNode(` · ${roundMoney(user.percent)}%`));

    div.appendChild(nameDiv);
    div.appendChild(meta);

    el.appendChild(div);
  });

  refreshTotalBalance();
  updateAllActionButtons();
}

function afterSettingsFieldChange(userId) {
  refreshTotalBalance();
  renderUsers();
  const au = getActiveUser();
  if (au && au.id === userId) renderDetails();
}

export function renderSettings() {
  const el = document.getElementById('settingsList');
  if (!el) return;

  el.textContent = '';

  const canDelete = db.users.length > 1;

  db.users.forEach((user) => {
    const div = document.createElement('div');
    div.className = 'card card--static settings-card settings-row';

    const title = document.createElement('h4');
    title.textContent = 'Сотрудник';

    const nameLabel = document.createElement('span');
    nameLabel.className = 'field-label';
    nameLabel.textContent = 'Имя';

    const nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.placeholder = 'Имя';
    nameInp.maxLength = MAX_NAME_LEN;
    nameInp.value = user.name;
    nameInp.autocomplete = 'off';
    nameInp.addEventListener('change', async function () {
      const ok = await updateUserName(user.id, this.value);
      if (!ok) this.value = user.name;
      else afterSettingsFieldChange(user.id);
    });

    const pctLabel = document.createElement('span');
    pctLabel.className = 'field-label';
    pctLabel.textContent = 'Процент';

    const pctInp = document.createElement('input');
    pctInp.type = 'number';
    pctInp.inputMode = 'decimal';
    pctInp.min = '0';
    pctInp.max = String(MAX_PERCENT);
    pctInp.step = 'any';
    pctInp.placeholder = 'Процент';
    pctInp.value = String(roundMoney(user.percent));
    pctInp.addEventListener('input', async function () {
      await updateUserPercent(user.id, this.value);
      afterSettingsFieldChange(user.id);
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-danger';
    delBtn.textContent = 'Удалить';
    delBtn.disabled = !canDelete;
    delBtn.addEventListener('click', async function () {
      if (!(await deleteUser(user.id))) return;
      refreshTotalBalance();
      renderUsers();
      renderSettings();
    });

    div.appendChild(title);
    div.appendChild(nameLabel);
    div.appendChild(nameInp);
    div.appendChild(pctLabel);
    div.appendChild(pctInp);
    div.appendChild(delBtn);
    el.appendChild(div);
  });
  updateAllActionButtons();
}

export function renderDetails() {
  const user = getActiveUser();
  if (!user) return;

  const nameEl = document.getElementById('userName');
  const balEl = document.getElementById('balance');
  const pctLabel = document.getElementById('detailPercentLabel');

  if (nameEl) nameEl.textContent = user.name;
  if (balEl) balEl.textContent = String(calcBalance(user.logs));
  if (pctLabel) pctLabel.textContent = String(roundMoney(user.percent));

  const monthsEl = document.getElementById('monthsStats');
  if (monthsEl) {
    const byMonth = groupLogsByMonth(user.logs);
    monthsEl.textContent = '';
    if (byMonth.length === 0) {
      const p = document.createElement('p');
      p.className = 'months-empty';
      p.textContent = 'Нет данных';
      monthsEl.appendChild(p);
    } else {
      byMonth.forEach((row) => {
        const line = document.createElement('div');
        line.className = 'month-row';
        line.textContent = `${row.label} — ${row.total} ₽`;
        monthsEl.appendChild(line);
      });
    }
  }

  const logEl = document.getElementById('log');
  if (!logEl) return;

  logEl.textContent = '';

  user.logs
    .slice()
    .reverse()
    .forEach((log) => {
      appendLogRow(logEl, log);
    });
  updateAllActionButtons();
}

/** Первичная отрисовка главного экрана после init. */
export function render() {
  renderUsers();
}
