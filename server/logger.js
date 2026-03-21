/**
 * Простое логирование: консоль с временной меткой, ошибки, запросы, операции.
 */

function ts() {
  return new Date().toISOString();
}

function line(level, msg, meta) {
  const extra = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  console.log(`[${ts()}] [${level}] ${msg}${extra}`);
}

export const logger = {
  info(msg, meta) {
    line('INFO', msg, meta);
  },
  warn(msg, meta) {
    line('WARN', msg, meta);
  },
  error(err, meta = {}) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    line('ERROR', message, { ...meta, stack });
  },
  /** Завершённый HTTP-запрос */
  request(req, res, durationMs) {
    line('HTTP', `${req.method} ${req.originalUrl}`, {
      status: res.statusCode,
      ms: durationMs,
      ip: req.ip,
    });
  },
  /** Бизнес-операция (начисление, удаление и т.д.) */
  operation(action, detail = {}) {
    line('OP', action, detail);
  },
};
