# CLAUDE.md — bth-mvc/api-server

## Vad det här repot är

En minimal API-nyckelserver för MVC-kursen och ops-kursen vid BTH. Kursteamet skapar en nyckel per student; studenten hämtar sin nyckel och använder den mot exchange-servern.

Avsiktligt enkel — lätt att driftsätta, lätt att förstå, och potentiellt ett läroexempel i ops-kursen.

## Syfte

Exchange-servern kräver en API-nyckel per request. Denna server hanterar livscykeln för nycklarna:

```
Läraren skapar nyckel → student hämtar nyckel → exchange verifierar nyckel
```

## API

### Autentisering

Admin-endpoints kräver `Authorization: Bearer <ADMIN_TOKEN>` (från `.env`).
Service-endpoint (exchange) kräver `X-Service-Token: <SERVICE_TOKEN>` (från `.env`).
Student-endpoint är öppen men begränsad via studentens akronym.

### Endpoints

| Method | Path | Auth | Beskrivning |
|---|---|---|---|
| `POST /admin/keys` | Admin | Skapa nyckel för en student |
| `GET /admin/keys` | Admin | Lista alla nycklar |
| `DELETE /admin/keys/:id` | Admin | Återkalla en nyckel |
| `GET /keys/:acronym` | Öppen | Student hämtar sin nyckel (visar aldrig full nyckel) |
| `POST /service/verify` | Service | Exchange verifierar att en nyckel är giltig |
| `GET /health` | Öppen | Hälsostatus |

### `POST /admin/keys` — request
```json
{
  "acronym": "abc",
  "name": "Anna Bengtsson Carlsson",
  "webhookUrl": "https://abc.student.bth.se/api/webhooks/exchange",
  "webhookSecret": "hemlig-sträng-per-student"
}
```

### `POST /admin/keys` — response
```json
{
  "id": 1,
  "acronym": "abc",
  "name": "Anna Bengtsson Carlsson",
  "apiKey": "mvc_a1b2c3d4e5f6...",
  "webhookUrl": "https://abc.student.bth.se/api/webhooks/exchange",
  "webhookSecret": "hemlig-sträng-per-student",
  "createdAt": "2026-06-29T10:00:00.000Z"
}
```

### `GET /keys/:acronym` — response (student-vy, dold nyckel)
```json
{
  "acronym": "abc",
  "name": "Anna Bengtsson Carlsson",
  "apiKeyHint": "mvc_a1b2****",
  "webhookUrl": "https://abc.student.bth.se/api/webhooks/exchange",
  "active": true
}
```

### `POST /service/verify` — request (exchange kallar detta)
```json
{
  "apiKey": "mvc_a1b2c3d4e5f6..."
}
```

### `POST /service/verify` — response
```json
{
  "valid": true,
  "acronym": "abc",
  "webhookUrl": "https://abc.student.bth.se/api/webhooks/exchange",
  "webhookSecret": "hemlig-sträng-per-student"
}
```

## Tech stack

| Lager | Val |
|---|---|
| Runtime | Node.js 24+ |
| Språk | TypeScript (ESM) |
| Framework | Express 5 |
| Databas | SQLite via `better-sqlite3` |
| Validering | Zod |
| Loggning | Pino |

### Varför SQLite

- Ingen separat databas-container att driftsätta
- Backup = kopiera en fil
- Tillräckligt för ~50 studenter
- Fungerar i Docker via en monterad volym (`./data:/app/data`)

## Fil- och katalogstruktur

```
api-server/
├── src/
│   ├── index.ts              ← startar servern
│   ├── app.ts                ← Express-app
│   ├── db.ts                 ← SQLite-anslutning och schema
│   ├── config/env.ts         ← Zod-validerad env
│   ├── routes/
│   │   ├── admin.ts          ← POST/GET/DELETE /admin/keys
│   │   ├── keys.ts           ← GET /keys/:acronym
│   │   ├── service.ts        ← POST /service/verify
│   │   └── health.ts         ← GET /health
│   └── middleware/
│       ├── adminAuth.ts      ← Bearer token
│       ├── serviceAuth.ts    ← X-Service-Token
│       └── errorHandler.ts
├── data/                     ← SQLite-fil (gitignorerad, Docker-volym)
│   └── keys.db
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
└── CLAUDE.md
```

## Miljövariabler

| Variabel | Beskrivning |
|---|---|
| `PORT` | Port (default 5000) |
| `ADMIN_TOKEN` | Hemlig token för lärarens admin-anrop |
| `SERVICE_TOKEN` | Hemlig token för exchange att verifiera nycklar |
| `DB_PATH` | Sökväg till SQLite-fil (default `./data/keys.db`) |
| `NODE_ENV` | `development` eller `production` |

## SQLite-schema

```sql
CREATE TABLE keys (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  acronym     TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  api_key     TEXT UNIQUE NOT NULL,
  webhook_url TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Driftsättning

Designad för att köras som en Docker-container med en monterad volym för SQLite-filen:

```yaml
services:
  api-server:
    build: .
    ports:
      - "5000:5000"
    volumes:
      - ./data:/app/data   # SQLite-filen överlever omstarter
    env_file: .env
```

## Relation till andra repon

| Repo | Relation |
|---|---|
| `bth-mvc/exchange` | Kallar `POST /service/verify` för att validera studenters API-nycklar |
| `bth-mvc/teacher` | MVC-kursen — studenter hämtar sin nyckel för att konfigurera börsintegrationen |
| `bth-ops/teacher` | Potentiellt läroexempel i ops-kursen (se `teacher/infrastructure-examples.md`) |
