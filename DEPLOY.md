# Driftsättning

API-servern körs som en Docker-container bakom Caddy (auto-TLS via Let's Encrypt) på en DigitalOcean-droplet. Ny kod deployas automatiskt när du pushar en `v*`-tagg till GitHub.

## Förutsättningar

- DigitalOcean-konto
- Domännamn med en A-record som pekar på dropletens IP (`api.example.com → <IP>`)
- GitHub-repo med Actions aktiverat

---

## 1. Skapa droplet

På DigitalOcean:

- **Image:** Ubuntu 24.04 LTS
- **Size:** Basic, 1 GB RAM räcker gott
- **Authentication:** SSH-nyckel (lägg till din publika nyckel)
- Notera dropletens IP-adress

---

## 2. Serversetup (kör en gång via SSH)

```bash
ssh root@<IP>
```

### Docker

```bash
curl -fsSL https://get.docker.com | sh
```

### Brandvägg

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

### Klona repot

```bash
mkdir -p /opt/api-server
cd /opt/api-server
git clone https://github.com/bth-mvc/api-server.git .
```

> Om repot är privat: skapa ett [GitHub deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys) och lägg till den publika nyckeln i repot (Settings → Deploy keys). Klona sedan med SSH: `git clone git@github.com:bth-mvc/api-server.git .`

### Miljövariabler

```bash
cp .env.example .env
nano .env
```

Fyll i:

```
ADMIN_TOKEN=<lång-slumpmässig-sträng>
SERVICE_TOKEN=<annan-lång-slumpmässig-sträng>
DOMAIN=api.example.com
NODE_ENV=production
```

Generera tokens med: `openssl rand -hex 32`

### Starta tjänsten

```bash
docker compose up -d
```

Caddy hämtar automatiskt ett TLS-certifikat från Let's Encrypt vid första uppstarten. Kontrollera att det fungerar:

```bash
curl https://api.example.com/health
# {"status":"ok","uptime":...}
```

---

## 3. Konfigurera CD (GitHub Actions)

CD-pipelinen SSH:ar in på servern och kör `git pull && docker compose up -d --build` vid ny tagg.

### Skapa SSH-nyckelpar för deploy

Kör lokalt (eller på servern):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_key -N ""
```

Lägg till **publika** nyckeln på servern:

```bash
cat ~/.ssh/deploy_key.pub >> /root/.ssh/authorized_keys
```

### Lägg till GitHub Secrets

I repot: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Värde |
|---|---|
| `SSH_HOST` | Dropletens IP-adress |
| `SSH_USER` | `root` (eller din deploy-användare) |
| `SSH_PRIVATE_KEY` | Innehållet i `~/.ssh/deploy_key` (privata nyckeln) |

---

## 4. Deploya en ny version

```bash
git tag v1.0.0
git push --tags
```

GitHub Actions kör då `.github/workflows/deploy.yml` som SSH:ar in och startar om containrarna med den nya koden. Följ förloppet under **Actions**-fliken i GitHub.

---

## Nyttiga kommandon på servern

```bash
# Visa körande containrar
docker compose ps

# Visa loggar (följ)
docker compose logs -f

# Starta om
docker compose restart

# Uppdatera manuellt (utan CD)
git pull && docker compose up -d --build

# Stoppa allt
docker compose down
```

## Säkerhetskopia av databasen

SQLite-filen ligger i `./data/keys.db` (Docker-volym monterad från `/opt/api-server/data/`). Kopiera den för backup:

```bash
cp /opt/api-server/data/keys.db /opt/api-server/data/keys.db.bak
```

Eller schemalägg med cron:

```bash
# Daglig backup kl 03:00
0 3 * * * cp /opt/api-server/data/keys.db /opt/api-server/data/keys.$(date +\%Y\%m\%d).db
```
