/**
 * Точка входа: сессия → экран входа или CRM.
 */

import { restoreSession } from './services/authService.js';
import { initAuthView, showAppScreen, showLoginScreen } from './ui/authView.js';

async function runAppShell() {
  const { init } = await import('./ui/events.js');
  await init();
}

async function main() {
  initAuthView(async () => {
    await runAppShell();
  });

  const ok = await restoreSession();
  if (!ok) {
    showLoginScreen();
    return;
  }
  showAppScreen();
  await runAppShell();
}

main().catch((e) => console.error('CRM: ошибка запуска', e));
