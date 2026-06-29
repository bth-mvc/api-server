import express from 'express'
import { healthRouter } from './routes/health.js'
import { adminRouter } from './routes/admin.js'
import { keysRouter } from './routes/keys.js'
import { serviceRouter } from './routes/service.js'
import { errorHandler } from './middleware/errorHandler.js'

export const app = express()

app.use(express.json())

app.use(healthRouter)
app.use('/admin', adminRouter)
app.use('/keys', keysRouter)
app.use('/service', serviceRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use(errorHandler)
