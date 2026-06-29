# api-server

[![CI](https://github.com/bth-mvc/api-server/actions/workflows/ci.yml/badge.svg)](https://github.com/bth-mvc/api-server/actions/workflows/ci.yml)

Minimal API-nyckelserver för MVC-kursen vid BTH. Hanterar studenters API-nycklar mot exchange-servern.

## Komma igång

```bash
cp .env.example .env   # fyll i ADMIN_TOKEN och SERVICE_TOKEN
npm install
npm run dev
```

## Kommandon

| Kommando | Vad |
|---|---|
| `npm run dev` | Starta med hot reload |
| `npm run check` | Typecheck + lint + format + test |
| `npm test` | Kör tester |
| `npm run tui` | Starta admin-TUI |
| `npm run build` | Kompilera TypeScript |

## Testa med Docker

```bash
cp .env.example .env   # fyll i ADMIN_TOKEN, SERVICE_TOKEN och DOMAIN
docker compose up -d --build
```

Verifiera att servern är uppe:

```bash
curl http://localhost/health
# {"status":"ok","uptime":...}
```

Skapa en testnyckel:

```bash
curl -s -X POST http://localhost/admin/keys \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"acronym":"abc","name":"Test","webhookUrl":"https://example.com/wh","webhookSecret":"secret-minst-16-tecken"}' \
  | jq .
```

Stoppa:

```bash
docker compose down
```

> **Not:** Caddy kräver ett giltigt domännamn för att hämta TLS-certifikat. Lokalt kan du sätta `DOMAIN=localhost` i `.env` — Caddy servar då utan HTTPS på port 80.

## Admin-TUI

```bash
npm run tui
> keys list
> keys create abc "Anna Bengtsson" https://... hemlig
> keys show abc
> keys revoke 3
```

## API

Se [CLAUDE.md](CLAUDE.md) för fullständig API-dokumentation.
