/**
 * Общие правила валидации входящих данных (согласованы с доменными ограничениями CRM).
 */

export const MAX_NAME_LEN = 50;
/** Сумма строго больше 0 и строго меньше 1 000 000 */
export const AMOUNT_MAX_EXCLUSIVE = 1_000_000;

export function validateName(name) {
  if (name === undefined || name === null) {
    return { ok: false, error: 'Имя обязательно' };
  }
  const s = String(name).trim();
  if (!s) return { ok: false, error: 'Имя обязательно' };
  if (s.length > MAX_NAME_LEN) {
    return { ok: false, error: `Имя не длиннее ${MAX_NAME_LEN} символов` };
  }
  return { ok: true, value: s };
}

export function validatePercent(percent, { required = true } = {}) {
  if (percent === undefined || percent === null || percent === '') {
    if (required) return { ok: false, error: 'Процент обязателен' };
    return { ok: true, value: undefined };
  }
  const n = Number(percent);
  if (!Number.isFinite(n)) return { ok: false, error: 'Некорректный процент' };
  if (n < 0 || n > 100) {
    return { ok: false, error: 'Процент должен быть от 0 до 100' };
  }
  return { ok: true, value: n };
}

/** Сумма: > 0 и < 1 000 000 */
export function validateAmountStrict(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return { ok: false, error: 'Некорректная сумма' };
  if (n <= 0 || n >= AMOUNT_MAX_EXCLUSIVE) {
    return {
      ok: false,
      error: 'Сумма должна быть больше 0 и меньше 1 000 000',
    };
  }
  return { ok: true, value: n };
}

const MAX_ID_LEN = 128;

export function validateUserIdParam(id) {
  if (id === undefined || id === null) return { ok: false, error: 'Нет id' };
  const s = String(id).trim();
  if (!s) return { ok: false, error: 'Нет id' };
  if (s.length > MAX_ID_LEN) return { ok: false, error: 'Некорректный id' };
  return { ok: true, value: s };
}

/** Логин: 3–30 символов, безопасный набор символов */
export function validateUsername(username) {
  const s = String(username ?? '').trim();
  if (s.length < 3 || s.length > 30) {
    return { ok: false, error: 'Логин: от 3 до 30 символов' };
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(s)) {
    return { ok: false, error: 'Логин: латиница, цифры, _, -, .' };
  }
  return { ok: true, value: s };
}

/** Пароль при входе: минимум 4 символа (пробелы по краям убираем — иначе ломается bcrypt) */
export function validatePasswordLogin(password) {
  const s = password != null ? String(password).trim() : '';
  if (s.length < 4) {
    return { ok: false, error: 'Пароль: минимум 4 символа' };
  }
  return { ok: true, value: s };
}

/** Пароль нового пользователя (admin создаёт): минимум 4 символа */
export function validatePasswordCreate(password) {
  return validatePasswordLogin(password);
}

export function validateRole(role) {
  if (role !== 'admin' && role !== 'employee') {
    return { ok: false, error: 'Роль должна быть admin или employee' };
  }
  return { ok: true, value: role };
}
