import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import express from 'express'
import swaggerUi from 'swagger-ui-express'
import { parse } from 'yaml'
import { healthRouter } from './routes/health.js'
import { adminRouter } from './routes/admin.js'
import { keysRouter } from './routes/keys.js'
import { serviceRouter } from './routes/service.js'
import { errorHandler } from './middleware/errorHandler.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const spec = parse(readFileSync(join(__dirname, '..', 'openapi.yaml'), 'utf8'))

export const app = express()

app.use(express.json())

app.use('/api-doc', swaggerUi.serve, swaggerUi.setup(spec))

app.use(healthRouter)
app.use('/admin', adminRouter)
app.use('/keys', keysRouter)
app.use('/service', serviceRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use(errorHandler)
