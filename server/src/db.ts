import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export type DB = Database.Database;

/** Resolve the schema file in both tsx (src/) and compiled (dist-server/) layouts. */
function schemaPath(): string {
  for (const candidate of [
    path.join(here, 'schema.sql'),
    path.join(here, '..', '..', 'server', 'src', 'schema.sql'),
    path.resolve(process.cwd(), 'server/src/schema.sql'),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('schema.sql not found — run from the project root or rebuild the server.');
}

export function openDatabase(file: string): DB {
  if (file !== ':memory:') {
    const dir = path.dirname(path.resolve(file));
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  return db;
}

export function migrate(db: DB): number {
  const sql = fs.readFileSync(schemaPath(), 'utf8');
  db.exec(sql);
  // Additive migrations: safe to run on databases created by earlier versions.
  const addColumn = (table: string, column: string, ddl: string) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!columns.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  };
  addColumn('attempt_questions', 'snapshot_qtype', "snapshot_qtype TEXT NOT NULL DEFAULT 'single'");
  addColumn('attempt_questions', 'snapshot_image_url', 'snapshot_image_url TEXT');
  addColumn('attempt_questions', 'snapshot_explanation_en', 'snapshot_explanation_en TEXT');
  addColumn('attempt_questions', 'snapshot_explanation_hi', 'snapshot_explanation_hi TEXT');
  addColumn('attempt_answers', 'last_viewed_at', 'last_viewed_at TEXT');
  addColumn('tests', 'subject_id', 'subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL');
  addColumn('tests', 'topic_id', 'topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL');
  addColumn('tests', 'is_listed', 'is_listed INTEGER NOT NULL DEFAULT 1');
  db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (1)').run();
  db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (2)').run();
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_version').get() as { v: number };
  return row.v;
}

export function transaction<T>(db: DB, fn: () => T): T {
  return db.transaction(fn)();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoAfter(seconds: number, from = Date.now()): string {
  return new Date(from + seconds * 1000).toISOString();
}

/** Remaining seconds derived from an authoritative stored deadline (never a local counter). */
export function remainingSeconds(deadlineIso: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(deadlineIso) - now) / 1000));
}

export function isExpired(deadlineIso: string, now = Date.now()): boolean {
  return Date.parse(deadlineIso) <= now;
}

export function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Stable hash used for duplicate-question detection; not used for security. */
export function contentHash(parts: string[]): string {
  const normalized = parts
    .map((p) => (p || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:!?]/g, '').trim())
    .join('|');
  let h = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function paginate(page?: unknown, limit?: unknown) {
  const p = Math.max(1, Math.min(100000, Number(page) || 1));
  const l = Math.max(1, Math.min(200, Number(limit) || 20));
  return { page: p, limit: l, offset: (p - 1) * l };
}
