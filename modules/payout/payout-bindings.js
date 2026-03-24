export function bindPayoutUi({
  els,
  confirmPayout,
  confirmPayoutDelete,
  takeSnapshot,
  restoreSnapshot,
}) {
  if (els.takeSnapshotBtn) {
    els.takeSnapshotBtn.addEventListener('click', takeSnapshot);
  }
  if (els.restoreSnapshotBtn) {
    els.restoreSnapshotBtn.addEventListener('click', restoreSnapshot);
  }

  if (els.payoutConfirmBtn) {
    els.payoutConfirmBtn.addEventListener('click', confirmPayout);
  }
  if (els.payoutDeleteConfirmBtn) {
    els.payoutDeleteConfirmBtn.addEventListener('click', confirmPayoutDelete);
  }

  if (els.payoutAmountInput) {
    els.payoutAmountInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmPayout();
    });
  }
}
