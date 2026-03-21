/**
 * Экран входа и переключение видимости приложения.
 */

import { login } from '../services/authService.js';

let loginRoot;
let appRoot;
let errorEl;
let formEl;
let onLoginSuccess;

function getEls() {
  if (!loginRoot) loginRoot = document.getElementById('loginScreen');
  if (!appRoot) appRoot = document.getElementById('appShell');
  if (!errorEl) errorEl = document.getElementById('loginError');
  if (!formEl) formEl = document.getElementById('loginForm');
}

export function showLoginScreen() {
  getEls();
  if (loginRoot) loginRoot.hidden = false;
  if (appRoot) appRoot.hidden = true;
}

export function showAppScreen() {
  getEls();
  if (loginRoot) loginRoot.hidden = true;
  if (appRoot) appRoot.hidden = false;
}

/**
 * @param {() => Promise<void>} afterLogin — вызывается после успешного входа (первый запуск UI).
 */
export function initAuthView(afterLogin) {
  onLoginSuccess = afterLogin;
  getEls();
  if (!formEl) return;
  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('loginUsername');
    const p = document.getElementById('loginPassword');
    if (!u || !p) return;
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
    try {
      await login(u.value.trim(), p.value.trim());
      p.value = '';
      showAppScreen();
      if (onLoginSuccess) await onLoginSuccess();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err instanceof Error ? err.message : String(err);
        errorEl.hidden = false;
      }
    }
  });
}
