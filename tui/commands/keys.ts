import { BaseCommand } from '@dbwebb/tui'
import { randomBytes } from 'node:crypto'
import { db } from '../../src/db.js'
import type { KeyRow } from '../../src/db.js'

export class KeysCommands extends BaseCommand {
  static descriptions = {
    list: 'list                                              List all keys',
    create: 'create <acronym> <name> <webhook-url> <secret>   Create a new API key',
    show: 'show <acronym>                                    Show full API key (sensitive)',
    revoke: 'revoke <id>                                       Revoke a key by ID',
    restore: 'restore <id>                                      Re-activate a revoked key',
  }

  async list(): Promise<string> {
    const rows = db.prepare('SELECT * FROM keys ORDER BY created_at DESC').all() as KeyRow[]
    if (rows.length === 0) return 'No keys found.'

    const lines = rows.map((r) => {
      const status = r.active ? '✓' : '✗'
      const hint = `${r.api_key.slice(0, 8)}****`
      return `  [${r.id}] ${status}  ${r.acronym.padEnd(12)} ${r.name.padEnd(30)} ${hint}`
    })
    return [`ID  St  Acronym       Name                           Key hint`, ...lines].join('\n')
  }

  async create(acronym: string, name: string, webhookUrl: string, webhookSecret: string): Promise<string> {
    if (!acronym || !name || !webhookUrl || !webhookSecret) {
      return 'Usage: keys create <acronym> <name> <webhook-url> <webhook-secret>'
    }
    if (webhookSecret.length < 16) {
      return 'Error: webhook-secret must be at least 16 characters.'
    }

    const apiKey = `mvc_${randomBytes(24).toString('hex')}`

    try {
      const row = db
        .prepare(
          `INSERT INTO keys (acronym, name, api_key, webhook_url, webhook_secret)
           VALUES (?, ?, ?, ?, ?)
           RETURNING *`,
        )
        .get(acronym.toLowerCase(), name, apiKey, webhookUrl, webhookSecret) as KeyRow

      return [
        `Key created for ${row.acronym}:`,
        `  ID:             ${row.id}`,
        `  Acronym:        ${row.acronym}`,
        `  Name:           ${row.name}`,
        `  API Key:        ${row.api_key}`,
        `  Webhook URL:    ${row.webhook_url}`,
        `  Webhook Secret: ${row.webhook_secret}`,
        `  Created:        ${row.created_at}`,
        '',
        '⚠  Copy the API key now — it will only show in full via "keys show <acronym>".',
      ].join('\n')
    } catch {
      return `Error: acronym "${acronym}" already exists. Use "keys list" to see existing keys.`
    }
  }

  async show(acronym: string): Promise<string> {
    if (!acronym) return 'Usage: keys show <acronym>'

    const row = db
      .prepare('SELECT * FROM keys WHERE acronym = ?')
      .get(acronym.toLowerCase()) as KeyRow | undefined

    if (!row) return `No key found for acronym "${acronym}".`

    return [
      `Key for ${row.acronym}:`,
      `  API Key:        ${row.api_key}`,
      `  Webhook Secret: ${row.webhook_secret}`,
      `  Webhook URL:    ${row.webhook_url}`,
      `  Active:         ${row.active ? 'yes' : 'no'}`,
    ].join('\n')
  }

  async revoke(id: string): Promise<string> {
    if (!id) return 'Usage: keys revoke <id>'

    const { changes } = db.prepare('UPDATE keys SET active = 0 WHERE id = ?').run(id)
    if (changes === 0) return `No key with ID ${id}.`
    return `Key ${id} revoked.`
  }

  async restore(id: string): Promise<string> {
    if (!id) return 'Usage: keys restore <id>'

    const { changes } = db.prepare('UPDATE keys SET active = 1 WHERE id = ?').run(id)
    if (changes === 0) return `No key with ID ${id}.`
    return `Key ${id} restored.`
  }
}
