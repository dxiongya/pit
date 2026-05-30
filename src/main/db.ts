// db.ts — SQLite persistence for items + collections (single file at userData/pit.db).
//
// Schema is intentionally minimal: just enough columns for indexed lookups,
// the rest goes in a JSON `data` blob. This way the schema doesn't change
// every time the Item / Collection shape grows a field.

import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  const path = join(app.getPath('userData'), 'pit.db')
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      collection TEXT,
      kind TEXT,
      created_at INTEGER,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_items_collection ON items(collection);
    CREATE INDEX IF NOT EXISTS idx_items_created ON items(created_at);

    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      builtin INTEGER,
      data TEXT NOT NULL
    );
  `)
  _db = db
  return db
}

type Row = { data: string }

/** Parse a row's JSON blob, tolerating a single corrupt row instead of
 *  throwing and failing the entire list() call. Returns null for bad rows. */
function parseRow(data: string, table: string): unknown | null {
  try {
    return JSON.parse(data)
  } catch (e) {
    console.error(`[db] skipping corrupt ${table} row:`, e instanceof Error ? e.message : e)
    return null
  }
}

type ItemInput = {
  id: string
  collection?: string
  kind?: string
  createdAt?: number
  [k: string]: unknown
}
type CollectionInput = { id: string; builtin?: boolean; [k: string]: unknown }

export function listItems(): unknown[] {
  return (getDb().prepare('SELECT data FROM items ORDER BY created_at DESC').all() as Row[])
    .map((r) => parseRow(r.data, 'items'))
    .filter((v) => v !== null)
}

export function upsertItem(item: ItemInput): void {
  getDb()
    .prepare(
      'INSERT OR REPLACE INTO items (id, collection, kind, created_at, data) VALUES (?, ?, ?, ?, ?)'
    )
    .run(
      item.id,
      item.collection || null,
      item.kind || null,
      item.createdAt || Date.now(),
      JSON.stringify(item)
    )
}

export function deleteItem(id: string): void {
  getDb().prepare('DELETE FROM items WHERE id = ?').run(id)
}

export function listCollections(): unknown[] {
  return (getDb().prepare('SELECT data FROM collections').all() as Row[])
    .map((r) => parseRow(r.data, 'collections'))
    .filter((v) => v !== null)
}

export function upsertCollection(c: CollectionInput): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO collections (id, builtin, data) VALUES (?, ?, ?)')
    .run(c.id, c.builtin ? 1 : 0, JSON.stringify(c))
}

export function deleteCollection(id: string): void {
  getDb().prepare('DELETE FROM collections WHERE id = ?').run(id)
}
