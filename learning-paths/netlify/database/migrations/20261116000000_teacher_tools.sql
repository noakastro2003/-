-- Consent at sign-up, student reading settings,
-- parent report links, co-teachers on a class, and the read-aloud audio cache.
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS terms_accepted_at BIGINT;

-- Reading settings (font, size, spacing, contrast, calm), JSON. A class member's settings
-- apply to every path they enter through the class.
ALTER TABLE students ADD COLUMN IF NOT EXISTS reading TEXT NOT NULL DEFAULT '{}';
ALTER TABLE class_members ADD COLUMN IF NOT EXISTS reading TEXT NOT NULL DEFAULT '{}';

-- A secret link a teacher gives a parent: read-only progress of one child.
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_token TEXT;
ALTER TABLE class_members ADD COLUMN IF NOT EXISTS parent_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS students_parent_token ON students(parent_token);
CREATE UNIQUE INDEX IF NOT EXISTS class_members_parent_token ON class_members(parent_token);

-- Teachers who share a class with its owner: they see its students and progress and can
-- edit the class's paths. Only the owner deletes the class or changes who shares it.
CREATE TABLE IF NOT EXISTS class_teachers (
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT datetime('now'),
  PRIMARY KEY (class_id, teacher_id)
);
CREATE INDEX IF NOT EXISTS class_teachers_teacher ON class_teachers(teacher_id);

-- Natural read-aloud: one recording per (voice, text), shared by every student.
CREATE TABLE IF NOT EXISTS tts_cache (
  key TEXT PRIMARY KEY,                -- sha256 of model, voice and text
  media_id TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
