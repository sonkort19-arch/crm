export function collectPersonOperations(salaryState, serviceKey, name) {
  const out = [];
  const acc = salaryState?.accrualLog || [];
  const pay = salaryState?.payoutLog || [];

  for (const e of acc) {
    if (e.serviceKey === serviceKey && e.name === name && e.amount > 0) {
      out.push({ kind: 'accrual', amount: e.amount, at: e.at, id: null });
    }
  }
  for (const e of pay) {
    if (e.serviceKey === serviceKey && e.name === name && e.amount > 0) {
      out.push({
        kind: e.isDeleted ? 'payout_deleted' : 'payout',
        amount: e.amount,
        at: e.at,
        id: e.id,
        isDeleted: e.isDeleted === true,
      });
    }
  }
  return out.sort((a, b) => new Date(a.at) - new Date(b.at));
}

export function filterOperationsByRange(ops, start, end) {
  return ops.filter((o) => {
    const t = new Date(o.at);
    return !Number.isNaN(t.getTime()) && t >= start && t <= end;
  });
}

export function applyHistoryFilters(ops, filters) {
  const search = String(filters?.search || '').trim().toLowerCase();
  const type = String(filters?.type || 'all');
  const minAmount = Number(filters?.minAmount || 0);

  return ops.filter((o) => {
    if (type !== 'all' && o.kind !== type) return false;
    if (Number.isFinite(minAmount) && minAmount > 0 && o.amount < minAmount) return false;
    if (search) {
      const hay = `${o.kind} ${o.amount} ${o.at}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

export function summarizeOperations(ops) {
  let accrual = 0;
  let payout = 0;
  for (const o of ops) {
    if (o.kind === 'accrual') accrual += o.amount;
    if (o.kind === 'payout') payout += o.amount;
  }
  accrual = +accrual.toFixed(2);
  payout = +payout.toFixed(2);
  return {
    accrual,
    payout,
    delta: +(accrual - payout).toFixed(2),
  };
}

