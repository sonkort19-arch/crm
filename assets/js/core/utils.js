/**
 * Общие константы и утилиты (без доступа к DOM и db).
 */

/** Совпадает с сервером: сумма строго меньше 1 000 000 */
export const MAX_MONEY = 999_999.99;
export const MAX_PERCENT = 100;
export const MAX_NAME_LEN = 50;

export function safeNumber(value, opts) {
  const o = opts || {};
  const min = o.min != null ? o.min : -Infinity;
  const max = o.max != null ? o.max : Infinity;
  const def = o.default !== undefined ? o.default : 0;
  const x = Number(value);
  if (!Number.isFinite(x)) return def;
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

export function roundMoney(n) {
  const x = safeNumber(n, { min: -MAX_MONEY, max: MAX_MONEY, default: 0 });
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

export function parseMoneyInput(str) {
  return safeNumber(str, { min: 0, max: MAX_MONEY, default: 0 });
}

/**
 * Парсинг даты из log.date (в т.ч. ru locale).
 */
export function parseLogDate(dateStr) {
  if (dateStr == null || dateStr === '') return null;
  const d = new Date(dateStr);
  if (!Number.isNaN(d.getTime())) return d;
  const m = String(dateStr).match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const year = parseInt(m[3], 10);
    const alt = new Date(year, month, day);
    if (!Number.isNaN(alt.getTime())) return alt;
  }
  return null;
}
