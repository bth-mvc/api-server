# Driftsättning

API-servern körs som en Docker-container bakom Caddy (auto-TLS via Let's Encrypt) på en DigitalOcean-droplet. Caddy installeras på host-nivå och hanterar TLS och routing för alla tjänster på dropleten. Ny kod deployas automatiskt när du pushar en `v*`-tagg till GitHub: GitHub Actions bygger imagen och pushar den till GitHub Container Registry (GHCR), sedan SSH:ar samma workflow in på droppleten och drar hem den färdigbyggda imagen. Droppleten bygger alltså aldrig imagen själv (sparar RAM/CPU på den lilla 1 GB-instansen).

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

## 2. Serversetup

### Startup script (klistras in vid droplet-skapande)

Under **Advanced Options → User Data** på DigitalOcean, klistra in innehållet från [`scripts/droplet-setup.sh`](scripts/droplet-setup.sh). Scriptet installerar Docker och Caddy, konfigurerar brandväggen och skapar `/opt/api-server` automatiskt vid första boot.

Följ förloppet efter att du loggat in:

```bash
tail -f /var/log/droplet-setup.log
```

### Manuella steg (kör via SSH efter att scriptet är klart)

```bash
ssh root@<IP>
```

### Konfigurera Caddy

Lägg till ett site-block för api-servern i `/etc/caddy/Caddyfile`:

```
api.example.com {
    reverse_proxy localhost:5000
}
```

Starta om Caddy — certifikat hämtas automatiskt från Let's Encrypt:

```bash
systemctl reload caddy
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
NODE_ENV=production
```

Generera tokens med: `openssl rand -hex 32`

### Starta tjänsten

Imagen dras från GHCR (bygg och pusha en gång via `.github/workflows/deploy.yml` innan detta steg, se avsnitt 3–4, eller bygg och pusha manuellt en gång för hand):

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Verifiera att det fungerar:

```bash
curl https://api.example.com/health
# {"status":"ok","uptime":...}
```

---

## 3. Konfigurera CD (GitHub Actions)

CD-pipelinen har två jobb: `build-and-push` bygger imagen och pushar den till `ghcr.io/bth-mvc/api-server` (autentiserat med det inbyggda `GITHUB_TOKEN`, ingen extra secret behövs), sedan SSH:ar `deploy` in på servern och kör `git pull && docker compose -f docker-compose.prod.yml pull && ... up -d` vid ny tagg.

### Gör GHCR-paketet publikt (engångssteg, efter första pushen)

Eftersom repot är publikt är det enklast att också göra containerpaketet publikt — då slipper droppleten autentisera sig mot GHCR för att dra imagen. Efter att `deploy.yml` kört en gång (så paketet finns):

**GitHub → din profil/organisation → Packages → `api-server` → Package settings → Change visibility → Public.**

Om paketet ska vara privat istället: kör `docker login ghcr.io -u <github-användarnamn> --password-stdin < token.txt` en gång på droppleten med ett [Personal Access Token](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#authenticating-to-the-container-registry) som har `read:packages`-scope. Inloggningen sparas i `~/.docker/config.json` och behöver inte upprepas.

### Skapa SSH-nyckelpar för deploy

GitHub Actions behöver kunna SSH:a in på servern. Det kräver ett nyckelpar där den **privata** nyckeln läggs i GitHub Secrets och den **publika** nyckeln läggs i `authorized_keys` på servern.

Generera nyckelparet på servern:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_key -N ""
```

Lägg till den publika nyckeln i `authorized_keys` så servern accepterar inloggning med den:

```bash
cat ~/.ssh/deploy_key.pub >> /root/.ssh/authorized_keys
```

Visa den privata nyckeln — kopiera hela utskriften inklusive `-----BEGIN`- och `-----END`-raderna:

```bash
cat ~/.ssh/deploy_key
```

Nyckelfilerna kan raderas när GitHub Secrets är satta:

```bash
rm ~/.ssh/deploy_key ~/.ssh/deploy_key.pub
```

### Lägg till GitHub Secrets

I repot: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Värde |
|---|---|
| `SSH_HOST` | Dropletens IP-adress eller domännamn |
| `SSH_USER` | `root` (eller din deploy-användare) |
| `SSH_PRIVATE_KEY` | Innehållet i `~/.ssh/deploy_key` (privata nyckeln) |

---

## 4. Deploya en ny version

```bash
npm run release:patch   # eller :minor / :major
```

GitHub Actions kör då `.github/workflows/deploy.yml`: bygger imagen, pushar den till GHCR, SSH:ar sedan in och startar om containrarna med den nya imagen. Följ förloppet under **Actions**-fliken i GitHub.

---

## Nyttiga kommandon på servern

```bash
# Visa körande containrar
docker compose -f docker-compose.prod.yml ps

# Visa loggar (följ)
docker compose -f docker-compose.prod.yml logs -f

# Starta om
docker compose -f docker-compose.prod.yml restart

# Uppdatera manuellt (utan CD) — kräver att en image redan är pushad till GHCR
git pull && docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d

# Stoppa allt
docker compose -f docker-compose.prod.yml down
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
