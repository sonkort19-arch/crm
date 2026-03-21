/**
 * Проверка JWT Bearer и установка req.auth.
 */

import { verifyToken } from './jwt.js';

export function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || typeof h !== 'string') {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m || !m[1] || !m[1].trim()) {
    return res.status(401).json({ error: 'Некорректный заголовок Authorization' });
  }
  const raw = m[1].trim();
  if (!raw) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  try {
    const decoded = verifyToken(raw);
    const userId = decoded.userId;
    const username = decoded.username;
    const role = decoded.role;
    if (!userId || !username || (role !== 'admin' && role !== 'employee')) {
      return res.status(401).json({ error: 'Недействительный токен' });
    }
    req.auth = { userId: String(userId), username: String(username), role };
    req.authToken = raw;
    next();
  } catch {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}
