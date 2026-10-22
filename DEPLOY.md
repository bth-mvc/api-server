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

Repot är publikt och imagen innehåller inget känsligt (inga tokens eller nyckeldata bakas in i den), så paketet hålls publikt — det är dessutom ett potentiellt studieobjekt för studenterna. Då slipper droppleten autentisera sig mot GHCR för att dra imagen, och ingen token behöver skapas eller förnyas.

> **Förutsättning:** organisationen måste tillåta publika paket innan det går att välja. Som organisationsägare: **`https://github.com/organizations/bth-mvc/settings/packages`** → kryssa i **"Public packages"**. Annars är alternativet "Public" gråat i steget nedan med texten *"Setting is disabled by organization administrators"* — även för en org-owner.

Efter att `deploy.yml` kört en gång (så paketet finns):

**GitHub → bth-mvc → Packages → `api-server` → Package settings → Change visibility → Public.**

Om deploy-jobbet ändå misslyckas med `error from registry: unauthorized` vid `docker compose pull`: paketet är fortfarande privat — antingen har org-inställningen ovan inte satts, eller så har visibiliteten inte ändrats än. Kör om deploy-jobbet (**Actions → aktuell körning → Re-run failed jobs**) när paketet väl är publikt.

### Skapa deploy-användare och SSH-nyckelpar

GitHub Actions loggar inte in som root. Skapa en egen användare för appen, som äger `/opt/api-server` och får köra `docker` (kör som root på droppen):

```bash
useradd --system --create-home --shell /bin/bash --user-group api-server
usermod -aG docker api-server
find /opt/api-server -path /opt/api-server/data -prune -o -exec chown api-server:api-server {} +
```

`data/` lämnas med root som ägare eftersom containern skriver dit som root. Observera att gruppen `docker` i praktiken ger root-rättigheter, så nyckeln ska bara finnas som GitHub Secret.

Generera ett nyckelpar (på din egen dator) med en egen nyckel för just den här appen:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy-api-server" -f ./deploy_key -N ""
```

Lägg den **publika** nyckeln hos deploy-användaren. `restrict` stänger av portvidarebefordran, agent och pty:

```bash
install -d -m 700 -o api-server -g api-server /home/api-server/.ssh
echo "restrict $(cat deploy_key.pub)" > /home/api-server/.ssh/authorized_keys
chown api-server:api-server /home/api-server/.ssh/authorized_keys && chmod 600 /home/api-server/.ssh/authorized_keys
```

Lägg den **privata** nyckeln (hela innehållet i `deploy_key`) som GitHub Secret `SSH_PRIVATE_KEY`, och radera sedan nyckelfilerna lokalt.

### Lägg till GitHub Secrets

I repot: **Settings → Secrets and variables → Actions → New repository secret**, eller med `gh secret set`.

| Secret | Värde |
|---|---|
| `SSH_HOST` | Dropletens IP-adress eller domännamn |
| `SSH_USER` | `api-server` (deploy-användaren ovan, inte `root`) |
| `SSH_PRIVATE_KEY` | Innehållet i `deploy_key` (privata nyckeln) |

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

# Städa bort gamla, lokalt byggda images (behövs inte längre sedan bygget flyttade till GHCR)
docker image prune -a -f
```

## Övervaka resursanvändning (delad droplet)

Droppleten kör fler tjänster än bara `api-server`, så kolla det här innan ni lägger till ännu en app:

```bash
free -h                       # minne — titta på "available", inte "free"
docker stats --no-stream       # minne/CPU per container, engångs-snapshot
df -h                          # diskutrymme
uptime                         # load average — CPU-contention brukar märkas här före minnet
```

Varje liten Node-app har hittills legat på ~25–30 MiB i drift. Håll en marginal på minst 300–400 MiB "available" innan ni startar fler tjänster på samma droplet.

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
