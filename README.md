# Charakter Creator

Eine Web-App, um glaubwürdige menschliche Charaktere für Buch oder Spiel zu erstellen.
Aus wenigen Vorgaben (Geschlecht, Aussehen, Hintergrund) erzeugt die App per OpenAI:

- einen **ausführlichen Charaktertext**,
- eine **Tabelle mit Körpermerkmalen** (Größe, Gewicht, …),
- ein **Portrait-Bild** (`gpt-image-1`).

Charaktere lassen sich **speichern** und in einer **Galerie** wiederfinden.

## Tech-Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **OpenAI API** – Text (`gpt-4o`, Structured Outputs) & Bild (`gpt-image-1`)
- **Prisma 7** + **SQLite** (lokal, dateibasiert)

## Einrichtung

1. Abhängigkeiten installieren (bereits geschehen, sonst):

   ```bash
   npm install
   ```

2. **OpenAI-API-Key eintragen** in [.env.local](.env.local):

   ```
   OPENAI_API_KEY=sk-...
   ```

   > Für `gpt-image-1` muss die OpenAI-Organisation ggf. verifiziert sein.
   > Modelle lassen sich dort ebenfalls über `OPENAI_TEXT_MODEL` /
   > `OPENAI_IMAGE_MODEL` anpassen.

3. Datenbank ist bereits migriert. Bei Schema-Änderungen:

   ```bash
   npx prisma migrate dev
   ```

4. Dev-Server starten:

   ```bash
   npm run dev
   ```

   → http://localhost:3000

## Start per Doppelklick (macOS)

Statt des Terminals genügt ein Doppelklick auf
[Charakter Creator starten.command](Charakter%20Creator%20starten.command)
im Finder. Das Skript startet den Dev-Server und öffnet die App im Browser,
sobald der Server antwortet.

Das Terminal-Fenster muss dabei **offen bleiben** – darin läuft der Server.
Beenden mit `Strg+C` oder durch Schließen des Fensters.

Drei Dinge nimmt es einem ab:

- **PATH ergänzen.** Der Finder startet Skripte mit einer minimalen Umgebung,
  in der weder `~/.local/node/bin` noch Homebrew noch nvm liegen – ohne das
  fände das Skript `npm` nicht.
- **`npm install`**, falls `node_modules` fehlt (nur beim ersten Mal).
- **Freien Port suchen** (ab 3000 aufwärts). Ist 3000 belegt, weicht Next.js
  von sich aus aus; der Browser zeigte dann auf die falsche Adresse.

Bleibt die Datei nach dem Klonen ohne Ausführrecht liegen, einmalig:

```bash
chmod +x "Charakter Creator starten.command"
```

## Projektstruktur

```
app/
  page.tsx                 Formular + Ergebnis (Text, Tabelle, Portrait)
  gallery/page.tsx         Gespeicherte Charaktere
  components/              Formular, Ergebnis, Merkmals-Tabelle
  api/
    generate-text/         → OpenAI Text (Structured Output)
    generate-image/        → OpenAI Bild (gpt-image-1)
    characters/            → Speichern / Laden / Löschen
  generated/prisma/        Generierter Prisma-Client (nicht editieren)
lib/
  schema.ts                Zod-Schemas & Typen (Eingaben, Merkmale)
  prompts.ts               Prompt-Bausteine für Text & Bild
  openai.ts                OpenAI-Client (nur serverseitig)
  imageProvider.ts         Austauschbare Bild-Provider-Abstraktion
  prisma.ts                Prisma-Client (SQLite via better-sqlite3)
  client.ts                Typisierte fetch-Helfer fürs Frontend
prisma/schema.prisma       Datenmodell
```

## Später: Deployment auf Vercel

- Prisma-`provider` in [prisma/schema.prisma](prisma/schema.prisma) auf
  `postgresql` umstellen (z. B. Vercel Postgres / Neon) und `DATABASE_URL`
  setzen. Die Modelle bleiben nahezu gleich.
- `OPENAI_API_KEY` als Environment-Variable in Vercel hinterlegen.
- Optional: Login/Authentifizierung ergänzen.
- Bilder werden aktuell als base64 in der DB abgelegt; für Produktion lohnt
  sich ein Blob-Storage (z. B. Vercel Blob).

## Bild-Provider wechseln

Die Bildgenerierung ist in [lib/imageProvider.ts](lib/imageProvider.ts) hinter
einem Interface gekapselt. Um z. B. Flux (via Replicate) statt OpenAI zu nutzen,
genügt eine weitere `ImageProvider`-Implementierung – der übrige Code bleibt
unverändert.
