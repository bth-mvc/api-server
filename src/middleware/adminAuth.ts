import type { Request, Response, NextFunction } from 'express'
import { env } from '../config/env.js'

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ') || header.slice(7) !== env.ADMIN_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}
