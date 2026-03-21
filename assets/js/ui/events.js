/**
 * События: навигация, кнопки, делегирование списка сотрудников.
 */

import { db, loadUsersFromServer } from '../core/db.js';
import {
  distributeGlobalIncome,
  addIncome,
  withdraw,
  addUser,
} from '../services/salaryService.js';
import { isEmployee, logout } from '../services/authService.js';
import {
  render,
  renderUsers,
  renderDetails,
  renderSettings,
  refreshTotalBalance,
  applyRoleVisibility,
} from './render.js';
import {
  updateAllActionButtons,
  updateAddUserButton,
} from './actionButtons.js';

function bindLogout() {
  const b = document.getElementById('btnLogout');
  if (b) {
    b.addEventListener('click', async () => {
      await logout();
      window.location.reload();
    });
  }
}

function hideAll() {
  ['usersScreen', 'detailsScreen', 'settingsScreen'].forEach((id) => {
    const n = document.getElementById(id);
    if (n) n.style.display = 'none';
  });
}

function openUser(id) {
  db.activeUserId = id;

  hideAll();
  const det = document.getElementById('detailsScreen');
  if (det) det.style.display = 'block';

  renderDetails();
  const inc = document.getElementById('income');
  if (inc) {
    inc.value = '';
    inc.focus();
  }
  updateAllActionButtons();
}

function back() {
  hideAll();
  const us = document.getElementById('usersScreen');
  if (us) us.style.display = 'block';
  renderUsers();
}

function openSettings() {
  hideAll();
  const st = document.getElementById('settingsScreen');
  if (st) st.style.display = 'block';
  renderSettings();
}

function wireInputSync() {
  const g = document.getElementById('globalIncome');
  if (g) g.addEventListener('input', updateAllActionButtons);
  const inc = document.getElementById('income');
  const w = document.getElementById('withdraw');
  if (inc) inc.addEventListener('input', updateAllActionButtons);
  if (w) w.addEventListener('input', updateAllActionButtons);
  const nn = document.getElementById('newUserNameSettings');
  const np = document.getElementById('newUserPercentSettings');
  const nu = document.getElementById('newUserUsernameSettings');
  const pw = document.getElementById('newUserPasswordSettings');
  if (nn) nn.addEventListener('input', updateAddUserButton);
  if (np) np.addEventListener('input', updateAddUserButton);
  if (nu) nu.addEventListener('input', updateAddUserButton);
  if (pw) pw.addEventListener('input', updateAddUserButton);
}

function bindActionHandlers() {
  const addGlobal = document.getElementById('addGlobalIncome');
  if (addGlobal) {
    addGlobal.addEventListener('click', async () => {
      const input = document.getElementById('globalIncome');
      if (!input) return;
      if (!(await distributeGlobalIncome(input.value))) return;
      input.value = '';
      input.focus();
      renderUsers();
    });
  }

  const addIncomeBtn = document.getElementById('addIncome');
  if (addIncomeBtn) {
    addIncomeBtn.addEventListener('click', async () => {
      const incomeInput = document.getElementById('income');
      if (!incomeInput) return;
      if (!(await addIncome(incomeInput.value))) return;
      incomeInput.value = '';
      incomeInput.focus();
      renderDetails();
      refreshTotalBalance();
    });
  }

  const takeMoney = document.getElementById('takeMoney');
  if (takeMoney) {
    takeMoney.addEventListener('click', async () => {
      const wInput = document.getElementById('withdraw');
      if (!wInput) return;
      if (!(await withdraw(wInput.value))) return;
      wInput.value = '';
      wInput.focus();
      renderDetails();
      refreshTotalBalance();
    });
  }

  const addUserBtn = document.getElementById('addUserBtn');
  if (addUserBtn) {
    addUserBtn.addEventListener('click', async () => {
      const nameEl = document.getElementById('newUserNameSettings');
      const pctEl = document.getElementById('newUserPercentSettings');
      if (!nameEl || !pctEl) return;
      const uEl = document.getElementById('newUserUsernameSettings');
      const pEl = document.getElementById('newUserPasswordSettings');
      if (!(await addUser(nameEl.value, pctEl.value, uEl?.value, pEl?.value))) return;
      nameEl.value = '';
      pctEl.value = '';
      if (uEl) uEl.value = '';
      if (pEl) pEl.value = '';
      nameEl.focus();
      updateAddUserButton();
      renderUsers();
      renderSettings();
      refreshTotalBalance();
    });
  }
}

function bindNavigation() {
  const openSt = document.getElementById('btnOpenSettings');
  if (openSt) openSt.addEventListener('click', () => openSettings());

  const backSt = document.getElementById('btnBackSettings');
  if (backSt) backSt.addEventListener('click', () => back());

  const backDet = document.getElementById('btnBackDetails');
  if (backDet) backDet.addEventListener('click', () => back());
}

function bindUserListDelegation() {
  const usersEl = document.getElementById('users');
  if (!usersEl) return;

  usersEl.addEventListener('click', (e) => {
    const card = e.target.closest('.js-user-card');
    if (!card || !usersEl.contains(card)) return;
    const id = card.dataset.userId;
    if (id) openUser(id);
  });

  usersEl.addEventListener('keydown', (e) => {
    const card = e.target.closest('.js-user-card');
    if (!card || !usersEl.contains(card)) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const id = card.dataset.userId;
      if (id) openUser(id);
    }
  });
}

export async function init() {
  await loadUsersFromServer();
  if (isEmployee() && db.users.length === 1) {
    db.activeUserId = db.users[0].id;
  }
  wireInputSync();
  bindActionHandlers();
  bindNavigation();
  bindUserListDelegation();
  bindLogout();
  applyRoleVisibility();
  render();
}
