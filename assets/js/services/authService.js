/**
 * Авторизация: вход, выход, сессия, роли.
 */

import {
  getToken,
  setToken,
  clearSession,
  getStoredUser,
  setStoredUser,
  authFetchHeaders,
} from '../core/auth.js';

const API_AUTH = '/api/auth';

export async function login(username, password) {
  const r = await fetch(`${API_AUTH}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || data.message || 'Ошибка входа');
  localStorage.setItem('token', data.token);
  setToken(data.token);
  setStoredUser(data.user);

  const me = await fetch(`${API_AUTH}/me`, {
    headers: {
      Authorization: 'Bearer ' + localStorage.getItem('token'),
    },
  });
  if (!me.ok) {
    clearSession();
    throw new Error('Сессия не подтверждена');
  }
  const meData = await me.json();
  if (meData.user) setStoredUser(meData.user);
  return meData.user;
}

export async function logout() {
  try {
    if (getToken()) {
      await fetch(`${API_AUTH}/logout`, {
        method: 'POST',
        headers: {
          ...authFetchHeaders({ 'Content-Type': 'application/json' }),
        },
        body: '{}',
      });
    }
  } catch {
    /* ignore */
  }
  clearSession();
}

export async function restoreSession() {
  if (!getToken()) return false;
  try {
    const r = await fetch(`${API_AUTH}/me`, {
      headers: {
        Authorization: 'Bearer ' + localStorage.getItem('token'),
      },
    });
    if (r.status === 401) {
      clearSession();
      return false;
    }
    if (!r.ok) {
      clearSession();
      return false;
    }
    const data = await r.json();
    if (data.user) setStoredUser(data.user);
    return true;
  } catch {
    clearSession();
    return false;
  }
}

export function getCurrentUser() {
  return getStoredUser();
}

export function isAdmin() {
  const u = getStoredUser();
  return u && u.role === 'admin';
}

export function isEmployee() {
  const u = getStoredUser();
  return u && u.role === 'employee';
}
