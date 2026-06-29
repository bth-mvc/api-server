import { BaseCommand } from '@dbwebb/tui'

interface KeySummary {
  id: number
  acronym: string
  name: string
  apiKeyHint: string
  webhookUrl: string
  active: boolean
  createdAt: string
}

interface KeyFull extends KeySummary {
  apiKey: string
  webhookSecret: string
}

export class KeysCommands extends BaseCommand {
  private readonly apiUrl: string
  private readonly token: string

  constructor() {
    super()
    this.apiUrl = (process.env.API_URL ?? 'http://localhost:5000').replace(/\/$/, '')
    this.token = process.env.ADMIN_TOKEN ?? ''
    if (!this.token) console.warn('Warning: ADMIN_TOKEN is not set.')
  }

  static descriptions = {
    health: 'health                                            Check server health',
    list: 'list                                              List all keys',
    create: 'create <acronym> <name> <webhook-url> <secret>   Create a new API key',
    show: 'show <acronym>                                    Show full key details',
    revoke: 'revoke <id>                                       Revoke a key by ID',
    restore: 'restore <id>                                      Re-activate a revoked key',
  }

  private async req(method: string, path: string, body?: unknown): Promise<Response> {
    return fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  async health(): Promise<string> {
    const res = await fetch(`${this.apiUrl}/health`)
    if (!res.ok) return `Error ${res.status}: ${await res.text()}`
    const data = (await res.json()) as { status: string; uptime: number }
    return `Status: ${data.status}  Uptime: ${Math.floor(data.uptime)}s`
  }

  async list(): Promise<string> {
    const res = await this.req('GET', '/admin/keys')
    if (!res.ok) return `Error ${res.status}: ${await res.text()}`
    const keys = (await res.json()) as KeySummary[]
    if (keys.length === 0) return 'No keys found.'

    const header = 'ID  St  Acronym       Name                           Key hint'
    const lines = keys.map((k) => {
      const status = k.active ? '✓' : '✗'
      return `  [${k.id}] ${status}  ${k.acronym.padEnd(12)} ${k.name.padEnd(30)} ${k.apiKeyHint}`
    })
    return [header, ...lines].join('\n')
  }

  async create(acronym: string, name: string, webhookUrl: string, webhookSecret: string): Promise<string> {
    if (!acronym || !name || !webhookUrl || !webhookSecret) {
      return 'Usage: keys create <acronym> <name> <webhook-url> <webhook-secret>'
    }
    const res = await this.req('POST', '/admin/keys', { acronym, name, webhookUrl, webhookSecret })
    if (res.status === 409) return `Error: acronym "${acronym}" already exists.`
    if (!res.ok) return `Error ${res.status}: ${await res.text()}`
    const key = (await res.json()) as KeyFull
    return [
      `Key created for ${key.acronym}:`,
      `  ID:             ${key.id}`,
      `  Acronym:        ${key.acronym}`,
      `  Name:           ${key.name}`,
      `  API Key:        ${key.apiKey}`,
      `  Webhook URL:    ${key.webhookUrl}`,
      `  Webhook Secret: ${key.webhookSecret}`,
      `  Created:        ${key.createdAt}`,
      '',
      '⚠  Copy the API key now — it will not be shown again unless you use "keys show".',
    ].join('\n')
  }

  async show(acronym: string): Promise<string> {
    if (!acronym) return 'Usage: keys show <acronym>'

    const listRes = await this.req('GET', '/admin/keys')
    if (!listRes.ok) return `Error ${listRes.status}: ${await listRes.text()}`
    const keys = (await listRes.json()) as KeySummary[]
    const found = keys.find((k) => k.acronym === acronym.toLowerCase())
    if (!found) return `No key found for acronym "${acronym}".`

    const res = await this.req('GET', `/admin/keys/${found.id}`)
    if (!res.ok) return `Error ${res.status}: ${await res.text()}`
    const key = (await res.json()) as KeyFull
    return [
      `Key for ${key.acronym}:`,
      `  API Key:        ${key.apiKey}`,
      `  Webhook Secret: ${key.webhookSecret}`,
      `  Webhook URL:    ${key.webhookUrl}`,
      `  Active:         ${key.active ? 'yes' : 'no'}`,
    ].join('\n')
  }

  async revoke(id: string): Promise<string> {
    if (!id) return 'Usage: keys revoke <id>'
    const res = await this.req('DELETE', `/admin/keys/${id}`)
    if (res.status === 404) return `No key with ID ${id}.`
    if (!res.ok) return `Error ${res.status}: ${await res.text()}`
    return `Key ${id} revoked.`
  }

  async restore(id: string): Promise<string> {
    if (!id) return 'Usage: keys restore <id>'
    const res = await this.req('PATCH', `/admin/keys/${id}/restore`)
    if (res.status === 404) return `No key with ID ${id}.`
    if (!res.ok) return `Error ${res.status}: ${await res.text()}`
    return `Key ${id} restored.`
  }
}
