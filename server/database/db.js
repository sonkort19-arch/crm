import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'crm.sqlite');
export const db = new Database(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    percent REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_logs_user ON logs(userId);
`);

function columnNames(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

function migrateUsersAuth() {
  const cols = columnNames('users');
  if (!cols.includes('username')) {
    db.exec('ALTER TABLE users ADD COLUMN username TEXT');
  }
  if (!cols.includes('passwordHash')) {
    db.exec('ALTER TABLE users ADD COLUMN passwordHash TEXT');
  }
  if (!cols.includes('role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'employee'");
  }

  try {
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)
       WHERE username IS NOT NULL AND trim(username) != ''`
    );
  } catch {
    /* ignore duplicate index name races */
  }

  const defaultHash = bcrypt.hashSync('1234', 10);
  const rows = db.prepare('SELECT id, name, percent, username, passwordHash, role FROM users').all();
  for (const r of rows) {
    const needUsername = r.username == null || String(r.username).trim() === '';
    const needHash = r.passwordHash == null || String(r.passwordHash).trim() === '';
    if (!needUsername && !needHash) continue;
    const uname = !needUsername ? String(r.username).trim() : String(r.id);
    const hash = needHash ? defaultHash : r.passwordHash;
    const role = r.role && String(r.role).trim() !== '' ? r.role : 'employee';
    db.prepare('UPDATE users SET username = ?, passwordHash = ?, role = ? WHERE id = ?').run(
      uname,
      hash,
      role,
      r.id
    );
  }
}

migrateUsersAuth();

const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (count === 0) {
  const h = bcrypt.hashSync('1234', 10);
  const ins = db.prepare(
    `INSERT INTO users (id, name, percent, username, passwordHash, role) VALUES (?, ?, ?, ?, ?, ?)`
  );
  ins.run('yuri', 'Юрий', 10, 'yuri', h, 'employee');
  ins.run('alex', 'Алекс', 10, 'alex', h, 'employee');
  ins.run('erika', 'Эрика', 10, 'erika', h, 'employee');
}

const hasAdminAfterSeed = db.prepare("SELECT 1 AS x FROM users WHERE lower(username) = 'admin' LIMIT 1").get();
if (!hasAdminAfterSeed) {
  db.prepare(
    `INSERT INTO users (id, name, percent, username, passwordHash, role)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run('admin', 'Администратор', 0, 'admin', bcrypt.hashSync('1234', 10), 'admin');
}

/** Страховка: пустая БД (например Render / сброс тома) — минимум admin / 1234 */
const finalCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (finalCount === 0) {
  const h = bcrypt.hashSync('1234', 10);
  db.prepare(
    `INSERT INTO users (id, name, percent, username, passwordHash, role) VALUES (?, ?, ?, ?, ?, ?)`
  ).run('admin', 'Администратор', 0, 'admin', h, 'admin');
}
