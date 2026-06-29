import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../app.js'
import { db } from '../db.js'
import { randomBytes } from 'node:crypto'

const SERVICE = process.env.SERVICE_TOKEN ?? 'test-service-token'

function createKey(acronym: string) {
  const apiKey = `mvc_${randomBytes(24).toString('hex')}`
  db.prepare(
    `INSERT INTO keys (acronym, name, api_key, webhook_url, webhook_secret)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(acronym, 'Test User', apiKey, 'https://example.com/wh', 'secret-at-least-16-chars')
  return apiKey
}

beforeEach(() => {
  db.prepare('DELETE FROM keys').run()
})

describe('POST /service/verify', () => {
  it('returns valid true for an active key', async () => {
    const apiKey = createKey('abc')
    const res = await request(app)
      .post('/service/verify')
      .set('X-Service-Token', SERVICE)
      .send({ apiKey })
    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(true)
    expect(res.body.acronym).toBe('abc')
    expect(res.body.webhookUrl).toBe('https://example.com/wh')
    expect(res.body.webhookSecret).toBe('secret-at-least-16-chars')
  })

  it('returns valid false for unknown key', async () => {
    const res = await request(app)
      .post('/service/verify')
      .set('X-Service-Token', SERVICE)
      .send({ apiKey: 'mvc_doesnotexist' })
    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(false)
  })

  it('returns valid false for revoked key', async () => {
    const apiKey = createKey('xyz')
    db.prepare(`UPDATE keys SET active = 0 WHERE acronym = 'xyz'`).run()
    const res = await request(app)
      .post('/service/verify')
      .set('X-Service-Token', SERVICE)
      .send({ apiKey })
    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(false)
  })

  it('returns 401 without service token', async () => {
    const res = await request(app).post('/service/verify').send({ apiKey: 'mvc_anything' })
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing apiKey', async () => {
    const res = await request(app).post('/service/verify').set('X-Service-Token', SERVICE).send({})
    expect(res.status).toBe(400)
  })
})
