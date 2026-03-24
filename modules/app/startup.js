export async function runStartup({
  getState,
  setStateGetter,
  addAudit,
  saveSalaryState,
  setUiStatus,
  persistNow,
  initTheme,
  initMobileNav,
  initCalculator,
  isConfigured,
  initCrmCloud,
  mergePercentagesFromParsed,
  normalizeSalaryState,
  refreshUIFromCloud,
  setPercentages,
  setSalary,
  boot,
}) {
  setStateGetter(() => getState());

  window.addEventListener('error', (e) => {
    addAudit('client_error', {
      message: e.message || 'unknown',
      source: e.filename || '',
      line: e.lineno || 0,
    });
    saveSalaryState();
  });
  window.addEventListener('unhandledrejection', (e) => {
    addAudit('client_unhandled_rejection', {
      reason: String(e.reason || 'unknown'),
    });
    saveSalaryState();
  });
  window.__crmCloudPersistError = (err) => {
    if (err && err.code === 'optimistic_conflict') {
      setUiStatus('Обнаружен конфликт изменений. Данные были обновлены с другого клиента, обновите действие.', 'danger');
      return;
    }
    setUiStatus('Не удалось сохранить в облако. Проверьте сеть.', 'danger');
  };

  const flushOnBackground = () => {
    persistNow().catch((err) => {
      if (err && err.code === 'optimistic_conflict') return;
      console.error('CRM cloud flush on background', err);
    });
  };
  window.addEventListener('pagehide', flushOnBackground);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnBackground();
  });

  initTheme();
  initMobileNav();
  initCalculator();

  const getBootEls = () => ({
    overlay: document.getElementById('crmBootOverlay'),
    message: document.getElementById('crmBootMessage'),
    retry: document.getElementById('crmBootRetry'),
  });
  const showBootOverlay = (msg, showRetry) => {
    const { overlay, message, retry } = getBootEls();
    if (message) message.textContent = msg;
    if (retry) {
      retry.classList.toggle('hidden', !showRetry);
      retry.onclick = showRetry
        ? () => {
            location.reload();
          }
        : null;
    }
    if (overlay) overlay.classList.remove('hidden');
  };
  const hideBootOverlay = () => {
    const { overlay } = getBootEls();
    if (overlay) overlay.classList.add('hidden');
  };

  if (!isConfigured()) {
    showBootOverlay(
      'Нет настроек Supabase. Создайте crm-config.js из crm-config.example.js и укажите supabaseUrl и supabaseAnonKey (см. README).',
      false
    );
    return;
  }

  showBootOverlay('Загрузка данных…', false);

  const res = await initCrmCloud({
    onRow: (row) => {
      if (!row) return;
      const nextPercentages = mergePercentagesFromParsed(row.percentages);
      setPercentages(nextPercentages);
      setSalary(normalizeSalaryState(row.salary, nextPercentages));
      refreshUIFromCloud();
    },
  });

  if (!res.ok) {
    showBootOverlay(`Ошибка загрузки из Supabase: ${res.error || 'неизвестно'}`, true);
    return;
  }

  hideBootOverlay();
  boot();
}
