import { Router } from 'express'
import { db } from '../db.js'
import type { KeyRow } from '../db.js'

export const keysRouter = Router()

keysRouter.get('/:acronym', (req, res) => {
  const row = db
    .prepare(`SELECT * FROM keys WHERE acronym = ? AND active = 1`)
    .get(req.params.acronym.toLowerCase()) as KeyRow | undefined

  if (!row) {
    res.status(404).json({ error: 'No active key found for this acronym' })
    return
  }

  res.json({
    acronym: row.acronym,
    name: row.name,
    apiKeyHint: `${row.api_key.slice(0, 8)}****`,
    active: true,
  })
})
