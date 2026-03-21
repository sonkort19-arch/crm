/**
 * HTTP-клиент к backend (относительные пути — тот же origin, что и статика).
 */

import { authFetchHeaders, clearSession } from './auth.js';

export const API_BASE = '/api';

async function parseError(res) {
  try {
    const j = await res.json();
    return j.error || j.message || JSON.stringify(j);
  } catch {
    return res.statusText || String(res.status);
  }
}

function onUnauthorized() {
  clearSession();
  if (typeof window !== 'undefined') window.location.reload();
}

export async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: authFetchHeaders(),
  });
  if (r.status === 401) {
    onUnauthorized();
    throw new Error('Требуется авторизация');
  }
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function apiPost(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authFetchHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body ?? {}),
  });
  if (r.status === 401) {
    onUnauthorized();
    throw new Error('Требуется авторизация');
  }
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function apiPut(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: authFetchHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body ?? {}),
  });
  if (r.status === 401) {
    onUnauthorized();
    throw new Error('Требуется авторизация');
  }
  if (!r.ok) throw new Error(await parseError(r));
  return r.json();
}

export async function apiDelete(path) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: authFetchHeaders(),
  });
  if (r.status === 401) {
    onUnauthorized();
    throw new Error('Требуется авторизация');
  }
  if (!r.ok) throw new Error(await parseError(r));
  if (r.status === 204 || r.headers.get('content-length') === '0') return {};
  return r.json().catch(() => ({}));
}
