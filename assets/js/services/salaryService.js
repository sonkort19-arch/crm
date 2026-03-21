/**
 * Доменная логика: вызовы API + обновление клиентского db.
 */

import { db, loadUsersFromServer } from '../core/db.js';
import {
  roundMoney,
  safeNumber,
  parseMoneyInput,
  parseLogDate,
  MAX_PERCENT,
  MAX_NAME_LEN,
} from '../core/utils.js';
import { apiPost, apiPut, apiDelete } from '../core/api.js';

export function getActiveUser() {
  if (!db.users || db.users.length === 0) return null;
  const u = db.users.find((x) => x.id === db.activeUserId);
  return u || db.users[0];
}

export function calcBalance(logs) {
  if (!Array.isArray(logs)) return 0;
  let total = 0;
  logs.forEach((log) => {
    if (!log || typeof log !== 'object') return;
    const amt = roundMoney(log.amount);
    if (log.type === 'income') total += amt;
    if (log.type === 'withdraw') total -= amt;
  });
  return roundMoney(total);
}

export function calcTotalBalance() {
  let total = 0;
  db.users.forEach((u) => {
    total += calcBalance(u.logs);
  });
  return roundMoney(total);
}

export function groupLogsByMonth(logs) {
  const MONTH_NAMES = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];
  const totals = {};
  if (!Array.isArray(logs)) return [];

  logs.forEach((log) => {
    if (!log || log.type !== 'income') return;
    const amt = roundMoney(log.amount);
    if (!Number.isFinite(amt)) return;
    const d = parseLogDate(log.date);
    if (!d) return;
    const y = d.getFullYear();
    const mo = d.getMonth() + 1;
    const key = `${y}-${mo < 10 ? '0' : ''}${mo}`;
    totals[key] = roundMoney((totals[key] || 0) + amt);
  });

  return Object.keys(totals)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => {
      const parts = key.split('-');
      const y = parseInt(parts[0], 10);
      const mo = parseInt(parts[1], 10);
      const label = `${MONTH_NAMES[mo - 1]} ${y}`;
      return { key, label, total: totals[key] };
    });
}

export async function distributeGlobalIncome(incomeAmount) {
  const income = parseMoneyInput(incomeAmount);
  if (!(income > 0)) return false;
  try {
    await apiPost('/operations/distribute', { amount: income });
    await loadUsersFromServer();
    return true;
  } catch {
    return false;
  }
}

export async function addIncome(grossInput) {
  const user = getActiveUser();
  if (!user) return false;
  const income = parseMoneyInput(grossInput);
  if (!(income > 0)) return false;
  try {
    await apiPost(`/users/${encodeURIComponent(user.id)}/income`, { gross: income });
    await loadUsersFromServer();
    return true;
  } catch {
    return false;
  }
}

export async function withdraw(amountInput) {
  const user = getActiveUser();
  if (!user) return false;
  const amount = parseMoneyInput(amountInput);
  if (!(amount > 0)) return false;
  try {
    await apiPost(`/users/${encodeURIComponent(user.id)}/withdraw`, { amount });
    await loadUsersFromServer();
    return true;
  } catch {
    return false;
  }
}

export async function updateUserName(id, value) {
  const n = String(value).trim().slice(0, MAX_NAME_LEN);
  if (!n) return false;
  try {
    await apiPut(`/users/${encodeURIComponent(id)}`, { name: n });
    await loadUsersFromServer();
    return true;
  } catch {
    return false;
  }
}

export async function updateUserPercent(id, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  try {
    await apiPut(`/users/${encodeURIComponent(id)}`, {
      percent: safeNumber(n, { min: 0, max: MAX_PERCENT, default: 10 }),
    });
    await loadUsersFromServer();
    return true;
  } catch {
    return false;
  }
}

export async function deleteUser(id) {
  try {
    await apiDelete(`/users/${encodeURIComponent(id)}`);
    await loadUsersFromServer();
    return true;
  } catch {
    return false;
  }
}

export async function addUser(name, percent, username, password) {
  const n = String(name).trim().slice(0, MAX_NAME_LEN);
  if (!n) return false;
  const p = Number(percent);
  if (!Number.isFinite(p)) return false;
  const u = String(username ?? '').trim();
  const pw = password != null ? String(password) : '';
  if (u.length < 3 || pw.length < 4) return false;
  try {
    await apiPost('/users', {
      name: n,
      percent: safeNumber(p, { min: 0, max: MAX_PERCENT, default: 10 }),
      username: u,
      password: pw,
    });
    await loadUsersFromServer();
    return true;
  } catch {
    return false;
  }
}
