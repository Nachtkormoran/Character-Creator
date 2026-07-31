# Deployment-Plan: Charakter Creator auf einem Hostinger VPS

Gegenstück zu `VERCEL+SUPABASE.md` und `VERCEL_MIGRATION.md`, aber mit einer
grundlegend anderen Ausgangslage.

## Kernidee — warum ein VPS zu **dieser** App passt

Ein VPS ist ein persistenter Linux-Server mit echtem Dateisystem und einem
dauerhaft laufenden Node-Prozess. Damit läuft der Charakter Creator **fast
unverändert**:

- **SQLite bleibt.** Die Datei `dev.db` lebt auf der Platte weiter – kein
  Umstieg auf Postgres, kein Treiber-Tausch, keine neue Migrationshistorie.
- **Die Bilder bleiben in der DB.** Base64-Data-URLs in SQLite sind auf einem
  VPS kein Problem (das war der Vercel-Killer: dort ist das FS flüchtig und die
  Funktionen sind zustandslos). Kein Blob-Storage, keine Storage-Abstraktion.
- **Das Backup-Feature funktioniert.** `VACUUM INTO` und der Datei-Restore
  laufen gegen eine echte Datei – der „kaputte Knopf" aus dem Vercel-Plan
  entsteht gar nicht.

Der Preis dafür ist der **Betrieb**: Du bist Admin. Server härten, TLS,
Prozess-Neustart, Backups und Updates liegen bei dir statt bei einer Plattform.
Der Code-Aufwand ist dafür nahe null; der Aufwand steckt in Einrichtung und
Wartung.

> **Kurz:** Vercel = viel Code-Umbau, kein Serverbetrieb. VPS = kein Code-Umbau,
> dafür Serverbetrieb. Für eine Ein-Benutzer-App mit SQLite ist der VPS der
> deutlich direktere Weg.

---

## Was am Code **nicht** geändert werden muss

- Prisma-Provider (`sqlite`) und der `better-sqlite3`-Adapter in `lib/prisma.ts`.
- Bild-Speicherung (Base64 in `CharacterImage` / `ScenarioImage`).
- Die Text-/Bild-Routen, `getTextClient()`, das Backup-Feature.

## Was du **vor** dem öffentlichen Deploy zwingend erledigen musst

**Die App hat keinerlei Zugriffsschutz.** Jede Person mit der URL kann:

1. Text- und Bildgenerierung auslösen → **dein OpenAI-Guthaben verbrennen**
   (jeder Charakter kostet echtes Geld, `gpt-image-1` besonders).
2. Über `POST /api/backup` **den gesamten Datenbestand ersetzen** (die UI fragt
   nach, die Route selbst nicht).
3. Alles löschen (Charaktere, Szenarien, Bilder).

Deshalb ist ein Zugriffs-Gate **Pflicht** (Phase 7), bevor die Domain öffentlich
erreichbar ist. Der schnellste vollwertige Schutz ist HTTP-Basic-Auth im Nginx
über **alles** (inkl. `/api`).

---

## Phase 0 — VPS auswählen (Hostinger KVM)

Hostinger bietet KVM-VPS (echte virtuelle Maschine, root-Zugang), nicht nur
Shared Hosting. Shared Hosting scheidet aus – dort läuft **kein** dauerhafter
Node-Prozess und du hast kein root für Nginx/systemd.

| Tarif | vCPU / RAM | Eignung |
|---|---|---|
| KVM 1 | 1 / 4 GB | Läuft, aber der `next build` ist knapp – **Swap-File anlegen** (s. Phase 3). |
| **KVM 2** | 2 / 8 GB | **Empfehlung.** Build, Laufzeit und SQLite mit Reserve. |
| KVM 4 | 4 / 16 GB | Überdimensioniert für einen Nutzer; erst bei viel Last/vielen Bildern. |

- **OS:** Ubuntu 24.04 LTS (langer Support, gute Node-/Nginx-Pakete).
- **Platte:** NVMe; SQLite + Bilder wachsen langsam. Ein Bild ≈ 2 MB (Original)
  + 40 KB (Thumbnail); selbst tausende Bilder bleiben im niedrigen GB-Bereich.

---

## Phase 1 — Server-Grundabsicherung

Direkt nach dem Aufsetzen, **vor** allem anderen:

1. **Non-root-Benutzer** mit sudo anlegen (z. B. `deploy`), root-SSH-Login
   deaktivieren.
2. **SSH nur per Schlüssel** (`PasswordAuthentication no` in
   `/etc/ssh/sshd_config`).
3. **Firewall** (`ufw`): nur 22 (SSH), 80 (HTTP), 443 (HTTPS) offen.
   ```bash
   ufw default deny incoming
   ufw allow OpenSSH
   ufw allow 'Nginx Full'
   ufw enable
   ```
4. **fail2ban** gegen SSH-Brute-Force.
5. **Automatische Sicherheits-Updates** (`unattended-upgrades`).

Hostinger bietet in hPanel teils vorkonfigurierte Templates (z. B. „Ubuntu mit
…"); die obigen Schritte trotzdem prüfen.

---

## Phase 2 — Laufzeitumgebung installieren

- **Node.js 22 LTS** – über NodeSource oder `fnm`/`nvm` (nicht das veraltete
  Ubuntu-Paket). Next 16 / React 19 brauchen ein aktuelles Node.
- **Build-Werkzeuge für `better-sqlite3`** – das ist ein **natives Modul**, das
  beim `npm ci` auf dem Server kompiliert wird (`node-gyp`):
  ```bash
  apt install -y build-essential python3 git
  ```
  Fehlt das, bricht `npm ci` mit einem Kompilierfehler ab. (Das ist der einzige
  „exotische" Punkt der Installation – Folge davon, dass Prisma 7 den
  `better-sqlite3`-Adapter nutzt.)

---

## Phase 3 — App holen, konfigurieren, bauen

Als `deploy`-Benutzer, z. B. in `/home/deploy/charakter-creator`.

1. **Repo klonen** (privates Repo → Deploy-Key oder Personal Access Token).

2. **Datenverzeichnis außerhalb des Checkouts** anlegen, damit ein Redeploy die
   DB nie berührt:
   ```bash
   mkdir -p /home/deploy/data
   ```

3. **Env-Dateien** anlegen. Next.js lädt `.env.local`/`.env` automatisch; die
   Prisma-CLI braucht `DATABASE_URL` zusätzlich beim Migrieren.

   `.env.local` (App-Secrets, gitignored):
   ```
   OPENAI_API_KEY=sk-...
   # optional:
   # OPENAI_TEXT_MODEL=gpt-4o
   # OPENAI_IMAGE_MODEL=gpt-image-1
   # GEMINI_API_KEY=...
   # GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
   # GEMINI_TEXT_MODEL=gemini-flash-lite-latest
   ```

   `.env` (Prisma):
   ```
   DATABASE_URL="file:/home/deploy/data/prod.db"
   ```
   **Absoluter Pfad** statt `file:./dev.db` – so liegt die DB stabil im
   Datenverzeichnis, unabhängig davon, aus welchem Ordner ein Kommando läuft,
   und ein frischer Clone kann sie nicht überschreiben.

4. **Swap** (nur bei KVM 1, gegen OOM beim Build):
   ```bash
   fallocate -l 2G /swapfile && chmod 600 /swapfile
   mkswap /swapfile && swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   ```

5. **Installieren, generieren, migrieren, bauen:**
   ```bash
   npm ci
   npx prisma generate            # app/generated/prisma ist gitignored → hier erzeugen
   npx prisma migrate deploy      # legt prod.db an und spielt alle Migrationen ein
   npm run build
   ```
   Wichtig: `migrate deploy`, **nicht** `migrate dev` – die Produktionsvariante
   erzeugt/verändert kein Schema interaktiv und setzt nichts zurück.

6. **Optional: Bestandsdaten übernehmen.** Willst du deine lokale `dev.db`
   mitnehmen, spiel sie **nach** dem ersten Start über das Backup-Feature ein
   (UI → Einstellungen → Wiederherstellen) oder kopiere die Datei per `scp` an
   `/home/deploy/data/prod.db` (bei gestopptem Dienst, gleiche Schema-Version).

---

## Phase 4 — Prozess dauerhaft laufen lassen (**genau eine Instanz**)

> **Kritisch:** `better-sqlite3` arbeitet **in-process** auf einer Datei. Es
> darf nur **einen** Node-Prozess geben. Kein PM2-Cluster (`pm2 -i max`), keine
> mehreren Worker – mehrere Schreiber auf dieselbe SQLite-Datei führen zu
> Sperren und Datenfehlern. Also **Fork-Modus, eine Instanz**.

**Variante A — systemd (empfohlen, kein Zusatz-Tool):**

`/etc/systemd/system/charakter-creator.service`:
```ini
[Unit]
Description=Charakter Creator (Next.js)
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/charakter-creator
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOST=127.0.0.1
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
```bash
systemctl enable --now charakter-creator
```
`HOST=127.0.0.1` bindet den Node-Server nur lokal – erreichbar ist er
ausschließlich über Nginx (Phase 5).

**Variante B — PM2:**
```bash
npm i -g pm2
pm2 start npm --name charakter-creator -- run start   # Fork-Modus, 1 Instanz
pm2 save && pm2 startup
```

---

## Phase 5 — Nginx als Reverse Proxy

Nginx nimmt 80/443 an und reicht an `127.0.0.1:3000` weiter. Zwei
App-spezifische Fallstricke:

- **`client_max_body_size` hochsetzen.** Die App schickt Bilder als ~2 MB
  Base64-Data-URLs, und der **Backup-Restore lädt die ganze DB hoch** (viele
  MB). Nginx-Default (1 MB) würde beides mit `413` abweisen.
- **Timeouts hochsetzen.** Die Text-/Bildrouten laufen bis ~120 s; der Proxy
  muss länger warten als der Default (60 s).

`/etc/nginx/sites-available/charakter-creator`:
```nginx
server {
    listen 80;
    server_name deine-domain.de;

    client_max_body_size 100m;      # Base64-Bilder + Backup-Restore

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 300s;    # lange Generierungs-Routen
        proxy_send_timeout 300s;
    }

    # Statische Next-Assets länger cachen (unveränderliche Hashes).
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```
```bash
ln -s /etc/nginx/sites-available/charakter-creator /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## Phase 6 — TLS (HTTPS)

Let’s Encrypt via Certbot – kostenlos, Auto-Renewal:
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d deine-domain.de
```
Certbot trägt die 443-Konfiguration in den Nginx-Block ein und richtet die
automatische Verlängerung ein (`systemctl status certbot.timer`).

---

## Phase 7 — Zugriffsschutz (Pflicht, s. o.)

**Schnellster vollwertiger Schutz – HTTP-Basic-Auth im Nginx über alles:**
```bash
apt install -y apache2-utils
htpasswd -c /etc/nginx/.htpasswd deinname
```
Im `location /`-Block (und damit auch für `/api`):
```nginx
auth_basic "Charakter Creator";
auth_basic_user_file /etc/nginx/.htpasswd;
```
Das genügt für private/kleine Nutzung: Ohne Zugangsdaten kommt **keine**
Anfrage bis zu Node und damit bis zu OpenAI durch – auch nicht an
`POST /api/backup`.

**Später, falls Mehrbenutzer/echtes Login gewünscht:** ein App-Login als
Middleware (die `Phase 4`-Skizze aus `VERCEL+SUPABASE.md` taugt als Vorlage,
nur ohne Supabase – z. B. ein einfaches Session-Cookie oder NextAuth) plus
Rate-Limiting auf den teuren Routen. Für den Start ist Basic-Auth ausreichend.

---

## Phase 8 — Backups (die DB ist **alles**: Texte **und** Bilder)

Geht `/home/deploy/data/prod.db` verloren, ist alles weg. Drei Ebenen:

1. **Täglicher DB-Snapshot per Cron** (konsistent via `VACUUM INTO`, wie das
   App-Backup):
   ```bash
   # crontab -e  (als deploy)
   0 3 * * * sqlite3 /home/deploy/data/prod.db \
     "VACUUM INTO '/home/deploy/backups/prod-$(date +\%F).db'"
   # + Rotation (z. B. find … -mtime +14 -delete)
   ```
2. **Offsite** – die Snapshots per `rsync`/`rclone` auf einen zweiten Ort (S3,
   anderer Server) ziehen. Ein Backup auf derselben Platte ist bei
   Platten-/Server-Verlust wertlos.
3. **Hostinger-VPS-Snapshots** (im hPanel) als zusätzliche
   Voll-Maschinen-Sicherung.

Das **App-eigene Backup** (Einstellungen → Sichern) bleibt als manueller,
bedienbarer Weg erhalten und funktioniert auf dem VPS unverändert.

---

## Phase 9 — Domain / DNS

- **A-Record** der Domain (bzw. Subdomain) auf die **IPv4** des VPS.
- Optional **AAAA-Record** auf die IPv6.
- DNS kann bei Hostinger oder beim Domain-Anbieter liegen; Certbot erst
  ausführen, wenn der Record aufgelöst wird.

---

## Phase 10 — Update-/Redeploy-Ablauf

Ein Skript `deploy.sh` im Repo-Ordner:
```bash
#!/usr/bin/env bash
set -euo pipefail
cd /home/deploy/charakter-creator
git pull
npm ci
npx prisma generate
npx prisma migrate deploy      # spielt neue Migrationen ein (Bestand bleibt)
npm run build                  # baut neben dem laufenden alten Stand
sudo systemctl restart charakter-creator   # bzw. pm2 reload
```
Der Build läuft, während der alte Stand noch bedient; der Neustart am Ende ist
eine kurze Unterbrechung (Sekunden). Bei jeder Schema-Änderung ist
`migrate deploy` der einzige DB-Schritt – die Daten bleiben erhalten (Details
zum Umgang mit „neuen Feldern" ohne Migration stehen im Betriebs-Abschnitt von
`VERCEL+SUPABASE.md`; die Prisma-Logik ist identisch, nur gegen SQLite).

---

## Optionale Verbesserungen (kein Muss)

- **`output: "standalone"`** in `next.config.ts` → deutlich schlankeres
  Deployment und weniger RAM zur Laufzeit (Next bündelt nur das Nötige). Kleiner
  Config-Zusatz; sinnvoll besonders auf KVM 1.
- **Bildkompression PNG → JPEG** (Quick Win aus `VERCEL+SUPABASE.md`, Phase 3a):
  senkt die DB-Größe und den Speicherbedarf beim Base64-Handling erheblich – auf
  dem VPS nicht Pflicht, aber die DB dankt es dir langfristig.
- **Logrotate/journald-Limits** für die Prozess-Logs.
- **Einfaches Monitoring** (Uptime-Ping + `systemctl status`), damit du einen
  Absturz bemerkst, bevor der Nutzer es tut.

---

## Kürzester Weg (Checkliste)

1. KVM 2 mit Ubuntu 24.04 bestellen.
2. Server härten (SSH-Key, ufw, deploy-User). — *Phase 1*
3. Node 22 + `build-essential python3 git`. — *Phase 2*
4. Repo klonen, `.env`/`.env.local`, `npm ci`, `prisma generate`,
   `migrate deploy`, `build`. — *Phase 3*
5. systemd-Dienst (eine Instanz). — *Phase 4*
6. Nginx-Proxy mit `client_max_body_size` + Timeouts. — *Phase 5*
7. Certbot-TLS. — *Phase 6*
8. **Basic-Auth** aktivieren. — *Phase 7*
9. Backup-Cron + Offsite. — *Phase 8*
10. DNS-A-Record. — *Phase 9*

Danach ist Betrieb = `deploy.sh` bei jeder Änderung.

---

## VPS vs. Vercel + Supabase — Entscheidungshilfe

| | **Hostinger VPS** | **Vercel + Supabase** |
|---|---|---|
| Code-Umbau | **keiner** (SQLite/Bilder bleiben) | groß (Postgres, Blob-Storage, Auth, Backup) |
| DB | SQLite-Datei, lokal | Postgres (verwaltet) |
| Bilder | Base64 in DB (unverändert) | müssen in Storage ausgelagert werden |
| Betrieb | **du** (Updates, TLS, Neustart, Backups) | Plattform |
| Skalierung | eine Maschine, ein Prozess (für 1 Nutzer okay) | automatisch |
| Kosten | fester VPS-Preis/Monat | Gratis-Kontingente + variabel |
| Passt, wenn … | du volle Kontrolle willst und Serverbetrieb okay ist | du **keinen** Server betreiben willst |

Für den aktuellen Stand (Ein-Nutzer, SQLite, Bilder in der DB) ist der VPS der
**technisch direkteste** Weg: online in Stunden statt nach einem Migrationsprojekt.

---

## Risiken / offene Punkte

- **Single Point of Failure.** Ein Server, eine Platte. Backups (Phase 8) sind
  deshalb nicht optional, sondern die eigentliche Versicherung.
- **Keine horizontale Skalierung.** SQLite + In-Process-Adapter = genau ein
  Prozess. Für einen Nutzer bedeutungslos, für viele parallele Nutzer die Grenze
  – dann wäre der Vercel/Postgres-Weg fällig.
- **Natives Modul bei Node-Upgrades.** Nach einem größeren Node-Wechsel
  `npm rebuild better-sqlite3` bzw. `npm ci` erneut ausführen.
- **`gpt-image-1`** erfordert weiterhin eine verifizierte OpenAI-Organisation –
  unabhängig vom Hosting.
- **DB-Wachstum durch Base64-Bilder.** Ohne die optionale JPEG-Kompression
  wächst `prod.db` merklich; im Blick behalten, Platte großzügig wählen.
