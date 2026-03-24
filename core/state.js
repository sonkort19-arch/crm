export const BASE_PERSON_KEYS = ['Юрий', 'Алекс', 'Эрика'];

export const DEFAULT_STRUCTURE = {
  mobileAngel: {
    title: 'Мобильный ангел',
    items: {
      Юрий: 25,
      Алекс: 25,
      Эрика: 9,
      Аренда: 14,
      Смм: 4,
      Развитие: 1,
      Фонд: 1,
      Реклама: 1,
      'Закуп аксессуаров': 1,
      'Закуп телефонов': 1,
      Оклад: 18,
    },
  },
  nova: {
    title: 'Нова',
    items: {
      Юрий: 69,
      Алекс: 7,
      Эрика: 9,
      Аренда: 10,
      Смм: 0,
      Развитие: 1,
      Фонд: 1,
      Реклама: 1,
      'Закуп аксессуаров': 1,
      'Закуп телефонов': 1,
      Оклад: 0,
    },
  },
  tlabs: {
    title: 'Т-лабс',
    items: {
      Юрий: 20,
      Алекс: 20,
      Эрика: 9,
      Аренда: 40,
      Смм: 0,
      Развитие: 1,
      Фонд: 7,
      Реклама: 1,
      'Закуп аксессуаров': 1,
      'Закуп телефонов': 1,
      Оклад: 0,
    },
  },
};

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function mergePercentagesFromParsed(parsed) {
  if (!parsed || typeof parsed !== 'object') return deepClone(DEFAULT_STRUCTURE);

  const result = {};
  for (const key of Object.keys(DEFAULT_STRUCTURE)) {
    const slot = parsed[key];
    if (
      slot &&
      typeof slot === 'object' &&
      slot.items &&
      typeof slot.items === 'object' &&
      !Array.isArray(slot.items)
    ) {
      result[key] = {
        title:
          typeof slot.title === 'string' && slot.title.trim()
            ? slot.title
            : DEFAULT_STRUCTURE[key].title,
        items: deepClone(slot.items),
      };
    } else {
      result[key] = deepClone(DEFAULT_STRUCTURE[key]);
    }
  }
  return result;
}

export function normalizeSalaryState(prevState, percentages) {
  const prevBalances =
    prevState && prevState.balances && typeof prevState.balances === 'object' ? prevState.balances : {};
  const balances = {};
  for (const key of Object.keys(DEFAULT_STRUCTURE)) {
    balances[key] = {};
    const items = percentages[key] && percentages[key].items ? percentages[key].items : {};
    const bag = prevBalances[key] && typeof prevBalances[key] === 'object' ? prevBalances[key] : {};
    for (const name of Object.keys(items)) {
      const v = bag[name];
      const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
      balances[key][name] = Math.round(n * 100) / 100;
    }
  }
  let payoutLog = [];
  if (prevState && Array.isArray(prevState.payoutLog)) {
    payoutLog = prevState.payoutLog
      .filter((e) => e && typeof e === 'object' && e.serviceKey && e.name && typeof e.amount === 'number')
      .map((e, idx) => {
        const id =
          typeof e.id === 'string' && e.id.trim()
            ? e.id
            : `${e.serviceKey}:${e.name}:${e.at || 'na'}:${idx}`;
        const isDeleted = e.isDeleted === true;
        const out = {
          id,
          serviceKey: e.serviceKey,
          name: e.name,
          amount: Math.abs(Number(e.amount) || 0),
          at: e.at,
          isDeleted,
        };
        if (isDeleted) {
          out.deletedAt = e.deletedAt || e.at || new Date().toISOString();
          out.deletedByRole = e.deletedByRole || null;
          out.deletedByLogin = e.deletedByLogin || null;
          out.deleteReason = typeof e.deleteReason === 'string' ? e.deleteReason : '';
        }
        return out;
      });
  }
  let accrualLog = [];
  if (prevState && Array.isArray(prevState.accrualLog)) {
    accrualLog = prevState.accrualLog.filter(
      (e) =>
        e &&
        typeof e === 'object' &&
        e.serviceKey &&
        e.name &&
        typeof e.amount === 'number' &&
        e.amount > 0
    );
  }
  let payoutDeletionLog = [];
  if (prevState && Array.isArray(prevState.payoutDeletionLog)) {
    payoutDeletionLog = prevState.payoutDeletionLog
      .filter(
        (e) =>
          e &&
          typeof e === 'object' &&
          e.serviceKey &&
          e.name &&
          typeof e.amount === 'number' &&
          typeof e.reason === 'string' &&
          e.reason.trim()
      )
      .map((e) => ({
        payoutId: typeof e.payoutId === 'string' ? e.payoutId : '',
        serviceKey: e.serviceKey,
        name: e.name,
        amount: Math.abs(Number(e.amount) || 0),
        at: e.at || new Date().toISOString(),
        byRole: e.byRole || null,
        byLogin: e.byLogin || null,
        reason: e.reason.trim(),
      }));
  } else if (payoutLog.length) {
    payoutDeletionLog = payoutLog
      .filter((e) => e.isDeleted && e.deleteReason)
      .map((e) => ({
        payoutId: e.id,
        serviceKey: e.serviceKey,
        name: e.name,
        amount: e.amount,
        at: e.deletedAt || e.at || new Date().toISOString(),
        byRole: e.deletedByRole || null,
        byLogin: e.deletedByLogin || null,
        reason: e.deleteReason,
      }));
  }

  let snapshots = [];
  if (prevState && Array.isArray(prevState.snapshots)) {
    snapshots = prevState.snapshots
      .filter((s) => s && typeof s === 'object' && s.balances && s.payoutLog && s.accrualLog)
      .slice(-5);
  }

  let auditLog = [];
  if (prevState && Array.isArray(prevState.auditLog)) {
    auditLog = prevState.auditLog
      .filter((e) => e && typeof e === 'object' && e.action && e.at)
      .slice(-1000);
  }

  return { balances, payoutLog, accrualLog, payoutDeletionLog, snapshots, auditLog };
}
