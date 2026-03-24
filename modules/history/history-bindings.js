export function bindHistoryUi({
  els,
  setPreset,
  openDeleteModal,
  renderBody,
  setFilters,
  exportCsv,
}) {
  if (els.personHistoryModal) {
    els.personHistoryModal.addEventListener('click', (e) => {
      const presetBtn = e.target.closest('[data-person-history-preset]');
      if (presetBtn) {
        const preset = presetBtn.getAttribute('data-person-history-preset');
        if (preset === 'month' || preset === '30' || preset === 'prevMonth') setPreset(preset);
        return;
      }
      const deleteBtn = e.target.closest('[data-delete-payout-id]');
      if (!deleteBtn) return;
      e.preventDefault();
      openDeleteModal({
        id: deleteBtn.getAttribute('data-delete-payout-id'),
        serviceKey: deleteBtn.getAttribute('data-delete-service'),
        name: deleteBtn.getAttribute('data-delete-name'),
        amount: Number(deleteBtn.getAttribute('data-delete-amount')),
      });
    });
  }

  const onDateChange = () => {
    setPreset(null);
    renderBody();
  };

  const onFilterChange = () => {
    setFilters({
      type: (els.personHistoryType && els.personHistoryType.value) || 'all',
      minAmount: els.personHistoryMinAmount && els.personHistoryMinAmount.value,
      search: String((els.personHistorySearch && els.personHistorySearch.value) || '').trim(),
    });
    renderBody();
  };

  if (els.personHistoryDateFrom) {
    els.personHistoryDateFrom.addEventListener('change', onDateChange);
  }
  if (els.personHistoryDateTo) {
    els.personHistoryDateTo.addEventListener('change', onDateChange);
  }
  if (els.personHistoryType) {
    els.personHistoryType.addEventListener('change', onFilterChange);
  }
  if (els.personHistoryMinAmount) {
    els.personHistoryMinAmount.addEventListener('input', onFilterChange);
  }
  if (els.personHistorySearch) {
    els.personHistorySearch.addEventListener('input', onFilterChange);
  }
  if (els.exportHistoryCsvBtn) {
    els.exportHistoryCsvBtn.addEventListener('click', exportCsv);
  }
}
