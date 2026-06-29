import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { env } from './config/env.js'

const dbPath = env.DB_PATH
mkdirSync(dirname(dbPath), { recursive: true })

export const db = new Database(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS keys (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    acronym        TEXT UNIQUE NOT NULL,
    name           TEXT NOT NULL,
    api_key        TEXT UNIQUE NOT NULL,
    webhook_url    TEXT NOT NULL,
    webhook_secret TEXT NOT NULL,
    active         INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

export interface KeyRow {
  id: number
  acronym: string
  name: string
  api_key: string
  webhook_url: string
  webhook_secret: string
  active: number
  created_at: string
}
