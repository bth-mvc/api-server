import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import type { KeyRow } from '../db.js'
import { serviceAuth } from '../middleware/serviceAuth.js'

export const serviceRouter = Router()

serviceRouter.use(serviceAuth)

const VerifySchema = z.object({
  apiKey: z.string().min(1),
})

serviceRouter.post('/verify', (req, res) => {
  const result = VerifySchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }

  const row = db
    .prepare(`SELECT * FROM keys WHERE api_key = ? AND active = 1`)
    .get(result.data.apiKey) as KeyRow | undefined

  if (!row) {
    res.status(200).json({ valid: false })
    return
  }

  res.json({
    valid: true,
    acronym: row.acronym,
  })
})
