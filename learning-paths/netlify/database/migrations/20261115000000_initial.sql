-- The whole schema of "מסלולי למידה". Netlify applies this on the first deploy; local
-- databases (PGlite) apply it on startup, so every statement must be safe to run twice.
-- Dates are kept as text "YYYY-MM-DD HH:MM:SS" (UTC); millisecond timestamps are BIGINT.

CREATE OR REPLACE FUNCTION datetime(text) RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') $$;

CREATE TABLE IF NOT EXISTS teachers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,              -- stored lowercase
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT datetime('now'),
  credits BIGINT NOT NULL DEFAULT 0,
  sub_status TEXT,
  sub_period_end TEXT,
  sub_credits_left BIGINT NOT NULL DEFAULT 0,
  discount_percent BIGINT NOT NULL DEFAULT 0,  -- from a discount code, for the next payment
  discount_code TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS paths (
  id BIGSERIAL PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL UNIQUE,
  theme TEXT NOT NULL DEFAULT '{}',
  published BIGINT NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT datetime('now'),
  updated_at TEXT NOT NULL DEFAULT datetime('now'),
  approval_pin TEXT,
  opens_at BIGINT,
  closes_at BIGINT,
  shared BIGINT NOT NULL DEFAULT 0,
  shared_grade TEXT NOT NULL DEFAULT '',
  shared_subject TEXT NOT NULL DEFAULT '',
  shared_at BIGINT,
  copies BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS paths_teacher ON paths(teacher_id);
CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  path_id BIGINT NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  position BIGINT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '',
  est_minutes BIGINT NOT NULL DEFAULT 5,
  content TEXT NOT NULL DEFAULT '{}',
  needs_approval BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS tasks_path ON tasks(path_id, position);
CREATE TABLE IF NOT EXISTS classes (
  id BIGSERIAL PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT datetime('now')
);
CREATE TABLE IF NOT EXISTS class_paths (
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  path_id BIGINT NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  position BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (class_id, path_id)
);
CREATE TABLE IF NOT EXISTS class_members (
  id BIGSERIAL PRIMARY KEY,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '',
  secret_hash TEXT,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT datetime('now'),
  last_active TEXT NOT NULL DEFAULT datetime('now')
);
CREATE UNIQUE INDEX IF NOT EXISTS class_members_name ON class_members(class_id, lower(name));
CREATE TABLE IF NOT EXISTS students (
  id BIGSERIAL PRIMARY KEY,
  path_id BIGINT NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT datetime('now'),
  last_active TEXT NOT NULL DEFAULT datetime('now'),
  class_member_id BIGINT REFERENCES class_members(id) ON DELETE SET NULL,
  secret_hash TEXT,
  avatar TEXT NOT NULL DEFAULT '',
  hidden_tasks TEXT NOT NULL DEFAULT '[]',
  break_every BIGINT
);
CREATE UNIQUE INDEX IF NOT EXISTS students_name ON students(path_id, lower(name));
CREATE INDEX IF NOT EXISTS students_member ON students(class_member_id);
CREATE TABLE IF NOT EXISTS progress (
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  answer TEXT,
  completed_at TEXT NOT NULL DEFAULT datetime('now'),
  approved BIGINT NOT NULL DEFAULT 1,
  duration_sec BIGINT,
  PRIMARY KEY (student_id, task_id)
);
CREATE TABLE IF NOT EXISTS credit_ledger (
  id BIGSERIAL PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  delta BIGINT NOT NULL,
  action TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT datetime('now')
);
CREATE INDEX IF NOT EXISTS credit_ledger_teacher ON credit_ledger(teacher_id, id);
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  used BIGINT NOT NULL DEFAULT 0
);
-- Pictures and recordings. data is NULL when the bytes live in Netlify Blobs.
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  mime TEXT NOT NULL,
  size BIGINT NOT NULL,
  data BYTEA,
  created_at TEXT NOT NULL DEFAULT datetime('now')
);
CREATE INDEX IF NOT EXISTS media_teacher ON media(teacher_id);
CREATE TABLE IF NOT EXISTS task_attempts (
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  opened_at BIGINT NOT NULL,
  wrong BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, task_id)
);
CREATE TABLE IF NOT EXISTS help_requests (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT datetime('now'),
  resolved BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS moods (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,          -- 'start' or 'end'
  mood TEXT NOT NULL,
  at BIGINT NOT NULL           -- ms since epoch
);
CREATE INDEX IF NOT EXISTS moods_student ON moods(student_id, at);

-- Codes the site owner hands out: a free subscription, extra credits, or a discount.
CREATE TABLE IF NOT EXISTS promo_codes (
  code TEXT PRIMARY KEY,               -- stored uppercase
  kind TEXT NOT NULL,                  -- 'free_months' | 'credits' | 'discount'
  amount BIGINT NOT NULL,              -- months, credits, or percent
  max_uses BIGINT,                     -- NULL = unlimited
  uses BIGINT NOT NULL DEFAULT 0,
  expires_at BIGINT,                   -- ms since epoch; NULL = never
  note TEXT NOT NULL DEFAULT '',
  active BIGINT NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT datetime('now')
);
CREATE TABLE IF NOT EXISTS promo_redemptions (
  code TEXT NOT NULL REFERENCES promo_codes(code) ON DELETE CASCADE,
  teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT datetime('now'),
  PRIMARY KEY (code, teacher_id)
);

-- Request limits (login attempts, AI calls…) shared by all server instances.
CREATE TABLE IF NOT EXISTS rate_hits (
  bucket TEXT NOT NULL,
  at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_hits_bucket ON rate_hits(bucket, at);
