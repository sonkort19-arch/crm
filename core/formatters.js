export function toNumber(value) {
  if (value === '' || value === null || value === undefined) return 0;
  return Number(String(value).replace(',', '.')) || 0;
}

export function formatMoney(num) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatPercentForMessage(total) {
  const x = Math.round(total * 100) / 100;
  if (Number.isInteger(x)) return String(x);
  return String(x);
}

export function formatDateInputValue(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateInputValue(str) {
  if (!str || typeof str !== 'string') return null;
  const p = str.split('-');
  if (p.length !== 3) return null;
  const y = Number(p[0]);
  const m = Number(p[1]);
  const d = Number(p[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d);
}

export function formatDateTimeRu(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

