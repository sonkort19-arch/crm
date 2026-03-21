import { logger } from '../logger.js';

/** Логирование каждого запроса после ответа */
export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    logger.request(req, res, Date.now() - start);
  });
  next();
}

/**
 * Отклонить POST/PUT/PATCH с Content-Type: application/json и нулевой длиной тела.
 * (пустой объект {} проходит — его обрабатывает валидация полей)
 */
export function rejectEmptyJsonBody(req, res, next) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();
  const ct = req.headers['content-type'] || '';
  if (!ct.includes('application/json')) return next();
  const len = req.headers['content-length'];
  if (len === '0') {
    return res.status(400).json({ error: 'Пустое тело запроса' });
  }
  next();
}
