/**
 * Доменная логика и доступ к БД (без Express-специфики в чистых функциях).
 */

import bcrypt from 'bcryptjs';
import { db } from '../database/db.js';
import { logger } from '../logger.js';
import {
  validateName,
  validatePercent,
  validateAmountStrict,
  validateUserIdParam,
  validateUsername,
  validatePasswordCreate,
  AMOUNT_MAX_EXCLUSIVE,
} from '../validation.js';

const MAX_MONEY = AMOUNT_MAX_EXCLUSIVE - 0.01;

function roundMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round((Math.min(MAX_MONEY, Math.max(-MAX_MONEY, x)) + Number.EPSILON) * 100) / 100;
}

function rowToLog(row) {
  return {
    id: row.id,
    type: row.type,
    amount: roundMoney(row.amount),
    date: String(row.date || ''),
  };
}

function assertOwnerOrAdmin(req, targetUserId) {
  if (req.auth.role === 'admin') return true;
  return req.auth.userId === targetUserId;
}

export function listUsers(req, res, next) {
  try {
    const auth = req.auth;
    let users;
    if (auth.role === 'admin') {
      users = db.prepare('SELECT id, name, percent FROM users ORDER BY id').all();
    } else {
      users = db.prepare('SELECT id, name, percent FROM users WHERE id = ?').all(auth.userId);
    }
    const logStmt = db.prepare(
      'SELECT id, type, amount, date FROM logs WHERE userId = ? ORDER BY id ASC'
    );
    const payload = users.map((u) => ({
      id: u.id,
      name: u.name,
      percent: roundMoney(u.percent),
      logs: logStmt.all(u.id).map(rowToLog),
    }));
    res.json({ users: payload });
  } catch (e) {
    next(e);
  }
}

export function createUser(req, res, next) {
  try {
    const nameCheck = validateName(req.body?.name);
    if (!nameCheck.ok) return res.status(400).json({ error: nameCheck.error });
    const pctCheck = validatePercent(req.body?.percent, { required: true });
    if (!pctCheck.ok) return res.status(400).json({ error: pctCheck.error });
    const userCheck = validateUsername(req.body?.username);
    if (!userCheck.ok) return res.status(400).json({ error: userCheck.error });
    const passCheck = validatePasswordCreate(req.body?.password);
    if (!passCheck.ok) return res.status(400).json({ error: passCheck.error });

    const name = nameCheck.value;
    const percent = pctCheck.value;
    const username = userCheck.value;
    const password = passCheck.value;
    const id = String(Date.now());
    const hash = bcrypt.hashSync(password, 10);
    try {
      db.prepare(
        `INSERT INTO users (id, name, percent, username, passwordHash, role)
         VALUES (?, ?, ?, ?, ?, 'employee')`
      ).run(id, name, roundMoney(percent), username, hash);
    } catch (e) {
      if (e && (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || String(e.message || '').includes('UNIQUE'))) {
        return res.status(400).json({ error: 'Такой логин уже занят' });
      }
      throw e;
    }
    logger.operation('user.create', { id, name, username });
    res.status(201).json({
      user: { id, name, percent: roundMoney(percent), logs: [] },
    });
  } catch (e) {
    next(e);
  }
}

export function updateUser(req, res, next) {
  try {
    const idCheck = validateUserIdParam(req.params.id);
    if (!idCheck.ok) return res.status(400).json({ error: idCheck.error });
    const id = idCheck.value;

    const row = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Не найден' });

    const nameIn = req.body?.name;
    const percentIn = req.body?.percent;
    const updates = [];
    const vals = [];

    if (nameIn !== undefined) {
      const nameCheck = validateName(nameIn);
      if (!nameCheck.ok) return res.status(400).json({ error: nameCheck.error });
      updates.push('name = ?');
      vals.push(nameCheck.value);
    }
    if (percentIn !== undefined) {
      const pctCheck = validatePercent(percentIn, { required: true });
      if (!pctCheck.ok) return res.status(400).json({ error: pctCheck.error });
      updates.push('percent = ?');
      vals.push(roundMoney(pctCheck.value));
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }
    vals.push(id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...vals);

    logger.operation('user.update', { id, fields: updates.map((u) => u.split(' ')[0]) });

    const u = db.prepare('SELECT id, name, percent FROM users WHERE id = ?').get(id);
    const logs = db
      .prepare('SELECT id, type, amount, date FROM logs WHERE userId = ? ORDER BY id ASC')
      .all(id)
      .map(rowToLog);
    res.json({ user: { ...u, percent: roundMoney(u.percent), logs } });
  } catch (e) {
    next(e);
  }
}

export function deleteUser(req, res, next) {
  try {
    const idCheck = validateUserIdParam(req.params.id);
    if (!idCheck.ok) return res.status(400).json({ error: idCheck.error });
    const id = idCheck.value;

    const n = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    if (n <= 1) {
      return res.status(400).json({ error: 'Нельзя удалить последнего сотрудника' });
    }
    const r = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    if (r.changes === 0) return res.status(404).json({ error: 'Не найден' });
    logger.operation('user.delete', { id });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export function getLogsByUserId(req, res, next) {
  try {
    const idCheck = validateUserIdParam(req.params.userId);
    if (!idCheck.ok) return res.status(400).json({ error: idCheck.error });
    const userId = idCheck.value;

    if (!assertOwnerOrAdmin(req, userId)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const u = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
    const rows = db
      .prepare('SELECT id, type, amount, date FROM logs WHERE userId = ? ORDER BY id ASC')
      .all(userId);
    res.json({ logs: rows.map(rowToLog) });
  } catch (e) {
    next(e);
  }
}

export function createLog(req, res, next) {
  try {
    const userIdRaw = req.body?.userId;
    const userId = String(userIdRaw ?? '').trim();
    if (!userId) return res.status(400).json({ error: 'userId обязателен' });
    if (userId.length > 128) return res.status(400).json({ error: 'Некорректный userId' });

    if (req.auth.role === 'employee' && userId !== req.auth.userId) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const type = req.body?.type;
    const amountRaw = req.body?.amount;
    const dateStr = req.body?.date != null ? String(req.body.date).slice(0, 200) : new Date().toLocaleString();

    const u = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
    if (type !== 'income' && type !== 'withdraw') {
      return res.status(400).json({ error: 'type должен быть income или withdraw' });
    }

    const amtCheck = validateAmountStrict(amountRaw);
    if (!amtCheck.ok) return res.status(400).json({ error: amtCheck.error });
    const amount = roundMoney(amtCheck.value);

    const info = db
      .prepare('INSERT INTO logs (userId, type, amount, date) VALUES (?, ?, ?, ?)')
      .run(userId, type, amount, dateStr);
    logger.operation('log.create', { userId, type, amount, logId: info.lastInsertRowid });
    res.status(201).json({
      log: { id: info.lastInsertRowid, type, amount, date: dateStr },
    });
  } catch (e) {
    next(e);
  }
}

function nowLocaleString() {
  return new Date().toLocaleString();
}

/** Распределить сумму по всем сотрудникам по процентам. */
export function distributeIncome(req, res, next) {
  try {
    const poolCheck = validateAmountStrict(req.body?.amount);
    if (!poolCheck.ok) return res.status(400).json({ error: poolCheck.error });
    const pool = roundMoney(poolCheck.value);

    const users = db.prepare('SELECT id, percent FROM users').all();
    const insert = db.prepare(
      'INSERT INTO logs (userId, type, amount, date) VALUES (?, ?, ?, ?)'
    );
    const runMany = db.transaction(() => {
      for (const u of users) {
        const pr = roundMoney(u.percent);
        if (!Number.isFinite(pr) || pr <= 0) continue;
        const amount = roundMoney((pool * pr) / 100);
        if (amount <= 0) continue;
        insert.run(u.id, 'income', amount, nowLocaleString());
      }
    });
    runMany();
    logger.operation('income.distribute', { pool });
    listUsers(req, res, next);
  } catch (e) {
    next(e);
  }
}

/** Начисление от «грязной» суммы по проценту сотрудника. */
export function addUserIncomeFromGross(req, res, next) {
  try {
    const idCheck = validateUserIdParam(req.params.id);
    if (!idCheck.ok) return res.status(400).json({ error: idCheck.error });
    const userId = idCheck.value;

    if (!assertOwnerOrAdmin(req, userId)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const grossCheck = validateAmountStrict(req.body?.gross);
    if (!grossCheck.ok) return res.status(400).json({ error: grossCheck.error });
    const gross = roundMoney(grossCheck.value);

    const u = db.prepare('SELECT id, percent FROM users WHERE id = ?').get(userId);
    if (!u) return res.status(404).json({ error: 'Не найден' });
    const percent = roundMoney(u.percent);
    if (!Number.isFinite(percent) || percent <= 0) {
      return res.status(400).json({ error: 'Некорректный процент' });
    }
    const amount = roundMoney((gross * percent) / 100);
    db.prepare('INSERT INTO logs (userId, type, amount, date) VALUES (?, ?, ?, ?)').run(
      userId,
      'income',
      amount,
      nowLocaleString()
    );
    logger.operation('income.user_gross', { userId, gross, amount });
    listUsers(req, res, next);
  } catch (e) {
    next(e);
  }
}

export function addWithdraw(req, res, next) {
  try {
    const idCheck = validateUserIdParam(req.params.id);
    if (!idCheck.ok) return res.status(400).json({ error: idCheck.error });
    const userId = idCheck.value;

    if (!assertOwnerOrAdmin(req, userId)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const amtCheck = validateAmountStrict(req.body?.amount);
    if (!amtCheck.ok) return res.status(400).json({ error: amtCheck.error });
    const amount = roundMoney(amtCheck.value);

    const u = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!u) return res.status(404).json({ error: 'Не найден' });
    db.prepare('INSERT INTO logs (userId, type, amount, date) VALUES (?, ?, ?, ?)').run(
      userId,
      'withdraw',
      amount,
      nowLocaleString()
    );
    logger.operation('withdraw.create', { userId, amount });
    listUsers(req, res, next);
  } catch (e) {
    next(e);
  }
}
