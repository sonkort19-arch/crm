export function attachSettingsDetailDirtyTracking({ rootEl, onDirty }) {
  rootEl.querySelectorAll('.percent-row input').forEach((el) => {
    el.addEventListener('input', onDirty);
    el.addEventListener('change', onDirty);
  });
}

export function bindDeleteCategoryButtons({
  rootDocument,
  getPercentages,
  setPercentages,
  deepClone,
  sumPercents,
  isPercentTotalValid,
  formatPercentForMessage,
  savePercentages,
  syncSalaryWithPercentages,
  updateLoadWarningBanner,
  setSettingsStatus,
  setSettingsDetailDirty,
  renderSettings,
  confirmDelete,
}) {
  rootDocument.querySelectorAll('.delete-category-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.confirmDelete === 'true' && !confirmDelete()) {
        return;
      }
      const service = btn.dataset.service;
      const name = btn.dataset.name;
      const newStructure = deepClone(getPercentages());
      delete newStructure[service].items[name];

      const total = sumPercents(newStructure[service].items);

      if (!isPercentTotalValid(total)) {
        setSettingsStatus(`После удаления сумма = ${formatPercentForMessage(total)}%`, 'danger');
      } else {
        setSettingsStatus('Категория удалена.', 'ok');
      }

      setPercentages(newStructure);
      savePercentages();
      syncSalaryWithPercentages();
      updateLoadWarningBanner();
      setSettingsDetailDirty(false);
      renderSettings();
    });
  });
}
