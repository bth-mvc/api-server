import { createRequire } from 'node:module'
import { Router } from 'express'

const require = createRequire(import.meta.url)
const { version } = require('../../package.json') as { version: string }

export const healthRouter = Router()

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', version, uptime: process.uptime() })
})
