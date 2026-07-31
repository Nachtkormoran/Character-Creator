# Migrationsplan: Deployment auf Vercel

Dieser Plan beschreibt, was nötig ist, um den **Charakter Creator** von der
lokalen SQLite-Variante auf ein produktives Vercel-Deployment zu bringen.

Er ist nach **Phasen** geordnet: Phase 1–2 sind Pflicht (ohne sie startet die
App auf Vercel gar nicht), Phase 3–5 verhindern Kosten-, Limit- und
Sicherheits­überraschungen im Betrieb. Jede Phase ist für sich lauffähig und
kann einzeln umgesetzt und getestet werden.

> **Grundproblem:** Vercel-Functions laufen in einer **serverlosen, ephemeren
> Umgebung mit schreibgeschütztem Dateisystem**. Alles, was auf eine lokale
> Datei schreibt (die SQLite-`dev.db`, das Backup-Feature), funktioniert dort
> nicht. Und die native Binding `better-sqlite3` lässt sich nicht sinnvoll in
> eine Function bundeln.

---

## Überblick: Was ist schon in Ordnung

Vor dem Umbau festgehalten, damit klar ist, was **nicht** angefasst werden muss:

- **Alle API-Routen deklarieren bereits `export const runtime = "nodejs"`** –
  keine Route läuft versehentlich auf Edge (wo OpenAI-SDK/Prisma nicht liefen).
- **Die langlaufenden KI-Routen haben bereits `maxDuration = 120`**
  (`generate-image`, `scenario-image`, `backup`). Siehe aber Phase 3 zum
  Plan-Limit.
- **Server/Client-Trennung stimmt:** OpenAI-Key und DB-Zugriff liegen
  ausschließlich in `app/api/*` und `lib/*` (Node-Runtime), erreichen also nie
  den Browser.
- **Bild-Erzeugung ist hinter `lib/imageProvider.ts` gekapselt** – der
  Austauschpunkt für die *Speicherung* (Phase 4) ist damit klein.

---

## Entscheidung: Wo liegt die Datenbank? (Neon)

Gesetzter Weg: **Neon-Postgres, provisioniert über die
Vercel-Marketplace-Integration**, in **derselben Region** wie die Functions
(und möglichst nah an OpenAI).

**Warum Neon:**
- **Serverless-nativ mit eingebautem Connection-Pooling (PgBouncer).** Löst das
  Kernproblem serverloser Functions: jede Invocation ist ein Kaltstart, ohne
  Pooling gehen die DB-Verbindungen aus. Die gepoolte URL kommt out of the box.
- **Scale-to-zero.** Diese App ist eine Ein-Personen-App und meistens idle; die
  DB schläft ein und kostet real ~0 €. Das Free-Tier reicht bequem.
- **Ist faktisch „Vercel Postgres".** Vercel provisioniert über die
  Marketplace-Integration Neon (bzw. Supabase). Über diesen Weg werden
  `DATABASE_URL` (gepoolt) und die direkte URL **automatisch als Env-Variablen**
  ins Projekt injiziert – genau die beiden Strings aus Phase 1.5.
- **Branching.** Praktisch für den Migrations-Neustart (Phase 1.4): eine Branch
  für die frische Postgres-Baseline, ohne Prod anzufassen.

**Wichtige Bedingung:** Das gilt nur, wenn die **Bilder nach Blob wandern**
(Phase 4). Bleiben die 2-MB-Base64-Originale in Postgres, sprengt das jedes
Free-Tier und macht Listen-Queries langsam. Also: **DB = Metadaten + kleine
Thumbnails, Bilder = Vercel Blob.** Dann bleibt die Datenmenge winzig und der
DB-Anbieter fast eine Formalie.

**Nicht empfohlen:**
- **Self-Hosting zu Hause**, nur um „lokal" zu bleiben – reintroduziert eine
  Always-on-Abhängigkeit (Rechner läuft, Port erreichbar, Backups) und koppelt
  den Cloud-Deploy an die eigene Uptime. Das widerspricht dem Sinn des Deploys.

**Erwägenswert nur als Sonderfall – Turso (libSQL / Cloud-SQLite):** die einzige
Option, die die SQLite-Semantik aus dem Dual-Target-Betrieb in die Cloud trägt
(dann wäre der `provider` in beiden Welten „sqlite-artig"). Nachteile: Prisma
läuft über einen eigenen Adapter, kleineres Ökosystem, und den
Pooling-/Serverless-Komfort von Neon gibt es nicht geschenkt. Nur wählen, wenn
Provider-Gleichheit lokal↔cloud wichtiger ist als alles andere.

---

## Phase 1 — Datenbank: SQLite → Postgres (Pflicht)

Ziel: dateibasierte SQLite durch eine gehostete Postgres-DB ersetzen.
**Anbieter: Neon** (siehe Entscheidung oben).

### 1.1 Postgres-Instanz anlegen
- In Vercel unter *Storage* eine Postgres-DB (Neon) erstellen **oder** eine
  externe Neon/Supabase-DB verwenden.
- Es gibt **zwei** Connection-Strings: eine **gepoolte** (über PgBouncer, für
  die App) und eine **direkte** (für Migrationen). Beide notieren.

### 1.2 Prisma-Schema umstellen
In [prisma/schema.prisma](prisma/schema.prisma):
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")        // gepoolt (Runtime)
  directUrl = env("DATABASE_URL_UNPOOLED") // direkt (Migrationen)
}
```
- Datentypen prüfen: Die Base64-Bilder liegen in `String`-Spalten. In Postgres
  wird daraus `text` – das ist unbegrenzt und funktioniert, ist aber der Grund
  für Phase 4 (große Zeilen). Fürs erste Lauffähigmachen genügt `text`.
- `@default(cuid())`, `DateTime`, `@updatedAt` etc. sind providerneutral und
  bleiben unverändert.

### 1.3 Treiber-Adapter tauschen
In [lib/prisma.ts](lib/prisma.ts) `PrismaBetterSqlite3` durch den Postgres-Adapter
ersetzen:
```ts
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}
```
- Paket: `npm i @prisma/adapter-pg` (und `@prisma/adapter-better-sqlite3` +
  `better-sqlite3` können später entfernt werden – **aber erst nach Phase 3**,
  weil das alte Backup-Modul sie noch importiert).
- Das Singleton-Muster mit `globalForPrisma` bleibt; auf Serverless ist es
  gegen Connection-Leaks bei Hot-Reload weiterhin sinnvoll.

### 1.4 Migrationen neu aufsetzen
Die bestehenden Migrationen unter `prisma/migrations/` sind **SQLite-SQL** und
für Postgres ungültig. Sauberster Weg:
- Den `migrations`-Ordner archivieren/verwerfen und **einmalig neu baseline-n**:
  `npx prisma migrate dev --name init` gegen eine leere Postgres-DB (lokal per
  direkter URL). Das erzeugt Postgres-taugliches SQL.
- Ab da normal weiterarbeiten.

### 1.5 Env-Variablen
`.env` / `.env.local` (lokal) und Vercel-Projekt-Settings (Prod):
```
DATABASE_URL=postgres://…            # gepoolt
DATABASE_URL_UNPOOLED=postgres://…   # direkt, nur für Migrationen
```

**Definition of done Phase 1:** Lokal gegen Postgres läuft `npm run dev`, ein
Charakter lässt sich anlegen, speichern und in der Galerie sehen.

---

## Phase 2 — Build-Pipeline auf Vercel (Pflicht)

Problem: `app/generated/prisma` ist **gitignored**, wird im Vercel-Build also
neu erzeugt. Ohne `prisma generate` fehlt der Client und der Build bricht.

### 2.1 Build- und Postinstall-Skripte
In `package.json`:
```json
"scripts": {
  "postinstall": "prisma generate",
  "build": "prisma generate && prisma migrate deploy && next build"
}
```
- `prisma migrate deploy` spielt ausstehende Migrationen bei jedem Deploy ein
  (idempotent). Nutzt `directUrl` aus 1.2.
- Alternativ die Migration aus dem Build herauslassen und manuell/als
  Release-Step fahren, falls die DB-Rechte im Build eng sind.

### 2.2 Vercel-Projektkonfiguration
- Framework-Preset: **Next.js** (autoerkannt).
- Node-Version auf die lokal genutzte pinnen (z. B. über `"engines"` in
  `package.json` oder Vercel-Setting), damit `better-sqlite3`-Reste bzw.
  native Module keinen Overlap erzeugen.
- Region möglichst nah an DB **und** OpenAI wählen (Latenz bei den KI-Routen).

**Definition of done Phase 2:** Ein Vercel-Preview-Deploy baut grün durch und
die App ist erreichbar; DB-Schema ist per `migrate deploy` vorhanden.

---

## Phase 3 — Backup-Feature cloud-tauglich machen (Pflicht, sonst kaputter Knopf)

[lib/backup.ts](lib/backup.ts) ist durchgängig SQLite-/dateisystem-spezifisch und
funktioniert auf Vercel **nicht**:
- `VACUUM INTO` (SQLite-only),
- Lesen/Schreiben der `.db`-Datei über `node:fs`,
- `.bak`-Sicherheitskopie neben `dev.db`,
- ein zweiter `PrismaClient` auf die hochgeladene Datei (via
  `better-sqlite3`).

Betroffen ist die Route [app/api/backup/route.ts](app/api/backup/route.ts) (GET
Export / POST Restore).

**Zwei Optionen – eine wählen:**

### Option A (schnell): Feature in der Cloud deaktivieren
- Die Backup-Route und den UI-Einstieg hinter einer Env-Flag verstecken
  (`ENABLE_DB_BACKUP`, lokal an, auf Vercel aus).
- Damit bleibt `better-sqlite3` nur im lokalen Pfad und der Cloud-Build braucht
  es nicht. Sauberste Trennung, wenn Backup vorerst nur lokal gebraucht wird.

### Option B (vollwertig): logisches JSON-Backup statt `.db`-Datei
- Export: alle Tabellen über Prisma lesen und als **JSON** ausliefern (statt
  eine SQLite-Datei). Import: JSON in einer Transaktion einspielen.
- **Achtung Response-Limit** (siehe Phase 4): Ein Voll-Export inkl. Base64-Bilder
  sprengt die ~4,5 MB Function-Antwortgrenze. Deshalb Option B sinnvoll **erst
  zusammen mit Phase 4** (Bilder als URLs statt Base64) oder mit Streaming/Chunking.
- Vorhandene Bausteine wiederverwendbar: `lib/characterFile.ts` /
  `lib/scenarioFile.ts` beschreiben bereits Serialisierungsformate.

**Empfehlung:** Für den ersten Launch **Option A**, Option B als Folgeschritt
nach Phase 4.

**Definition of done Phase 3:** Auf Vercel gibt es keinen Knopf, der eine
FS-Operation auslöst; lokal bleibt Backup nutzbar.

---

## Phase 4 — Bildgröße & externe Speicherung (dringend empfohlen)

Zwei Baustellen, die zusammengehören: die Bilder sind **zu groß** (4a) und
liegen am **falschen Ort** (4b). Erst verkleinern, dann auslagern – dann wandert
weniger nach Blob und die DB-Zeilen sind von vornherein schlank.

### Ausgangslage: Formate heute (gemessen im Code)

| Herkunft | Format heute | Größe | Fundstelle |
|---|---|---|---|
| **Generiertes Portrait** | **PNG, verlustfrei** | **~2 MB** (base64 +33 %) | `lib/imageProvider.ts` gibt fest `data:image/png;base64,…` zurück |
| Hochgeladenes Bild | JPEG q0.9, max 1024 px | ~200–400 KB | `fileToDataUrl` in `lib/image.ts` |
| Thumbnail | WebP q0.85, 640 px | ~40 KB | `makeThumbnail` in `lib/image.ts` |

**Nur die generierten PNG-Originale sind das Problem.** Sie liegen als
`~2 MB Base64-Data-URL` in `CharacterImage.imageData` / `ScenarioImage.imageData`.

Zwei konkrete Cloud-Probleme dadurch:
1. **Vercel-Function-Antwortlimit ~4,5 MB.** Einzelne Originale
   (`GET …/images/[imageId]`, `generate-image`) gehen gerade durch, aber jede
   Antwort mit mehreren Originalen und der Voll-Backup-Export überschreiten es.
2. **Postgres mit vielen MB-`text`-Zeilen** ist langsam und teuer; Listen-Routen
   lassen `imageData` ohnehin schon per `omit` weg.

---

### Phase 4a — Stärkere Kompression (Quick Win, auch lokal sinnvoll)

Ein 1024×1024-Portrait als **JPEG q0.9** liegt bei ~200–400 KB, als WebP q0.85 bei
~150–300 KB – gegenüber ~2 MB PNG **80–90 % weniger**, bei einem Portrait ohne
sichtbaren Verlust. Verkleinert die DB **sofort**, unabhängig vom Vercel-Umzug.

Drei Wege, vom saubersten zum robustesten:

1. **OpenAI direkt ein kleines Format liefern lassen** (bevorzugt). `gpt-image-1`
   kennt in der Images-API `output_format` (`png`/`jpeg`/`webp`) und
   `output_compression`. Dann entfällt das Nach-Kodieren ganz – eine Änderung in
   `lib/imageProvider.ts`, kein Client-Code.
   **Vor Umsetzung verifizieren, ob die SDK-Version (`openai ^6`) die Parameter
   durchreicht.**
2. **Client-seitig re-kodieren vor dem Speichern** (funktioniert unabhängig von
   der API). Am selben Ort wie `makeThumbnail`: aus dem PNG eine
   Speicher-Fassung via `canvas.toDataURL("image/jpeg", 0.9)` erzeugen.
3. **base64 → binär** – fällt beim Umzug nach Blob (4b) ohnehin an und spart die
   33 % base64-Overhead.

> ⚠️ **PDF-Kompatibilität beachten.** Der PDF-Export (`@react-pdf/renderer`) nutzt
> das **Original** (`imageData`) und kann **JPEG und PNG** zuverlässig, **WebP
> nicht**. Das gespeicherte Original deshalb auf **JPEG** umstellen (nicht WebP),
> sonst brechen Vollbild-PDF, Bild-Export und PDF. Thumbnails dürfen WebP bleiben
> – die sieht das PDF nie.

**Empfehlung:** Weg 1, Fallback Weg 2, Original als **JPEG q0.9**.

### Phase 4b — Externe Speicherung (Vercel Blob)

Ziel: das Original nicht mehr in der DB, sondern als Datei in Blob-Storage; in der
DB steht nur noch eine **Referenz** (URL).

**Vorbereitung, die dieselbe Schnittstelle für „lokal in DB" und „Blob in Cloud"
schafft** – so wird der Umzug ein Config-Wechsel, kein Rewrite:

- **Begriff ändern: `imageData` → `imageRef`.** Heute *ist* die Referenz die
  Base64-Data-URL, morgen eine Blob-URL. Wenn der Code mit einer „Referenz"
  arbeitet statt mit „den Bytes", ändert sich beim Umzug nur ihre *Bedeutung*.
- **`StorageProvider`-Abstraktion** – analog zu `lib/imageProvider.ts` (das die
  *Erzeugung* kapselt; hier geht es um die *Persistenz*):
  ```
  lib/storage/
    index.ts       ← Interface + Auswahl per Env (VERCEL?)
    dbStorage.ts   ← save = Data-URL in DB (heutiges Verhalten), load = Data-URL
    blobStorage.ts ← save = @vercel/blob put → URL, load = URL
  ```
  Interface etwa `save(dataUrl) → ref` und `load(ref) → url | dataUrl`.

**Nahtstellen** (klein und überschaubar):
- **Schreiben:** `lib/client.ts` (`saveCharacter`, `addCharacterImage`,
  Szenario-Pendants) sowie die Routen unter `app/api/characters/[id]/images/*`
  und `app/api/scenarios/[id]/images/*`.
- **Lesen:** die GET-Route `…/images/[imageId]` (laut CLAUDE.md „der einzige Weg
  ans Original").

**Schema anpassen:**
- `imageData` (Base64) → `imageRef` (String-URL). Thumbnails vorerst in der DB
  belassen (winzig) oder ebenfalls nach Blob.
- Migration + **Backfill-Skript** für Bestandsbilder (Base64 → Blob hochladen,
  Referenz eintragen). Vor dem Umschreiben Bestände sichern.

**Thumbnails bleiben clientseitig:** `makeThumbnail` (Canvas, nur Browser) erzeugt
weiterhin die 640-px-Fassung – nur das Ziel (Blob statt DB-Spalte) ändert sich
ggf.

### Phase 4c — Bestandsbilder schrumpfen (optional, Backfill)

4a betrifft nur **neue** Bilder. Die vorhandenen 2-MB-PNG-Zeilen schrumpft ein
einmaliger **Backfill** (PNG → JPEG). Wichtig: Das ist **keine SQL-Migration** –
SQL kann keine Bilder umkodieren –, sondern ein **Daten-Skript**, das jede
Bildzeile liest, dekodiert, als JPEG re-kodiert und zurückschreibt.

**Optional, nicht Voraussetzung** dafür, dass neue JPEGs laufen (alte PNGs und
neue JPEGs koexistieren problemlos, weil jede Data-URL ihren MIME selbst trägt und
alle Verbraucher ihn lesen). Nur nötig, wenn auch die **bestehenden** Zeilen
kleiner werden sollen.

**Zwei Wege:**
- **A) Server-seitig mit `sharp`** (empfohlen für einen Batch-Lauf) – neue,
  gut gepflegte native Dependency. Skizze als `tsx`-Skript (wie die vorhandenen
  Round-Trip-Prüfungen):
  ```
  für jede CharacterImage / ScenarioImage:
    wenn imageData mit "data:image/png" beginnt:
      buffer = Base64 → Buffer
      jpeg   = sharp(buffer).flatten({ background: "#fff" })
                            .jpeg({ quality: 90 }).toBuffer()
      schreibe "data:image/jpeg;base64," + jpeg.toString("base64") zurück
  ```
- **B) Browser-seitig über Canvas** – keine neue Dependency (`canvas.toDataURL(
  "image/jpeg", 0.9)` wie `makeThumbnail`), dafür manueller/langsamer (jedes
  Original einzeln über `getImage` laden). Nur lokal praktikabel.

**Fallstricke:**
1. **Vorher sichern.** Der Lauf überschreibt Originale **verlustbehaftet und
   irreversibel** – erst DB/`dev.db` sichern, dann laufen lassen.
2. **Speicher wird erst durch VACUUM frei.** Zeilen zu verkleinern schrumpft die
   Datei nicht automatisch: nach dem Lauf **`VACUUM`** (SQLite) bzw.
   `VACUUM (FULL)` / Autovacuum abwarten (Postgres).
3. **Nur echte PNGs anfassen** (am `data:image/png`-Präfix filtern); JPEG-Uploads
   sind schon klein und würden durch erneutes Kodieren nur leiden.
4. **Transparenz abflachen** (`flatten` auf Weiß) – JPEG kann kein Alpha; ein
   hochgeladenes transparentes PNG würde sonst schwarz.
5. **WebP bleibt tabu fürs Original** (PDF-Export) – hier ohnehin JPEG.
6. **Thumbnails nicht anfassen** – schon WebP und winzig.
7. **Referenzbild-Nutzung** (ein Charakterbild als Vorlage) wird minimal
   verlustbehaftet – für eine Stil-/Motivvorlage unkritisch.

**Zeitpunkt:** entweder **jetzt/lokal** (rein um die `dev.db` zu verkleinern,
unabhängig von Vercel) **oder gebündelt mit 4b** – wenn die Originale ohnehin nach
Blob wandern, im selben Durchgang transcodieren (PNG→JPEG **und** DB→Blob) statt
zweimal über dieselben Daten zu laufen.

### Reihenfolge innerhalb Phase 4

1. **4a Kompression** zuerst – sofortiger Gewinn, verkleinert auch das, was später
   nach Blob wandert, risikoarm.
2. **`imageData` → `imageRef` umbenennen** + `StorageProvider` mit `dbStorage` als
   Default (Verhalten wie heute, nur hinter der Abstraktion).
3. **`blobStorage`** + Backfill für den Cloud-Betrieb – dabei **4c** (PNG→JPEG)
   im selben Durchgang mitnehmen, falls Bestandsbilder existieren.

**Definition of done Phase 4:** Generierte Originale sind ~200–400 KB JPEG statt
~2 MB PNG; Bilder werden über eine `StorageProvider`-Abstraktion gespeichert/gelesen;
in der Cloud liegen Originale als Blob-URLs, keine Function-Antwort überschreitet
das Größenlimit; PDF-/Export-Pfad bleibt funktionsfähig.

---

## Phase 5 — Zugriffsschutz & Betrieb (dringend empfohlen)

### 5.1 Authentifizierung / Rate-Limiting
Die App hat **keinerlei Auth**. Öffentlich deployt bezahlt jeder Besucher mit
deinem `OPENAI_API_KEY` (Bildgenerierung ist teuer).
- Minimum: ein einfaches Passwort-/Login-Gate (z. B. Middleware mit
  Basic-Auth-Env oder ein Auth-Provider).
- Besser zusätzlich: Rate-Limiting auf den teuren Routen (`generate-image`,
  `scenario-image`, Text-Generierung), z. B. über Upstash/Vercel KV.

### 5.2 Function-Limits & Plan
- `maxDuration = 120` ist schon gesetzt, aber **der Vercel-Hobby-Plan deckelt
  bei 60 s** – für die 120-s-Routen wird **Pro** benötigt. Entweder Pro buchen
  oder prüfen, ob 60 s für `gpt-image-1` reichen.
- Function-Region nah an OpenAI/DB (Latenz).

### 5.3 Environment-Variablen (vollständige Liste in Vercel)
```
OPENAI_API_KEY=…
DATABASE_URL=…                 # gepoolt
DATABASE_URL_UNPOOLED=…        # direkt (Migrationen)
BLOB_READ_WRITE_TOKEN=…        # falls Phase 4 / Vercel Blob
# optional:
OPENAI_TEXT_MODEL=…  OPENAI_IMAGE_MODEL=…
TEXT_PROVIDER=…  GEMINI_API_KEY=…  GEMINI_BASE_URL=…  GEMINI_TEXT_MODEL=…
SHOW_MODEL=…  useModelOverrides/STORY_MODEL_* (siehe CLAUDE.md)
```
`.env.local` ist gitignored – die Werte manuell im Vercel-Dashboard hinterlegen.

### 5.4 Doku nachziehen
`README.md` und `AGENTS.md` um den Cloud-Betrieb ergänzen; die lokalen
Start-Hilfen (`Charakter Creator starten.command`, „Terminal offen lassen")
sind für Prod irrelevant und sollten als *nur lokal* gekennzeichnet werden.

---

## Deployment aus GitHub (empfohlener Weg)

Vercel mit dem GitHub-Repo verbinden und bei jedem Push automatisch bauen/deployen
(PRs bekommen Preview-Deploys) funktioniert und ist der empfohlene Weg. Damit der
Build durchläuft, müssen aus dem Repo-Zustand **drei Dinge** stimmen:

**1. Prisma-Client wird im Build erzeugt** (durch Phase 2 abgedeckt).
`app/generated/prisma` ist **gitignored**, kommt also nicht im Repo an. Der Build
muss ihn neu erzeugen (`postinstall: prisma generate`, Phase 2.1) – sonst bricht
er mit „Cannot find module @/app/generated/prisma".

**2. Committete Migrationen müssen zum DB-Provider passen** ⚠️ (der eigentliche Haken).
`prisma/migrations` **ist** eingecheckt, aber die 16 Migrationen sind **SQLite-SQL**
und `migration_lock.toml` schreibt `provider = "sqlite"` fest. `prisma migrate
deploy` gegen Neon-Postgres **schlägt damit fehl** (Provider-Mismatch + Dialekt).
Vor dem ersten GitHub→Vercel-Deploy muss die **Postgres-Baseline committet** sein
(Phase 1.4): SQLite-Migrationen archivieren, einmal `prisma migrate dev --name init`
gegen eine leere Neon-DB, die neuen Postgres-Migrationen (inkl. `migration_lock.toml`
mit `postgresql`) einchecken.
- **Dual-Target-Kollision:** Ein einziger `migrations`-Ordner kann nur *einen*
  Provider haben. Lokal SQLite **und** Postgres in der Cloud (Option B) erfordert
  getrennte Migrations-Historien + ein Build-Skript, das die richtige wählt.
  Vereinheitlichung auf Postgres/PGlite (Option A) hat nur eine Historie –
  deutlich einfacher für den GitHub-Flow.

**3. Secrets kommen aus Vercel, nicht aus dem Repo** (durch Phase 5.3 abgedeckt).
`.env*` ist gitignored – richtig so. `DATABASE_URL` und `OPENAI_API_KEY` liegen in
den Vercel-Projekt-Settings. Über die **Neon-Integration** werden
`DATABASE_URL`/`DATABASE_URL_UNPOOLED` automatisch injiziert – auch **zur
Build-Zeit**, was `migrate deploy` im Build braucht.

**Unkritisch:** `better-sqlite3` bleibt in `dependencies` (lokaler Pfad), wird auf
Vercel mitinstalliert (Prebuilt-Binaries, `npm install` läuft durch). Wichtig nur:
die Backup-Route auf Vercel deaktivieren (Phase 3, Option A), damit
`better-sqlite3` nicht in eine Function gebündelt/aufgerufen wird. Node-Version in
Vercel auf die lokale pinnen (`engines` in `package.json`).

**Kurz:** Standard-GitHub-Deploy trägt; einziger echter Blocker ist Punkt 2 – die
Migrationshistorie muss auf Postgres stehen und committet sein.

---

## Reihenfolge / kürzester Weg

1. **Phase 1 + 2** → App läuft überhaupt auf Vercel (Postgres + Build).
2. **Phase 3 (Option A)** → kein kaputter Backup-Knopf.
3. **Phase 5.1 + 5.2** → keine offene Kostenschleuder, richtiger Plan.
4. **Phase 4** → Skalierung/Limits sauber; danach ggf. **Phase 3 Option B**.

## Risiken / offene Fragen

- **Migrations-Neustart (1.4):** Die SQLite-Migrationshistorie ist nicht
  Postgres-kompatibel; ein sauberes Baseline ist einfacher als Konvertieren.
- **Bestandsdaten-Umzug:** Vorhandene lokale `dev.db` müsste – falls Daten
  übernommen werden sollen – separat nach Postgres migriert werden (Export der
  Zeilen, Reimport; Bilder dabei in Blob heben, Phase 4).
- **`better-sqlite3` erst nach Phase 3 entfernen**, sonst bricht das noch
  importierte Backup-Modul den Build.
