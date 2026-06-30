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
})

const SetTtlSchema = z.object({
  expiresAt: z.string().datetime({ offset: true }),
})

adminRouter.post('/keys', (req, res) => {
  const result = CreateKeySchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  const { acronym, name } = result.data
  const apiKey = `mvc_${randomBytes(24).toString('hex')}`

  let row: KeyRow
  try {
    row = db
      .prepare(
        `INSERT INTO keys (acronym, name, api_key)
         VALUES (?, ?, ?)
         RETURNING *`,
      )
      .get(acronym, name, apiKey) as KeyRow
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: `Acronym '${acronym}' already exists` })
      return
    }
    throw err
  }

  res.status(201).json({
    id: row.id,
    acronym: row.acronym,
    name: row.name,
    apiKey: row.api_key,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  })
})

adminRouter.get('/keys', (_req, res) => {
  const rows = db.prepare(`SELECT * FROM keys ORDER BY created_at DESC`).all() as KeyRow[]
  res.json(
    rows.map((r) => ({
      id: r.id,
      acronym: r.acronym,
      name: r.name,
      apiKeyHint: `${r.api_key.slice(0, 8)}****`,
      active: r.active === 1,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    })),
  )
})

adminRouter.get('/keys/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM keys WHERE id = ?`).get(req.params.id) as KeyRow | undefined
  if (!row) {
    res.status(404).json({ error: 'Key not found' })
    return
  }
  res.json({
    id: row.id,
    acronym: row.acronym,
    name: row.name,
    apiKey: row.api_key,
    active: row.active === 1,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  })
})

adminRouter.delete('/keys/:id', (req, res) => {
  const { changes } = db.prepare(`UPDATE keys SET active = 0 WHERE id = ?`).run(req.params.id)
  if (changes === 0) {
    res.status(404).json({ error: 'Key not found' })
    return
  }
  res.status(204).end()
})

adminRouter.patch('/keys/:id/restore', (req, res) => {
  const { changes } = db.prepare(`UPDATE keys SET active = 1 WHERE id = ?`).run(req.params.id)
  if (changes === 0) {
    res.status(404).json({ error: 'Key not found' })
    return
  }
  res.status(204).end()
})

adminRouter.patch('/keys/:id/ttl', (req, res) => {
  const result = SetTtlSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  const { changes } = db
    .prepare(`UPDATE keys SET expires_at = ? WHERE id = ?`)
    .run(result.data.expiresAt, req.params.id)
  if (changes === 0) {
    res.status(404).json({ error: 'Key not found' })
    return
  }
  res.status(204).end()
})
