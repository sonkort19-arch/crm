export function bindAppUi({
  els,
  login,
  showDistribution,
  showSalary,
  showSettings,
  showCalculator,
  openDevToolsModal,
  settingsGoBack,
  saveSettings,
  handleAddCategoryClick,
  logout,
  exportPercentagesJson,
  canImportPercents,
  openImportFilePicker,
  importPercentagesFromFile,
  calculate,
  copyText,
  clearAll,
  toggleTheme,
  openSalaryDetailModal,
  openPersonHistoryModal,
  openPayoutModal,
  runDevToolsAction,
  closePayoutModal,
  closePayoutDeleteModal,
  closeSalaryDetailModal,
  closePersonHistoryModal,
  closeDevToolsModal,
}) {
  els.loginBtn.addEventListener('click', login);
  els.passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
  });
  els.loginInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
  });

  if (els.distributionBtn) els.distributionBtn.addEventListener('click', showDistribution);
  if (els.salaryBtn) els.salaryBtn.addEventListener('click', showSalary);
  if (els.settingsBtn) els.settingsBtn.addEventListener('click', showSettings);
  if (els.calculatorBtn) els.calculatorBtn.addEventListener('click', showCalculator);
  if (els.devToolsBtn) els.devToolsBtn.addEventListener('click', openDevToolsModal);
  if (els.settingsBackBtn) els.settingsBackBtn.addEventListener('click', settingsGoBack);
  if (els.saveSettingsBtn) els.saveSettingsBtn.addEventListener('click', saveSettings);
  els.settingsContent.addEventListener('click', handleAddCategoryClick);
  els.logoutBtn.addEventListener('click', logout);

  els.exportPercentsBtn.addEventListener('click', exportPercentagesJson);
  els.importPercentsBtn.addEventListener('click', () => {
    if (!canImportPercents()) return;
    openImportFilePicker();
  });
  els.importPercentsFile.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || !canImportPercents()) return;
    importPercentagesFromFile(file);
  });

  els.calcBtn.addEventListener('click', calculate);
  els.copyBtn.addEventListener('click', copyText);
  els.clearBtn.addEventListener('click', clearAll);

  [els.mobileAngel, els.nova, els.tlabs].forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') calculate();
    });
  });

  if (els.brandThemeBtn) els.brandThemeBtn.addEventListener('click', toggleTheme);
  if (els.loginThemeBtn) els.loginThemeBtn.addEventListener('click', toggleTheme);

  if (els.salaryDirections) {
    els.salaryDirections.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-salary-open]');
      if (!btn) return;
      const key = btn.getAttribute('data-salary-open');
      if (key) openSalaryDetailModal(key);
    });
  }

  if (els.salaryDetailModal) {
    els.salaryDetailModal.addEventListener('click', (e) => {
      const h = e.target.closest('[data-salary-history]');
      if (h) {
        e.preventDefault();
        const serviceKey = h.getAttribute('data-salary-history');
        const name = h.getAttribute('data-person-name');
        if (serviceKey && name) openPersonHistoryModal(serviceKey, name);
        return;
      }
      const p = e.target.closest('[data-salary-payout]');
      if (!p) return;
      e.preventDefault();
      const serviceKey = p.getAttribute('data-salary-payout');
      const name = p.getAttribute('data-payout-name');
      if (serviceKey && name) openPayoutModal(serviceKey, name);
    });
  }

  if (els.devClearAccrualsBtn) {
    els.devClearAccrualsBtn.addEventListener('click', () => runDevToolsAction('clear_accruals'));
  }
  if (els.devResetCategoriesBtn) {
    els.devResetCategoriesBtn.addEventListener('click', () => runDevToolsAction('reset_categories'));
  }

  els.appScreen.addEventListener('click', (e) => {
    if (e.target.closest('[data-modal-close="payout"]')) closePayoutModal();
    if (e.target.closest('[data-modal-close="payoutDelete"]')) closePayoutDeleteModal();
    if (e.target.closest('[data-modal-close="salaryDetail"]')) closeSalaryDetailModal();
    if (e.target.closest('[data-modal-close="personHistory"]')) closePersonHistoryModal();
    if (e.target.closest('[data-modal-close="devTools"]')) closeDevToolsModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (els.payoutModal && !els.payoutModal.classList.contains('hidden')) {
      closePayoutModal();
      return;
    }
    if (els.payoutDeleteModal && !els.payoutDeleteModal.classList.contains('hidden')) {
      closePayoutDeleteModal();
      return;
    }
    if (els.personHistoryModal && !els.personHistoryModal.classList.contains('hidden')) {
      closePersonHistoryModal();
      return;
    }
    if (els.salaryDetailModal && !els.salaryDetailModal.classList.contains('hidden')) {
      closeSalaryDetailModal();
      return;
    }
    if (els.devToolsModal && !els.devToolsModal.classList.contains('hidden')) {
      closeDevToolsModal();
    }
  });
}
