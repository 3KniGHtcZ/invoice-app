# Invoice App - Deployment Guide

Kompletní průvodce pro nasazení Invoice App na NAS pomocí Docker.

## Obsah

1. [Rychlý start](#rychlý-start)
2. [Příprava prostředí](#příprava-prostředí)
3. [Konfigurace](#konfigurace)
4. [Build a deployment](#build-a-deployment)
5. [Nginx reverse proxy na NAS](#nginx-reverse-proxy-na-nas)
6. [Troubleshooting](#troubleshooting)

---

## Rychlý start

```bash
# 1. Naklonujte repozitář
git clone <your-repo-url>
cd invoice-app

# 2. Vytvořte .env.production
cp .env.production.example .env.production
# Upravte .env.production s vašimi hodnotami

# 3. Spusťte pomocí docker-compose
docker-compose up -d

# 4. Aplikace běží na http://localhost:9080
```

---

## Příprava prostředí

### Požadavky

- Docker 20.10+
- Docker Compose 2.0+
- Git
- Nginx na NAS (pro reverse proxy)

### Azure AD App Registration

Aplikace vyžaduje Azure AD pro OAuth autentizaci:

1. Přejděte na [Azure Portal](https://portal.azure.com)
2. Navigate to **App registrations** → **New registration**
3. Name: `Invoice App`
4. Supported account types: **Personal Microsoft accounts only**
5. Redirect URI: `Web` → `https://yourdomain.com/api/auth/callback`
6. Zaregistrujte aplikaci

**Po registraci:**

1. Zkopírujte **Application (client) ID** → použijte jako `AZURE_CLIENT_ID`
2. **Certificates & secrets** → **New client secret** → zkopírujte hodnotu → `AZURE_CLIENT_SECRET`
3. **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**:
   - `Mail.Read`
   - `MailboxFolder.Read`
   - `MailboxItem.Read`
   - `User.Read`
   - `offline_access`
   - `openid`
   - `profile`
4. **Grant admin consent** (pokud je potřeba)

### Google Gemini API Key

Pro extrakci dat z PDF faktur:

1. Přejděte na [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Vytvořte nový API klíč
3. Zkopírujte klíč → použijte jako `GEMINI_API_KEY`

---

## Konfigurace

### 1. Environment Variables

Vytvořte `.env.production` soubor:

```bash
cp .env.production.example .env.production
```

Vyplňte následující hodnoty:

```bash
# Azure AD
AZURE_CLIENT_ID=your-azure-client-id-here
AZURE_CLIENT_SECRET=your-azure-client-secret-here
AZURE_TENANT_ID=consumers

# Application URLs (upravte pro vaši doménu)
FRONTEND_URL=https://yourdomain.com
REDIRECT_URI=https://yourdomain.com/api/auth/callback
ALLOWED_ORIGINS=https://yourdomain.com

# Session Secret (vygenerujte nový)
SESSION_SECRET=$(openssl rand -hex 64)

# Cookie Domain (volitelné, pro subdomény)
COOKIE_DOMAIN=.yourdomain.com

# API Keys
GEMINI_API_KEY=your-gemini-api-key-here

# Node
NODE_ENV=production
PORT=3000
```

### 2. Generování SESSION_SECRET

```bash
openssl rand -hex 64
```

### 3. Ověření konfigurace

Zkontrolujte, že:
- ✅ Azure AD callback URL je `https://yourdomain.com/api/auth/callback`
- ✅ `FRONTEND_URL` je v `ALLOWED_ORIGINS`
- ✅ `SESSION_SECRET` je dlouhý náhodný string
- ✅ Všechny API klíče jsou platné

---

## Build a Deployment

### Metoda 1: Docker Compose (Lokální testování)

```bash
# Build a spuštění
docker-compose up -d

# Zobrazit logy
docker-compose logs -f

# Zastavit
docker-compose down

# Rebuild po změnách
docker-compose up -d --build
```

Aplikace běží na: **http://localhost:9080**

### Metoda 2: GitHub Actions (Produkce)

GitHub Actions automaticky buildí a pushuje Docker image do GitHub Container Registry.

**Setup:**

1. Pushnout kód na GitHub
2. Workflow se spustí automaticky při push na `main`/`master`
3. Image je dostupný na: `ghcr.io/<username>/<repo>:latest`

**Pull a spuštění na NAS:**

```bash
# Login do GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull nejnovější image
docker pull ghcr.io/<username>/invoice-app:latest

# Spustit kontejner
docker run -d \
  --name invoice-app \
  -p 9080:80 \
  -v /path/to/data:/app/data \
  -v /path/to/logs:/app/logs \
  --env-file .env.production \
  --restart unless-stopped \
  ghcr.io/<username>/invoice-app:latest

# Ověřit běh
docker ps
docker logs -f invoice-app
```

### Metoda 3: Manuální Build

```bash
# Build image
docker build -t invoice-app:latest .

# Spustit
docker run -d \
  --name invoice-app \
  -p 9080:80 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --env-file .env.production \
  --restart unless-stopped \
  invoice-app:latest
```

---

## Nginx Reverse Proxy na NAS

Konfigurace Nginx na vašem NAS pro směrování vlastní domény na Docker kontejner.

### 1. Nginx Konfigurace

Vytvořte soubor `/etc/nginx/sites-available/invoice-app`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect HTTP to HTTPS (pokud máte SSL)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL certifikáty (pokud máte)
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    # SSL konfigurace
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Max upload size pro PDFka
    client_max_body_size 100M;

    # Proxy vše na Docker kontejner
    location / {
        proxy_pass http://localhost:9080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://localhost:9080/api/health;
        access_log off;
    }
}
```

### 2. Aktivace konfigurace

```bash
# Symlink do sites-enabled
ln -s /etc/nginx/sites-available/invoice-app /etc/nginx/sites-enabled/

# Test konfigurace
nginx -t

# Reload Nginx
systemctl reload nginx
# nebo
service nginx reload
```

### 3. Bez SSL (pouze HTTP)

Pokud nemáte SSL certifikáty:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Proxy headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:9080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}
```

**⚠️ Varování:** Bez HTTPS nebude fungovat `secure: true` v cookies. V `.env.production` nastavte:
```bash
COOKIE_DOMAIN=  # prázdné
```

---

## Údržba

### Logy

```bash
# Zobrazit logy kontejneru
docker logs invoice-app

# Sledovat logy v reálném čase
docker logs -f invoice-app

# Posledních 100 řádků
docker logs --tail 100 invoice-app
```

### Restart kontejneru

```bash
docker restart invoice-app
```

### Update aplikace

```bash
# Pull nový image
docker pull ghcr.io/<username>/invoice-app:latest

# Zastavit a odstranit starý kontejner
docker stop invoice-app
docker rm invoice-app

# Spustit nový kontejner (použijte stejný příkaz jako při prvním spuštění)
docker run -d \
  --name invoice-app \
  -p 9080:80 \
  -v /path/to/data:/app/data \
  -v /path/to/logs:/app/logs \
  --env-file .env.production \
  --restart unless-stopped \
  ghcr.io/<username>/invoice-app:latest
```

### Záloha dat

Databáze jsou uložené v `/app/data` volume:

```bash
# Záloha
cp -r /path/to/data /path/to/backup/data-$(date +%Y%m%d)

# Restore
docker stop invoice-app
cp -r /path/to/backup/data-20250117/* /path/to/data/
docker start invoice-app
```

---

## Troubleshooting

### Kontejner se nespustí

```bash
# Zobrazit logy
docker logs invoice-app

# Ověřit, že port 9080 není obsazený
netstat -tuln | grep 9080

# Zkontrolovat stav kontejneru
docker ps -a
```

### Azure AD OAuth nefunguje

1. Ověřte, že callback URL v Azure AD je: `https://yourdomain.com/api/auth/callback`
2. Zkontrolujte, že `REDIRECT_URI` v `.env.production` je stejná
3. Ověřte, že `FRONTEND_URL` je správná
4. Zkontrolujte logy: `docker logs invoice-app | grep -i auth`

### Databáze se neukládá

```bash
# Ověřit volume
docker inspect invoice-app | grep -A 10 Mounts

# Zkontrolovat oprávnění
ls -la /path/to/data

# Databáze by měly být v /path/to/data/
ls -la /path/to/data/*.db
```

### CORS errory

1. Zkontrolujte `ALLOWED_ORIGINS` v `.env.production`
2. Musí obsahovat vaši doménu: `https://yourdomain.com`
3. Restart kontejneru po změně env vars

### Email sync nefunguje

1. Ověřte, že jste přihlášeni přes Azure AD
2. Zkontrolujte API permissions v Azure Portal
3. Zkontrolujte logy: `docker logs invoice-app | grep -i sync`
4. Manuální trigger: přes UI tlačítko "Sync Emails"

### Health check failuje

```bash
# Test health endpointu
curl http://localhost:9080/api/health

# Pokud nefunguje, zkontrolujte nginx a backend logy
docker logs invoice-app
```

---

## Užitečné příkazy

```bash
# Vstup do běžícího kontejneru
docker exec -it invoice-app sh

# Zkontrolovat běžící procesy v kontejneru
docker exec invoice-app ps aux

# Zobrazit env vars
docker exec invoice-app env

# Zkontrolovat databáze
docker exec invoice-app ls -la /app/data

# Test nginx konfigurace uvnitř kontejneru
docker exec invoice-app nginx -t

# Restart Nginx v kontejneru
docker exec invoice-app supervisorctl restart nginx

# Restart backend v kontejneru
docker exec invoice-app supervisorctl restart backend
```

---

## Bezpečnost

### Doporučení

1. ✅ Použijte HTTPS v produkci
2. ✅ Nastavte silný `SESSION_SECRET` (min. 64 znaků)
3. ✅ Necommitujte `.env.production` do gitu
4. ✅ Pravidelně aktualizujte Docker image
5. ✅ Monitorujte logy pro neobvyklou aktivitu
6. ✅ Zálohujte databázi pravidelně

### Firewall

Ujistěte se, že pouze port 80/443 je exponován:

```bash
# Ověřit otevřené porty
netstat -tuln | grep LISTEN

# Docker kontejner by měl poslouchat pouze na localhost:9080
# Nginx pak forwarduje traffic z portu 80/443
```

---

## Support

Pro problémy nebo otázky:

1. Zkontrolujte [Troubleshooting](#troubleshooting)
2. Prohlédněte logy: `docker logs invoice-app`
3. Otevřete issue na GitHubu

---

## Architektura

```
Internet
    ↓
Nginx (NAS) :80/:443
    ↓
Docker Container :9080
    ├─ Nginx (frontend + proxy)
    │   ├─ Static files (React)
    │   └─ /api/* → Backend
    └─ Node.js Backend :3000
        ├─ Express API
        ├─ Azure AD OAuth
        ├─ Microsoft Graph
        ├─ Gemini AI
        └─ SQLite DB (/app/data)
```

---

**Poslední aktualizace:** 2025-01-17
