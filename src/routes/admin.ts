import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { db } from '../db.js'
import type { KeyRow } from '../db.js'
import { adminAuth } from '../middleware/adminAuth.js'

export const adminRouter = Router()

adminRouter.use(adminAuth)

const CreateKeySchema = z.object({
  acronym: z.string().min(2).max(10).toLowerCase(),
  name: z.string().min(1).max(100),
  webhookUrl: z.string().url(),
  webhookSecret: z.string().min(16),
})

adminRouter.post('/admin/keys', (req, res) => {
  const result = CreateKeySchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  const { acronym, name, webhookUrl, webhookSecret } = result.data
  const apiKey = `mvc_${randomBytes(24).toString('hex')}`

  const row = db
    .prepare(
      `INSERT INTO keys (acronym, name, api_key, webhook_url, webhook_secret)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(acronym, name, apiKey, webhookUrl, webhookSecret) as KeyRow

  res.status(201).json({
    id: row.id,
    acronym: row.acronym,
    name: row.name,
    apiKey: row.api_key,
    webhookUrl: row.webhook_url,
    webhookSecret: row.webhook_secret,
    createdAt: row.created_at,
  })
})

adminRouter.get('/admin/keys', (_req, res) => {
  const rows = db.prepare(`SELECT * FROM keys ORDER BY created_at DESC`).all() as KeyRow[]
  res.json(
    rows.map((r) => ({
      id: r.id,
      acronym: r.acronym,
      name: r.name,
      apiKeyHint: `${r.api_key.slice(0, 8)}****`,
      webhookUrl: r.webhook_url,
      active: r.active === 1,
      createdAt: r.created_at,
    })),
  )
})

adminRouter.delete('/admin/keys/:id', (req, res) => {
  const { changes } = db
    .prepare(`UPDATE keys SET active = 0 WHERE id = ?`)
    .run(req.params.id)

  if (changes === 0) {
    res.status(404).json({ error: 'Key not found' })
    return
  }
  res.status(204).end()
})
