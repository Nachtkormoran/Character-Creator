# Migrationsplan: Deployment auf Vercel mit Supabase

Dieser Plan beschreibt den Umbau des **Charakter Creator** von der lokalen
SQLite-Variante auf ein produktives **Vercel-Deployment mit Supabase** als
Backend.

Er ist das **Supabase-Gegenstück** zu [VERCEL_MIGRATION.md](VERCEL_MIGRATION.md)
(die auf **Neon + Vercel Blob** zielt). Der Unterschied ist die Rollenverteilung:
Hier übernimmt **Supabase gleich drei Aufgaben** — **Postgres** (Datenbank),
**Storage** (Bild-Originale) und **Auth** (Zugriffsschutz). Genau die drei Dinge,
die diese App für den Serverless-Betrieb braucht, aus einer Hand.

Geordnet nach **Phasen**: Phase 1–2 sind Pflicht (ohne sie startet die App auf
Vercel gar nicht), Phase 3–6 verhindern Kosten-, Limit- und
Sicherheits­überraschungen. Jede Phase ist für sich lauffähig.

> **Grundproblem:** Vercel-Functions laufen in einer **serverlosen, ephemeren
> Umgebung mit schreibgeschütztem Dateisystem**. Alles, was auf eine lokale
> Datei schreibt (die SQLite-`dev.db`, das Backup-Feature) oder große Antworten
> liefert (die 2-MB-Base64-Bilder), funktioniert dort nicht oder schlecht. Und
> die native Binding `better-sqlite3` lässt sich nicht sinnvoll in eine Function
> bundeln.

---

## Überblick: Was schon in Ordnung ist

Damit klar ist, was **nicht** angefasst werden muss:

- **Alle API-Routen deklarieren bereits `export const runtime = "nodejs"`** –
  keine Route läuft versehentlich auf Edge (wo OpenAI-SDK/Prisma nicht liefen).
- **Die langlaufenden KI-Routen haben `maxDuration = 120`** (`generate-image`,
  `scenario-image`, `backup`). Siehe aber Phase 6 zum Plan-Limit.
- **Server/Client-Trennung stimmt:** OpenAI-Key und DB-Zugriff liegen
  ausschließlich in `app/api/*` und `lib/*` (Node-Runtime), erreichen also nie
  den Browser.
- **Bild-Erzeugung ist hinter [lib/imageProvider.ts](lib/imageProvider.ts)
  gekapselt** – der Austauschpunkt für die *Speicherung* (Phase 3) ist klein.
- **Der DB-Zugriff läuft komplett über Prisma** – der Provider-Wechsel
  SQLite→Postgres ist im App-Code fast unsichtbar (die `prisma.character.…`-
  Aufrufe bleiben identisch). Die Reibung sitzt nur an Adapter, Verbindungsstring
  und Migrationshistorie.

---

## Phase 1 — Datenbank: SQLite → Supabase Postgres (Pflicht)

Ziel: die dateibasierte SQLite durch die gehostete **Supabase-Postgres**-DB
ersetzen. Der App-Code (die Prisma-Abfragen) bleibt dabei praktisch unberührt.

### 1.1 Supabase-Projekt anlegen
- Auf supabase.com ein Projekt erstellen, **Region nahe Vercel** wählen (z. B.
  `eu-central-1` / Frankfurt, wenn die Vercel-Functions in Europa laufen).
- Beim Anlegen wird das **Datenbank-Passwort** gesetzt – notieren.

### 1.2 Die zwei Connection-Strings holen
Supabase stellt (unter *Project Settings → Database*) zwei Verbindungen bereit,
und die Unterscheidung ist für Serverless **entscheidend**:

- **Gepoolt (Supavisor, Transaction Mode, Port 6543)** – für die **App zur
  Laufzeit**. Jede Function-Invocation ist ein Kaltstart; ohne Pooling gehen die
  Postgres-Verbindungen aus. Diese URL bekommt den Zusatz
  `?pgbouncer=true&connection_limit=1`.
- **Direkt (Port 5432)** – **nur für Migrationen** (`prisma migrate`). Der Pooler
  im Transaction-Mode verträgt kein DDL/keine Migrationsläufe.

```
DATABASE_URL="postgresql://postgres.<ref>:<PWD>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:<PWD>@db.<ref>.supabase.co:5432/postgres"
```

### 1.3 Prisma-Schema umstellen
In [prisma/schema.prisma](prisma/schema.prisma) den Datasource-Block ändern:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // gepoolt (Runtime)
  directUrl = env("DIRECT_URL")     // direkt (Migrationen)
}
```
- Die **Modelle bleiben unverändert.** Die Base64-Bilder in `imageData` /
  `thumbnail` liegen in `String`-Spalten → in Postgres wird daraus `text`
  (unbegrenzt, funktioniert). Fürs erste Lauffähigmachen genügt das; es ist aber
  der Grund für Phase 3 (große Zeilen).
- `@default(cuid())`, `DateTime`, `@updatedAt`, `@relation … onDelete` sind
  providerneutral und bleiben.
- Den veralteten Kommentar oben in der Datei („Aktuell SQLite …") anpassen.

### 1.4 Treiber-Adapter tauschen
[lib/prisma.ts](lib/prisma.ts) nutzt heute `PrismaBetterSqlite3`. Auf den
Postgres-Adapter umstellen:
```ts
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();
```
- Paket: `npm i @prisma/adapter-pg`. `@prisma/adapter-better-sqlite3` +
  `better-sqlite3` können später raus – **aber erst nach Phase 5**, weil das
  Backup-Modul sie noch importiert.
- Das Singleton-Muster mit `globalForPrisma` bleibt (schützt bei Hot-Reload und
  auf Serverless gegen Connection-Leaks).

### 1.5 Migrationshistorie neu aufsetzen
Die bestehenden Migrationen unter [prisma/migrations/](prisma/migrations/) sind
**SQLite-SQL**, und `migration_lock.toml` schreibt `provider = "sqlite"` fest –
gegen Postgres schlägt `migrate deploy` damit fehl. Sauberster Weg:
- Den alten `migrations`-Ordner archivieren/verwerfen.
- Einmalig gegen eine **leere Supabase-DB** (per `DIRECT_URL`) neu baseline-n:
  `npx prisma migrate dev --name init`. Das erzeugt Postgres-taugliches SQL und
  ein `migration_lock.toml` mit `postgresql`.
- Die neuen Migrationen **einchecken** (nötig für den Vercel-Build, Phase 2).

### 1.6 Lokal ebenfalls auf Postgres (den Dual-Target-Konflikt auflösen)
**Ein Migrations-Ordner kann nur *einen* Provider haben.** Lokal SQLite und in
der Cloud Postgres zu fahren, hieße zwei getrennte Migrationshistorien zu
pflegen – unnötig fehleranfällig. Empfehlung: **lokal auch Postgres**, damit
lokal und Cloud identisch sind. Zwei bequeme Wege:
- **Supabase-CLI:** `supabase start` bringt einen lokalen Postgres + Storage +
  Auth im Docker-Stack hoch (spiegelt die Cloud am genauesten).
- **Nur Docker-Postgres**, wenn Storage/Auth lokal nicht gebraucht werden.

`.env.local` zeigt dann auf die lokale Postgres-Instanz statt auf `file:./dev.db`.

**Definition of done Phase 1:** Lokal gegen Postgres läuft `npm run dev`, ein
Charakter lässt sich anlegen, speichern und in der Galerie sehen; `prisma migrate
deploy` läuft gegen Supabase durch.

---

## Phase 2 — Build-Pipeline auf Vercel (Pflicht)

Problem: `app/generated/prisma` ist **gitignored**, wird im Vercel-Build also neu
erzeugt. Ohne `prisma generate` fehlt der Client und der Build bricht mit „Cannot
find module @/app/generated/prisma".

### 2.1 Build- und Postinstall-Skripte
In `package.json`:
```json
"scripts": {
  "postinstall": "prisma generate",
  "build": "prisma generate && prisma migrate deploy && next build"
}
```
- `prisma migrate deploy` spielt ausstehende Migrationen bei jedem Deploy ein
  (idempotent, nutzt `DIRECT_URL`).
- Alternativ die Migration aus dem Build herauslassen und als separaten
  Release-Step fahren, falls die Build-Rechte eng sein sollen.

### 2.2 Vercel-Projektkonfiguration
- Framework-Preset: **Next.js** (autoerkannt).
- Node-Version über `"engines"` in `package.json` pinnen (Konsistenz zur lokalen).
- **Function-Region = Supabase-Region** (z. B. beide Frankfurt) – DB-Latenz.

**Definition of done Phase 2:** Ein Vercel-Preview-Deploy baut grün durch, die App
ist erreichbar, das Schema ist per `migrate deploy` in Supabase vorhanden.

---

## Phase 3 — Bilder aus der DB → Supabase Storage (dringend, sonst kippt es)

Der **wichtigste** Umbau. Heute liegen die Originale als **~2-MB-Base64-Data-URL**
in `CharacterImage.imageData` / `ScenarioImage.imageData`
([prisma/schema.prisma](prisma/schema.prisma)). Zwei konkrete Cloud-Probleme:

1. **Vercel-Antwortlimit ~4,5 MB.** Ein einzelnes Original geht gerade durch,
   aber jede Antwort mit mehreren Originalen und der Voll-Backup-Export
   überschreiten es.
2. **Postgres mit vielen MB-`text`-Zeilen** ist langsam und teuer; die
   Listen-Routen lassen `imageData` ohnehin schon per `omit`/`select` weg.

Ziel: **Original als Datei in Supabase Storage**, in der DB nur noch eine
**Referenz**. Das Thumbnail (~40 KB WebP) darf vorerst in der DB bleiben.

### 3a — Kompression PNG → JPEG (Quick Win, auch lokal sinnvoll)

Die generierten Originale sind heute **PNG, verlustfrei, ~2 MB**
([lib/imageProvider.ts](lib/imageProvider.ts) gibt fest
`data:image/png;base64,…` zurück). Als **JPEG q0.9** wären es ~200–400 KB –
**80–90 % weniger**, bei einem Portrait ohne sichtbaren Verlust. Verkleinert
alles, was später nach Storage wandert.

- **Bevorzugt:** OpenAI direkt ein kleines Format liefern lassen. `gpt-image-1`
  kennt in der Images-API `output_format` (`jpeg`/`webp`) und
  `output_compression` – dann entfällt das Nach-Kodieren ganz, eine Änderung in
  `generatePortrait`. **Vorher prüfen, ob die SDK-Version (`openai ^6`) die
  Parameter durchreicht.**
- **Fallback:** clientseitig re-kodieren (wie `makeThumbnail` in
  [lib/image.ts](lib/image.ts), via `canvas.toDataURL("image/jpeg", 0.9)`).

> ⚠️ **PDF-Kompatibilität:** Der PDF-Export (`@react-pdf/renderer`) nutzt das
> **Original** und kann **JPEG und PNG** zuverlässig, **WebP nicht**. Das
> gespeicherte Original deshalb auf **JPEG** umstellen (nicht WebP), sonst brechen
> Vollbild-PDF und Export. Thumbnails dürfen WebP bleiben – die sieht das PDF nie.

### 3b — Storage-Abstraktion (`StorageProvider`)

Damit „lokal in DB" und „Supabase Storage in der Cloud" dieselbe Schnittstelle
haben und der Umzug ein Config-Wechsel bleibt (analog zu
[lib/imageProvider.ts](lib/imageProvider.ts), das die *Erzeugung* kapselt – hier
geht es um die *Persistenz*):

```
lib/storage/
  index.ts          ← Interface + Auswahl per Env (Supabase-Keys gesetzt?)
  dbStorage.ts      ← save = Data-URL in DB (heutiges Verhalten), load = Data-URL
  supabaseStorage.ts← save = supabase.storage.upload → Pfad; load = signierte URL
```
Interface etwa `save(dataUrl) → ref` und `load(ref) → url | dataUrl`.

- **Supabase-Client (serverseitig):** `@supabase/supabase-js` mit dem
  **Service-Role-Key** (nur in `app/api/*` / `lib/*`, nie im Browser).
- **Bucket** (z. B. `images`), **privat**. Ausgeliefert wird über **signierte
  URLs** (`createSignedUrl`, kurze Gültigkeit) – die App liegt ohnehin hinter Auth
  (Phase 4). Alternativ ein öffentlicher Bucket mit unrat­baren Pfaden.

### 3c — Schema & Nahtstellen

**Begriff ändern: `imageData` → `imageRef`.** Heute *ist* die Referenz die
Base64-Data-URL, morgen ein Storage-Pfad. Wenn der Code mit einer „Referenz"
arbeitet statt „den Bytes", ändert sich beim Umzug nur ihre *Bedeutung*.

- **Schema:** `imageData` (Base64) → `imageRef` (String-Pfad/-URL) in
  `CharacterImage` **und** `ScenarioImage`. Thumbnail vorerst in der DB.
- **Schreiben:** [lib/client.ts](lib/client.ts) (`saveCharacter`,
  `addCharacterImage`, Szenario-Pendants) sowie die Routen unter
  `app/api/characters/[id]/images/*` und `app/api/scenarios/[id]/images/*`.
- **Lesen:** die GET-Route `…/images/[imageId]`
  ([app/api/characters/[id]/images/[imageId]/route.ts](app/api/characters/[id]/images/[imageId]/route.ts))
  gibt heute `{ imageData }` (Base64) zurück; künftig eine **(signierte) URL**.
  Der Client-Helfer `getImage` liefert dann eine URL statt einer Data-URL – die
  Verbraucher (Vollbild-`<img>`, `@react-pdf` und `downloadImage` in
  [lib/download.ts](lib/download.ts)) kommen mit einer URL zurecht (`downloadImage`
  holt sie per `fetch`).

### 3d — Backfill der Bestandsbilder

Migration + **Daten-Skript** (keine SQL-Migration – SQL kann keine Bilder
hochladen): jede Bildzeile lesen, Base64 dekodieren, nach Storage `put`en, die
Referenz eintragen; im selben Durchgang **PNG → JPEG** transcodieren (3a).
**Vorher sichern.** Verlustbehaftet und irreversibel.

**Definition of done Phase 3:** Generierte Originale sind ~200–400 KB JPEG;
Originale liegen in Supabase Storage, in der DB steht nur die Referenz; keine
Function-Antwort überschreitet das 4,5-MB-Limit; PDF-/Export-Pfad funktioniert.

---

## Phase 4 — Zugriffsschutz mit Supabase Auth (Pflicht bei öffentlichem Deploy)

Die App hat **keinerlei Auth**. Öffentlich deployt zahlt **jeder Besucher mit
deinem `OPENAI_API_KEY`** (Bildgenerierung ist teuer). Hier spielt Supabase seine
Stärke aus: **Auth out of the box.**

### 4.1 Login-Gate
- `@supabase/ssr` einbinden; eine **Middleware** (`middleware.ts` im Repo-Root)
  frischt die Session auf und **schützt App **und** API-Routen**.
- Für eine **Ein-Personen-App** genügt eine Allowlist aus **einer** erlaubten
  E-Mail (oder Magic-Link/Passwort nur für dich). Registrierung deaktivieren.

### 4.2 Rate-Limiting auf den teuren Routen
- Zusätzlich zum Login ein Limit auf `generate-image`, `scenario-image` und den
  Text-Routen (z. B. via Upstash Redis / Vercel KV) – schützt gegen versehentliche
  Schleifen und, falls doch mehrere Nutzer, gegen Missbrauch.

**Definition of done Phase 4:** Ohne Login kommt niemand an die App oder die
API-Routen; die teuren Routen sind zusätzlich ratenbegrenzt.

---

## Phase 5 — Backup-Feature cloud-tauglich machen (sonst kaputter Knopf)

[lib/backup.ts](lib/backup.ts) ist durchgängig SQLite-/dateisystem-spezifisch
(`VACUUM INTO`, Lesen/Schreiben der `.db` über `node:fs`, `.bak`-Kopie, zweiter
`PrismaClient` via `better-sqlite3`) und läuft auf Vercel **nicht**. Betroffen ist
`app/api/backup/route.ts` (GET Export / POST Restore).

**Zwei Optionen – eine wählen:**

### Option A (schnell): in der Cloud deaktivieren
- Route und UI-Einstieg hinter eine Env-Flag (`ENABLE_DB_BACKUP`, lokal an, auf
  Vercel aus). Damit bleibt `better-sqlite3` nur im lokalen Pfad, der Cloud-Build
  braucht es nicht.

### Option B (vollwertig): logisches JSON-Backup
- Export: alle Tabellen über Prisma lesen und als **JSON** ausliefern; Import:
  JSON in einer Transaktion einspielen. Sinnvoll **erst nach Phase 3** (sonst
  sprengen die Base64-Bilder das Antwortlimit). Bausteine wiederverwendbar:
  [lib/characterFile.ts](lib/characterFile.ts) / [lib/scenarioFile.ts](lib/scenarioFile.ts).

**Empfehlung:** Für den ersten Launch **Option A**, Option B als Folgeschritt.

**Definition of done Phase 5:** Auf Vercel löst kein Knopf eine FS-Operation aus;
lokal bleibt Backup nutzbar.

---

## Phase 6 — Function-Limits, Plan & Env-Variablen

### 6.1 Vercel-Plan wegen der 120-s-Routen
- `maxDuration = 120` ist gesetzt, aber **Vercel-Hobby deckelt bei 60 s**. Für
  `generate-image` / `scenario-image` wird **Vercel Pro** benötigt (dort bis
  300 s). Alternativ prüfen, ob `gpt-image-1` in 60 s fertig wird.

### 6.2 Environment-Variablen (vollständig, in Vercel hinterlegen)
```
OPENAI_API_KEY=…
DATABASE_URL=…                     # Supabase gepoolt (6543, ?pgbouncer=true)
DIRECT_URL=…                       # Supabase direkt (5432, Migrationen)
NEXT_PUBLIC_SUPABASE_URL=…         # Auth (Browser)
NEXT_PUBLIC_SUPABASE_ANON_KEY=…    # Auth (Browser)
SUPABASE_SERVICE_ROLE_KEY=…        # Storage/Admin (nur serverseitig!)
# optional / bestehend:
OPENAI_TEXT_MODEL=…  OPENAI_IMAGE_MODEL=…
TEXT_PROVIDER=…  GEMINI_API_KEY=…  GEMINI_BASE_URL=…  GEMINI_TEXT_MODEL=…
MISTRAL_API_KEY=…  MISTRAL_BASE_URL=…  MISTRAL_TEXT_MODEL=…
SHOW_MODEL=…  USE_MODEL_OVERRIDES=…  STORY_MODEL_*=…
ENABLE_DB_BACKUP=false             # Phase 5, Option A
```
`.env*` ist gitignored – die Werte manuell im Vercel-Dashboard hinterlegen. Den
**Service-Role-Key niemals** mit `NEXT_PUBLIC_` präfixen (er darf nie in den
Browser).

---

## Deployment aus GitHub (empfohlener Weg)

Vercel mit dem GitHub-Repo verbinden, bei jedem Push automatisch bauen/deployen
(PRs bekommen Preview-Deploys). Damit der Build durchläuft, müssen **drei Dinge**
stimmen:

1. **Prisma-Client wird im Build erzeugt** (Phase 2.1) – `app/generated/prisma`
   ist gitignored.
2. **Committete Migrationen passen zum Provider** ⚠️ (der eigentliche Haken): die
   Postgres-Baseline aus Phase 1.5 muss eingecheckt sein (`migration_lock.toml`
   mit `postgresql`), sonst scheitert `migrate deploy` an Supabase.
3. **Secrets kommen aus Vercel, nicht aus dem Repo** (Phase 6.2).

**Unkritisch, aber sauber:** `better-sqlite3` erst **nach Phase 5** aus
`dependencies` entfernen (das Backup-Modul importiert es noch).

---

## Betrieb: Schema-Umbauten in der Cloud (Leitfaden für später)

Wie läuft ein DB-Umbau (neues Feld, neue Tabelle) ab, wenn die DB auf Supabase
liegt? Im Kern **wie heute** – Prisma abstrahiert die Datenbank, der Handgriff ist
derselbe. Neu ist nur, **wo/wann** die Migration angewandt wird und dass jetzt
**echte Live-Daten** in der Cloud liegen.

### Zuerst: Viele „neue Felder" brauchen gar keine Migration

Ein großer Teil der Daten liegt als **JSON-String in Sammelspalten** (`details`,
`traits`, `input`, `plotVariants`, `storyArcVariants`, `storyHooks`). Ein neues
Feld *innerhalb* dieser Objekte ist **keine DB-Änderung** – kein `ALTER TABLE`,
kein Deploy-Risiko; alte Zeilen füllt beim Lesen `normalize…` auf. Ein neues
Szenario-Feld kostet „zwei Zeilen in `schema.ts`, keine Migration". Das gilt in
der Cloud unverändert.

Eine echte Migration braucht nur eine **neue echte Spalte** am Modell oder ein
**neues Objekt/Tabelle** (wie zuletzt `ScenarioImage`).

### Der Ablauf für eine echte Struktur-Änderung

**Lokal (Entwicklung) – wie heute:**
1. [prisma/schema.prisma](prisma/schema.prisma) bearbeiten (Feld/Model).
2. `npx prisma migrate dev --name add_xyz` → erzeugt die Migrations-SQL unter
   [prisma/migrations/](prisma/migrations/), wendet sie auf die **lokale** DB an,
   generiert den Client neu.
3. Dev-Server neu starten, Migration + Schema-Änderung **committen und pushen**.

**In die Cloud (Supabase) – automatisch beim Deploy:**
4. Push → Vercel baut → das Build-Skript ruft **`prisma migrate deploy`**
   (Phase 2.1) und wendet **nur die noch nicht angewandten** Migrationen auf
   Supabase an, über die **`DIRECT_URL`** (Port 5432, nicht den Pooler).

Supabase wird also **nicht von Hand migriert** – der Deploy erledigt es idempotent.

| Befehl | wofür | wo |
|---|---|---|
| `prisma migrate dev` | Migration **erzeugen** + anwenden | **nur lokal** (Dev-DB) |
| `prisma migrate deploy` | vorhandene Migrationen **nur anwenden** | Cloud, im Vercel-Build |

⚠️ **`migrate dev` niemals gegen die Produktions-DB** – es kann zurücksetzen und
Drift „reparieren". Produktion bekommt ausschließlich `migrate deploy`.

### Neu in der Cloud: Live-Daten

Lokal war eine Migration gegen die Wegwerf-`dev.db` harmlos. In Supabase liegen
echte Daten:

- **Additiv = sicher, ohne Ausfall.** Eine **neue nullable Spalte** oder eine
  **neue Tabelle** stört bestehende Zeilen nicht (so war es bei `ScenarioImage`).
- **Destruktiv/verändernd = Plan nötig.** Spalte umbenennen/löschen oder `NOT
  NULL` erzwingen, wo Daten liegen → **mehrstufig**: Spalte hinzufügen →
  **Backfill** → Code umstellen → alte Spalte entfernen. Genau das Muster der
  `ScenarioImage`-Migration, die vorhandene Weltbilder **erst kopierte, bevor** die
  alten Spalten fielen.
- **Backfill** schreibt man in die Migrations-SQL (wie bei `ScenarioImage`) oder –
  wenn SQL es nicht kann (z. B. Bilder umkodieren) – als separates `tsx`-Skript.

### Absicherung

- **Vor riskanten Migrationen sichern.** Supabase macht automatische Backups
  (täglich; Point-in-Time auf höheren Tiers). Passt zur Merkregel „vor dem Löschen
  sichern".
- **Supabase-Branching:** eine DB-Branch anlegen, die Migration dort testen, erst
  dann auf die Haupt-DB loslassen – ideal für Heikles.
- **Nur über Prisma migrieren, nie im Supabase-UI.** Direkte Schema-Änderungen im
  SQL-Editor erzeugen **Drift**; der Dashboard-Editor ist zum Schauen, nicht zum
  Ändern.
- **Vorsicht bei Preview-Deploys:** Ein Preview auf dieselbe Supabase-DB fährt
  `migrate deploy` gegen **Produktion**. Für riskante Migrationen Previews auf eine
  separate Branch-DB richten (oder `migrate deploy` im Preview weglassen).
- **Kein Auto-Rollback.** Prisma-Migrationen sind vorwärtsgerichtet – zurück geht es
  über eine Gegen-Migration oder ein Backup-Restore. Destruktives vorher
  durchdenken.

---

## Reihenfolge / kürzester Weg

1. **Phase 1 + 2** → App läuft überhaupt auf Vercel (Supabase-Postgres + Build).
2. **Phase 4** → kein offener OpenAI-Key (bei öffentlichem Preview zwingend).
3. **Phase 5 (Option A)** → kein kaputter Backup-Knopf.
4. **Phase 3** → Bilder in Storage, Antwortlimit entschärft, DB schlank; danach
   ggf. **Phase 5 Option B** und **Vercel Pro** (Phase 6) je nach 120-s-Bedarf.

---

## Unterschiede zu VERCEL_MIGRATION.md (Neon + Blob)

| Aufgabe | Neon-Plan | **Dieser Plan (Supabase)** |
|---|---|---|
| Datenbank | Neon-Postgres | **Supabase-Postgres** |
| Pooling | Neon-Pooler (PgBouncer) | **Supavisor** (Port 6543) |
| Bild-Storage | Vercel Blob (`@vercel/blob`) | **Supabase Storage** (`@supabase/supabase-js`) |
| Auth | offen (eigenes Gate nötig) | **Supabase Auth** (out of the box) |
| Env-Injektion | Neon-Vercel-Integration | Supabase-Keys manuell/Integration |

**Kern gleich in beiden:** SQLite → Postgres über Prisma (Adapter/Provider/neue
Migrationshistorie), Bilder aus der DB in Object-Storage (nur Referenzen in der
DB), PNG→JPEG, Backup umbauen, Zugriffsschutz, Pro-Plan für die 120-s-Routen. Der
Supabase-Weg bündelt DB + Storage + Auth bei **einem** Anbieter; der Neon-Weg
verteilt sie auf Neon + Vercel Blob + eigenes Auth.

---

## Risiken / offene Fragen

- **Migrations-Neustart (1.5):** Die SQLite-Historie ist nicht Postgres-kompatibel;
  ein sauberes Baseline ist einfacher als Konvertieren.
- **Pooler-Feinheiten:** Transaction-Mode (6543) verträgt kein DDL → Migrationen
  strikt über `DIRECT_URL`. Bei `@prisma/adapter-pg` `?pgbouncer=true&connection_limit=1`
  an der Runtime-URL prüfen.
- **Bestandsdaten-Umzug:** Die lokale `dev.db` müsste – falls Daten übernommen
  werden sollen – separat nach Postgres migriert werden (Zeilen exportieren,
  reimportieren; Bilder dabei nach Storage heben, Phase 3d).
- **`better-sqlite3` erst nach Phase 5 entfernen**, sonst bricht das noch
  importierte Backup-Modul den Build.
- **Service-Role-Key** ist ein Vollzugriff auf Supabase – ausschließlich
  serverseitig verwenden, nie `NEXT_PUBLIC_`.
