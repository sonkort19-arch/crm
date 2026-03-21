/**
 * Клиентское состояние (зеркало сервера). activeUserId — только в памяти UI.
 */

import { roundMoney, safeNumber, MAX_MONEY, MAX_PERCENT, MAX_NAME_LEN } from './utils.js';
import { apiGet } from './api.js';

function normalizeLog(log) {
  if (!log || typeof log !== 'object') return null;
  const t = log.type;
  if (t !== 'income' && t !== 'withdraw') return null;
  const amount = safeNumber(log.amount, { min: 0, max: MAX_MONEY, default: 0 });
  const date = log.date != null ? String(log.date).slice(0, 200) : '';
  return { type: t, amount: roundMoney(amount), date };
}

function normalizeUser(u) {
  if (!u || typeof u !== 'object') return null;
  const id = String(u.id != null ? u.id : '');
  const rawName = u.name != null ? String(u.name) : 'Сотрудник';
  const name = rawName.trim().slice(0, MAX_NAME_LEN) || 'Сотрудник';
  const p = safeNumber(u.percent, { min: 0, max: MAX_PERCENT, default: 10 });
  const logs = Array.isArray(u.logs) ? u.logs.map(normalizeLog).filter(Boolean) : [];
  return { id, name, percent: roundMoney(p), logs };
}

export let db = {
  users: [],
  activeUserId: null,
};

/** Загрузить пользователей и логи с сервера. */
export async function loadUsersFromServer() {
  const data = await apiGet('/users');
  const users = Array.isArray(data.users) ? data.users.map(normalizeUser).filter(Boolean) : [];
  db.users = users;
  if (db.activeUserId != null && !db.users.some((u) => u.id === db.activeUserId)) {
    db.activeUserId = null;
  }
}
