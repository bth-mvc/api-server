import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../app.js'
import { db } from '../db.js'

const ADMIN = `Bearer ${process.env.ADMIN_TOKEN ?? 'test-admin-token'}`

beforeEach(() => {
  db.prepare('DELETE FROM keys').run()
})

describe('POST /admin/keys', () => {
  it('creates a key and returns it', async () => {
    const res = await request(app).post('/admin/keys').set('Authorization', ADMIN).send({
      acronym: 'abc',
      name: 'Alice',
      webhookUrl: 'https://abc.example.com/wh',
      webhookSecret: 'secret-at-least-16-chars',
    })
    expect(res.status).toBe(201)
    expect(res.body.acronym).toBe('abc')
    expect(res.body.apiKey).toMatch(/^mvc_/)
  })

  it('returns 401 without admin token', async () => {
    const res = await request(app).post('/admin/keys').send({})
    expect(res.status).toBe(401)
  })

  it('returns 400 for missing fields', async () => {
    const res = await request(app)
      .post('/admin/keys')
      .set('Authorization', ADMIN)
      .send({ acronym: 'abc' })
    expect(res.status).toBe(400)
  })

  it('returns 409 for duplicate acronym', async () => {
    const body = {
      acronym: 'abc',
      name: 'Alice',
      webhookUrl: 'https://abc.example.com/wh',
      webhookSecret: 'secret-at-least-16-chars',
    }
    await request(app).post('/admin/keys').set('Authorization', ADMIN).send(body)
    const res = await request(app).post('/admin/keys').set('Authorization', ADMIN).send(body)
    expect(res.status).toBe(409)
  })
})

describe('GET /admin/keys', () => {
  it('returns empty list initially', async () => {
    const res = await request(app).get('/admin/keys').set('Authorization', ADMIN)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

describe('GET /admin/keys/:id', () => {
  it('returns full key including apiKey', async () => {
    const created = await request(app).post('/admin/keys').set('Authorization', ADMIN).send({
      acronym: 'abc',
      name: 'Alice',
      webhookUrl: 'https://abc.example.com/wh',
      webhookSecret: 'secret-at-least-16-chars',
    })
    const res = await request(app).get(`/admin/keys/${created.body.id}`).set('Authorization', ADMIN)
    expect(res.status).toBe(200)
    expect(res.body.apiKey).toMatch(/^mvc_/)
    expect(res.body.webhookSecret).toBe('secret-at-least-16-chars')
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/admin/keys/999').set('Authorization', ADMIN)
    expect(res.status).toBe(404)
  })
})

describe('DELETE + PATCH /admin/keys/:id', () => {
  it('revokes and restores a key', async () => {
    const created = await request(app).post('/admin/keys').set('Authorization', ADMIN).send({
      acronym: 'abc',
      name: 'Alice',
      webhookUrl: 'https://abc.example.com/wh',
      webhookSecret: 'secret-at-least-16-chars',
    })
    const { id } = created.body

    const revoke = await request(app).delete(`/admin/keys/${id}`).set('Authorization', ADMIN)
    expect(revoke.status).toBe(204)

    const restore = await request(app)
      .patch(`/admin/keys/${id}/restore`)
      .set('Authorization', ADMIN)
    expect(restore.status).toBe(204)

    const full = await request(app).get(`/admin/keys/${id}`).set('Authorization', ADMIN)
    expect(full.body.active).toBe(true)
  })

  it('returns 404 when revoking unknown id', async () => {
    const res = await request(app).delete('/admin/keys/999').set('Authorization', ADMIN)
    expect(res.status).toBe(404)
  })
})

describe('GET /keys/:acronym', () => {
  it('returns hint after key created', async () => {
    await request(app).post('/admin/keys').set('Authorization', ADMIN).send({
      acronym: 'xyz',
      name: 'Bob',
      webhookUrl: 'https://xyz.example.com/wh',
      webhookSecret: 'secret-at-least-16-chars',
    })

    const res = await request(app).get('/keys/xyz')
    expect(res.status).toBe(200)
    expect(res.body.acronym).toBe('xyz')
    expect(res.body.apiKeyHint).toMatch(/\*\*\*\*/)
  })

  it('returns 404 for unknown acronym', async () => {
    const res = await request(app).get('/keys/unknown')
    expect(res.status).toBe(404)
  })
})
