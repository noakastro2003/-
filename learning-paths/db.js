import { DatabaseSync } from 'node:sqlite';
import { BILLING_DEFAULTS } from './billing.js';
import { randomPin } from './logic.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS paths (
  id INTEGER PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL UNIQUE,
  theme TEXT NOT NULL DEFAULT '{}',
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  path_id INTEGER NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '',
  est_minutes INTEGER NOT NULL DEFAULT 5,
  content TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS tasks_path ON tasks(path_id, position);
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY,
  path_id INTEGER NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_active TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (path_id, name)
);
CREATE TABLE IF NOT EXISTS progress (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  answer TEXT,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (student_id, task_id)
);
CREATE TABLE IF NOT EXISTS credit_ledger (
  id INTEGER PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  action TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS credit_ledger_teacher ON credit_ledger(teacher_id, id);
CREATE TABLE IF NOT EXISTS help_requests (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved INTEGER NOT NULL DEFAULT 0
);
`;

export function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

// Columns added after the first release. Teachers who signed up before credits existed
// get the same free credits a new teacher gets.
function migrate(db) {
  const cols = new Set(db.prepare('PRAGMA table_info(teachers)').all().map((c) => c.name));
  if (!cols.has('credits')) {
    db.exec('ALTER TABLE teachers ADD COLUMN credits INTEGER NOT NULL DEFAULT 0');
    db.prepare('UPDATE teachers SET credits = ?').run(BILLING_DEFAULTS.freeCredits);
  }
  if (!cols.has('sub_status')) db.exec('ALTER TABLE teachers ADD COLUMN sub_status TEXT');
  if (!cols.has('sub_period_end')) db.exec('ALTER TABLE teachers ADD COLUMN sub_period_end TEXT');
  if (!cols.has('sub_credits_left')) db.exec('ALTER TABLE teachers ADD COLUMN sub_credits_left INTEGER NOT NULL DEFAULT 0');

  // Teacher approval: tasks that stop the student, each path's approval code, and
  // progress rows waiting for approval (approved = 0).
  const has = (table, col) => db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
  if (!has('tasks', 'needs_approval')) db.exec('ALTER TABLE tasks ADD COLUMN needs_approval INTEGER NOT NULL DEFAULT 0');
  if (!has('progress', 'approved')) db.exec('ALTER TABLE progress ADD COLUMN approved INTEGER NOT NULL DEFAULT 1');
  if (!has('paths', 'approval_pin')) {
    db.exec('ALTER TABLE paths ADD COLUMN approval_pin TEXT');
    const set = db.prepare('UPDATE paths SET approval_pin = ? WHERE id = ?');
    for (const { id } of db.prepare('SELECT id FROM paths').all()) set.run(randomPin(), id);
  }
}

// Run fn inside a transaction; rolls back on throw.
export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
