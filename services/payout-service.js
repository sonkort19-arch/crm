function makePayoutId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function canDeletePayoutByRole(role) {
  return role === 'owner' || role === 'admin';
}

export function applyPayout(state, payload) {
  const { serviceKey, name, amount, actor } = payload || {};
  if (!serviceKey || !name) return { ok: false, reason: 'invalid_target' };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'invalid_amount' };

  if (!state.balances[serviceKey]) state.balances[serviceKey] = {};
  if (state.balances[serviceKey][name] === undefined) state.balances[serviceKey][name] = 0;
  state.balances[serviceKey][name] = +(state.balances[serviceKey][name] - amount).toFixed(2);

  if (!Array.isArray(state.payoutLog)) state.payoutLog = [];
  const row = {
    id: makePayoutId(),
    serviceKey,
    name,
    amount,
    at: new Date().toISOString(),
    isDeleted: false,
    createdByRole: actor?.role || null,
    createdByLogin: actor?.login || null,
  };
  state.payoutLog.push(row);
  return { ok: true, payout: row };
}

export function deletePayout(state, payload) {
  const { id, serviceKey, name, actor, reason } = payload || {};
  if (!id || !serviceKey || !name) return { ok: false, reason: 'invalid_target' };
  if (!reason || !String(reason).trim()) return { ok: false, reason: 'empty_reason' };

  const payout = (state.payoutLog || []).find((e) => e.id === id && e.serviceKey === serviceKey && e.name === name);
  if (!payout || payout.isDeleted) return { ok: false, reason: 'already_deleted_or_not_found' };

  if (!state.balances[serviceKey]) state.balances[serviceKey] = {};
  if (state.balances[serviceKey][name] === undefined) state.balances[serviceKey][name] = 0;
  state.balances[serviceKey][name] = +(state.balances[serviceKey][name] + payout.amount).toFixed(2);

  const deletedAt = new Date().toISOString();
  payout.isDeleted = true;
  payout.deletedAt = deletedAt;
  payout.deletedByRole = actor?.role || null;
  payout.deletedByLogin = actor?.login || null;
  payout.deleteReason = String(reason).trim();

  if (!Array.isArray(state.payoutDeletionLog)) state.payoutDeletionLog = [];
  state.payoutDeletionLog.push({
    payoutId: payout.id,
    serviceKey,
    name,
    amount: payout.amount,
    at: deletedAt,
    byRole: actor?.role || null,
    byLogin: actor?.login || null,
    reason: String(reason).trim(),
  });

  return { ok: true, payout };
}
