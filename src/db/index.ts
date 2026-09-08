import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import fs from 'fs';

// Embedded file database — no external PostgreSQL server required.
// The desktop .exe points DB_FILE to its per-user data directory.
const dbFile =
  process.env.DB_FILE && process.env.DB_FILE !== ':memory:'
    ? process.env.DB_FILE
    : path.join(process.cwd(), 'data', 'yawareleasebot.db');

if (dbFile !== ':memory:') {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
}

const sqlite = new Database(dbFile);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Idempotent schema bootstrap — works everywhere (web server and packaged .exe)
// without requiring `drizzle-kit push` at runtime.
sqlite.exec(`
CREATE TABLE IF NOT EXISTS sync_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  source_repo_owner TEXT NOT NULL,
  source_repo_name TEXT NOT NULL,
  source_token TEXT NOT NULL,
  dest_repo_owner TEXT NOT NULL,
  dest_repo_name TEXT NOT NULL,
  dest_token TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  asset_filter TEXT NOT NULL DEFAULT '.exe',
  update_readme INTEGER NOT NULL DEFAULT 1,
  last_sync_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_id INTEGER NOT NULL REFERENCES sync_configs(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  release_name TEXT,
  status TEXT NOT NULL,
  message TEXT,
  synced_assets TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);
`);

export const db = drizzle(sqlite);
export { sqlite };
