import { deepClone } from '../core/state.js';

const SNAPSHOT_LIMIT = 5;

export function sumServiceBalances(state, serviceKey) {
  const bag = state?.balances?.[serviceKey];
  if (!bag || typeof bag !== 'object') return 0;
  const total = Object.values(bag).reduce((acc, v) => acc + (Number(v) || 0), 0);
  return +total.toFixed(2);
}

export function accrueSalaryFromServices(state, services, atIso) {
  const next = state;
  if (!Array.isArray(next.accrualLog)) next.accrualLog = [];
  const at = atIso || new Date().toISOString();
  for (const key of Object.keys(services || {})) {
    const svc = services[key];
    if (!svc || typeof svc !== 'object') continue;
    if (!next.balances[key]) next.balances[key] = {};
    for (const [name, amount] of Object.entries(svc)) {
      const add = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
      const cur = next.balances[key][name];
      const base = typeof cur === 'number' && Number.isFinite(cur) ? cur : 0;
      next.balances[key][name] = +(base + add).toFixed(2);
      if (add > 0) {
        next.accrualLog.push({ serviceKey: key, name, amount: +add.toFixed(2), at });
      }
    }
  }
  return next;
}

export function takeSnapshot(state, atIso) {
  const next = state;
  if (!Array.isArray(next.snapshots)) next.snapshots = [];
  next.snapshots.push({
    at: atIso || new Date().toISOString(),
    balances: deepClone(next.balances || {}),
    payoutLog: deepClone(next.payoutLog || []),
    accrualLog: deepClone(next.accrualLog || []),
    payoutDeletionLog: deepClone(next.payoutDeletionLog || []),
  });
  if (next.snapshots.length > SNAPSHOT_LIMIT) {
    next.snapshots = next.snapshots.slice(-SNAPSHOT_LIMIT);
  }
  return next;
}

export function restoreLastSnapshot(state) {
  const snapshots = Array.isArray(state?.snapshots) ? state.snapshots : [];
  if (!snapshots.length) return { ok: false, reason: 'no_snapshots' };
  const s = snapshots[snapshots.length - 1];
  state.balances = deepClone(s.balances || {});
  state.payoutLog = deepClone(s.payoutLog || []);
  state.accrualLog = deepClone(s.accrualLog || []);
  state.payoutDeletionLog = deepClone(s.payoutDeletionLog || []);
  return { ok: true, snapshotAt: s.at || null };
}
