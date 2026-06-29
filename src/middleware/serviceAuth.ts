import type { Request, Response, NextFunction } from 'express'
import { env } from '../config/env.js'

export function serviceAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-service-token']
  if (token !== env.SERVICE_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}
