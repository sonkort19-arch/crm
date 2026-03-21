/**
 * Логин, профиль, выход (клиент удаляет токен локально).
 */

import bcrypt from 'bcryptjs';
import {
  db,
  ensureAdminCredentials,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_ADMIN_PASSWORD,
} from '../database/db.js';
import { logger } from '../logger.js';
import { signToken } from './jwt.js';
import { validateUsername, validatePasswordLogin } from '../validation.js';

export async function login(req, res) {
  try {
    const uCheck = validateUsername(req.body?.username);
    if (!uCheck.ok) return res.status(400).json({ error: uCheck.error });
    const pCheck = validatePasswordLogin(req.body?.password);
    if (!pCheck.ok) return res.status(400).json({ error: pCheck.error });

    const username = uCheck.value;
    const password = pCheck.value;

    const selectUser = () =>
      db
        .prepare(
          `SELECT id, username, passwordHash, name, role FROM users WHERE lower(username) = lower(?)`
        )
        .get(username);

    let row = selectUser();
    if ((!row || !row.passwordHash) && username === DEFAULT_ADMIN_USERNAME) {
      ensureAdminCredentials();
      row = selectUser();
    }
    if (!row || !row.passwordHash) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    let isMatch = bcrypt.compareSync(password, row.passwordHash);
    if (
      !isMatch &&
      username === DEFAULT_ADMIN_USERNAME &&
      password === DEFAULT_ADMIN_PASSWORD
    ) {
      ensureAdminCredentials();
      const row2 = selectUser();
      if (row2?.passwordHash) {
        isMatch = bcrypt.compareSync(password, row2.passwordHash);
      }
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    if (row.role !== 'admin' && row.role !== 'employee') {
      return res.status(403).json({ error: 'Роль не поддерживается' });
    }

    const token = signToken({
      userId: row.id,
      username: row.username,
      role: row.role,
    });

    logger.operation('auth.login', { userId: row.id, username: row.username, role: row.role });

    return res.json({
      token,
      user: {
        id: row.id,
        username: row.username,
        name: row.name,
        role: row.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

export function me(req, res) {
  try {
    const { userId } = req.auth;
    const row = db
      .prepare(`SELECT id, username, name, role FROM users WHERE id = ?`)
      .get(userId);
    if (!row) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    if (row.role !== 'admin' && row.role !== 'employee') {
      return res.status(403).json({ error: 'Роль не поддерживается' });
    }
    return res.json({
      user: {
        id: row.id,
        username: row.username,
        name: row.name,
        role: row.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
}

export function logout(req, res) {
  logger.operation('auth.logout', { userId: req.auth?.userId });
  res.json({ ok: true });
}
