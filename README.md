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
| `npm run test:coverage` | Kör tester med kodtäckning |
| `npm run build` | Kompilera TypeScript |

## Testa med Docker

`Caddyfile.local` använder `tls internal` — Caddy utfärdar ett lokalt certifikat via sin egen CA, vilket speglar produktionsuppsättningen utan Let's Encrypt. `Caddyfile` (produktion) låter Caddy hämta certifikat från Let's Encrypt automatiskt.

### Starta lokalt

```bash
cp .env.example .env
# Sätt ADMIN_TOKEN, SERVICE_TOKEN, DOMAIN=localhost, CADDYFILE=Caddyfile.local
# Sätt HTTP_PORT=8080, HTTPS_PORT=8443 om port 80/443 är upptagna
docker compose up -d --build
```

### Lita på Caddys lokala CA (görs en gång per maskin)

`caddy trust` inuti containern kan inte nå värddatorns CA-store — extrahera certifikatet manuellt istället:

```bash
docker compose exec caddy cat /data/caddy/pki/authorities/local/root.crt \
  | sudo tee /usr/local/share/ca-certificates/caddy-local-ca.crt
sudo update-ca-certificates
```

Därefter fungerar HTTPS utan `-k`:

```bash
curl -L https://localhost/health
# {"status":"ok","uptime":...}
```

<details>
<summary>Platform-specifika instruktioner (Linux, WSL, macOS)</summary>

**Linux (Ubuntu/Debian)**

```bash
docker compose exec caddy cat /data/caddy/pki/authorities/local/root.crt \
  | sudo tee /usr/local/share/ca-certificates/caddy-local-ca.crt
sudo update-ca-certificates
```

**WSL (Windows Subsystem for Linux)**

Samma som Linux för `curl` i WSL-terminalen. Vill du även lita på certifikatet i Windows-webbläsare behöver du importera det i Windows certifikathanterare (MMC → Trusted Root Certification Authorities).

**macOS**

```bash
docker compose exec caddy cat /data/caddy/pki/authorities/local/root.crt \
  > /tmp/caddy-local-ca.crt
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain /tmp/caddy-local-ca.crt
```

</details>

### 1. Verifiera att servern svarar

```bash
curl -L https://localhost/health
```

### 2. Testa via TUI

```bash
npm run tui:docker
```

```
> health
> create abc "Anna Bengtsson"
> list
> show abc
> revoke 1
> list
```

### 3. Verifiera att datan överlever omstart

```bash
docker compose down && docker compose up -d
npm run tui:docker
> list   # skall fortfarande visa nyckeln
```

### Stoppa

```bash
docker compose down
```

## Admin-TUI

```bash
npm run tui
> list
> create abc "Anna Bengtsson"
> show abc
> revoke 1
```

## Uppgradering och databasschema

Schemat skapas automatiskt vid första start. Om du uppgraderar från en version med ett annat schema (t.ex. om `webhook_url`/`webhook_secret` togs bort) måste databasen återskapas manuellt:

```bash
# Stoppa servern, ta bort databasen, starta om
docker compose down
rm data/keys.db
docker compose up -d
```

> **Varning:** All nyckeldata försvinner. Exportera befintliga nycklar via TUI:n innan du tar bort filen.

## API

Se [CLAUDE.md](CLAUDE.md) för fullständig API-dokumentation.
