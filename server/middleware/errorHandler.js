import { logger } from '../logger.js';

export function errorHandler(err, req, res, _next) {
  if (
    err.type === 'entity.parse.failed' ||
    (err instanceof SyntaxError && err.status === 400 && 'body' in err)
  ) {
    return res.status(400).json({ error: 'Некорректный JSON' });
  }
  logger.error(err);
  res.status(500).json({ error: 'Server error' });
}
