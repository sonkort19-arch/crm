/**
 * Доступ только для указанной роли (после requireAuth).
 */

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    if (req.auth.role !== role) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}
