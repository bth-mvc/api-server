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
