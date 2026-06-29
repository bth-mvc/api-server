import { z } from 'zod'

const schema = z.object({
  PORT: z.coerce.number().default(5000),
  ADMIN_TOKEN: z.string().min(16),
  SERVICE_TOKEN: z.string().min(16),
  DB_PATH: z.string().default('./data/keys.db'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export const env = schema.parse(process.env)
