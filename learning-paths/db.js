// The database: Postgres. In production (Netlify) it is Netlify Database; on a developer's
// computer and in the tests it is PGlite, a real Postgres engine running inside Node.
// The schema lives in netlify/database/migrations/*.sql: Netlify applies those files on
// deploy, and openDb() applies them to a local database.
//
// The interface mirrors the old SQLite one, but every call returns a promise:
//   const st = db.prepare('SELECT * FROM teachers WHERE id = ?');
//   await st.get(id) → row | undefined;   await st.all(...) → rows;
//   await st.run(...) → { changes, lastInsertRowid }
//   await tx(db, async () => { ... })   — statements inside run in one transaction.
import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.join(here, 'netlify', 'database', 'migrations');

// int8 (COUNT, BIGINT columns) and numeric (SUM) come back as numbers. All values we
// store fit easily in a double (ids, credits, millisecond timestamps).
const INT8 = 20;
const NUMERIC = 1700;

// SQLite-style placeholders → Postgres: "?" → $1, $2…, and "?1" → $1.
export function toPg(sql) {
  let n = 0;
  return sql.replace(/\?(\d+)?/g, (_, num) => `$${num || ++n}`);
}

export function migrationFiles(dir = MIGRATIONS_DIR) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.isFile() && e.name.endsWith('.sql')) out.push(path.join(dir, e.name));
    else if (e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'migration.sql'))) out.push(path.join(dir, e.name, 'migration.sql'));
  }
  return out;
}

function makeDb(backend) {
  const als = new AsyncLocalStorage();
  const exec = async (sql, params = []) => {
    await backend.ready;
    const runner = als.getStore() || backend;
    return runner.query(toPg(sql), params);
  };
  const db = {
    kind: backend.kind,
    ready: backend.ready,
    exec: (sql) => backend.ready.then(() => (als.getStore() || backend).execRaw(sql)),
    prepare(sql) {
      const text = sql.trim();
      // Inserts report the new row's id, like SQLite's lastInsertRowid.
      const isInsert = /^insert\s/i.test(text) && !/\breturning\b/i.test(text);
      const q = isInsert ? `${text} RETURNING *` : text;
      return {
        get: async (...p) => (await exec(q, p)).rows[0],
        all: async (...p) => (await exec(q, p)).rows,
        run: async (...p) => {
          const r = await exec(q, p);
          return { changes: r.rowCount, lastInsertRowid: r.rows?.[0]?.id ?? null };
        },
      };
    },
    async transaction(fn) {
      if (als.getStore()) return fn(); // already inside one
      return backend.transaction((client) => als.run(client, fn));
    },
    close: () => backend.close(),
  };
  return db;
}

// Run fn inside a transaction; rolls back if it throws.
export const tx = (db, fn) => db.transaction(fn);

// ---------- PGlite (local + tests) ----------

function pgliteBackend(dataDir) {
  let pg;
  const ready = (async () => {
    // Not a literal import: the hosted build must not bundle PGlite (it is for local runs only).
    const pkg = '@electric-sql/pglite';
    const { PGlite } = await import(pkg);
    pg = new PGlite(dataDir || undefined, { parsers: { [INT8]: Number, [NUMERIC]: Number } });
    await pg.waitReady;
    for (const f of migrationFiles()) await pg.exec(fs.readFileSync(f, 'utf8'));
  })();
  const wrap = (r) => ({ rows: r.rows.map(fixRow), rowCount: r.affectedRows ?? r.rows.length });
  let queue = Promise.resolve(); // PGlite has one connection: transactions take turns
  return {
    kind: 'pglite',
    ready,
    query: async (sql, params) => wrap(await pg.query(sql, params)),
    execRaw: (sql) => pg.exec(sql),
    transaction(fn) {
      const run = queue.then(() => pg.transaction((t) => fn({
        query: async (sql, params) => wrap(await t.query(sql, params)),
        execRaw: (sql) => t.exec(sql),
      })));
      queue = run.catch(() => {});
      return run;
    },
    close: () => ready.then(() => pg.close()),
  };
}

// PGlite returns bytea as Uint8Array; the code expects Buffers, like pg does.
function fixRow(row) {
  for (const k in row) if (row[k] instanceof Uint8Array && !Buffer.isBuffer(row[k])) row[k] = Buffer.from(row[k]);
  return row;
}

// ---------- node-postgres (production) ----------

function pgBackend(connectionString) {
  let pool;
  const ready = (async () => {
    const { default: pg } = await import('pg');
    pg.types.setTypeParser(INT8, Number);
    pg.types.setTypeParser(NUMERIC, Number);
    pool = new pg.Pool({ connectionString, max: 3, idleTimeoutMillis: 10_000 });
  })();
  return {
    kind: 'postgres',
    ready,
    query: (sql, params) => pool.query(sql, params),
    execRaw: (sql) => pool.query(sql),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn({ query: (sql, params) => client.query(sql, params), execRaw: (sql) => client.query(sql) });
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => ready.then(() => pool.end()),
  };
}

// openDb(':memory:') or openDb('data/pg') → PGlite; openDb({ url }) → a Postgres server.
// Returns at once; the first query waits until the database is ready.
export function openDb(target = ':memory:') {
  if (typeof target === 'object' && target?.url) return makeDb(pgBackend(target.url));
  return makeDb(pgliteBackend(target === ':memory:' ? null : target));
}
