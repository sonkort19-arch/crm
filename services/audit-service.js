export function ensureAuditLog(state) {
  if (!Array.isArray(state.auditLog)) state.auditLog = [];
}

export function pushAuditLog(state, entry) {
  ensureAuditLog(state);
  state.auditLog.push({
    at: new Date().toISOString(),
    action: entry.action,
    byRole: entry.byRole || null,
    byLogin: entry.byLogin || null,
    meta: entry.meta || {},
  });
}

export function makeCsv(rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replaceAll('"', '""')}"`;
    }
    return s;
  };
  return rows.map((row) => row.map(esc).join(',')).join('\n');
}

