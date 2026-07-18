# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Was ist das

Web-App zur KI-gestützten Erstellung menschlicher Charaktere (für Buch/Spiel):
Vorgaben im Formular → OpenAI erzeugt Fließtext + strukturierte Merkmale
(Tabelle) → Portrait via `gpt-image-1` → speichern in SQLite, verwalten in
einer Galerie mit Gruppen/Projekten.

## Befehle

```bash
npm run dev            # Dev-Server (Next.js + Turbopack) → http://localhost:3000
npm run build          # Produktions-Build
npm run lint           # ESLint
npx tsc --noEmit       # Typecheck – der primäre Korrektheits-Check (s. u.)
npx prisma migrate dev --name <name>   # Schema-Änderung: Migration + Client neu generieren
npx prisma generate    # Prisma-Client neu generieren (nach Schema-Änderungen)
```

- **Es gibt keine Testsuite.** Als Standard-Verifikation dient `npx tsc --noEmit`;
  für Verhaltensprüfungen wird der Dev-Server gestartet und per `curl` gegen die
  API-Routen getestet (z. B. Text-/Bildgenerierung, CRUD).
- Nach `prisma migrate dev`/`generate` **den Dev-Server neu starten**, sonst nutzt
  der laufende Prozess ggf. noch den alten generierten Client / kennt neue Routen
  nicht.

## Setup / Env

- `.env.local` (gitignored) braucht `OPENAI_API_KEY`; optional
  `OPENAI_TEXT_MODEL` / `OPENAI_IMAGE_MODEL`. `gpt-image-1` erfordert ggf. eine
  verifizierte OpenAI-Organisation.
- `.env` enthält `DATABASE_URL="file:./dev.db"` (relativ zum Repo-Root).
- `dev.db` (SQLite) und `app/generated/prisma` sind gitignored; nach dem Klonen
  `npm install` + `npx prisma migrate dev` ausführen.

## Architektur (Big Picture)

Next.js 16 **App Router**, React 19, TypeScript, Tailwind v4 (rein CSS-basiert
über `@import "tailwindcss"` in `app/globals.css`, **keine** `tailwind.config`).

Zwei Seiten: `/` (Erstellen; Client-Komponente mit Umschaltung Formular-/
Ergebnis-Ansicht) und `/gallery`.

**Server/Client-Trennung:** Sämtlicher OpenAI- und DB-Zugriff liegt in den
API-Routen unter `app/api/*` (Node-Runtime). Der OpenAI-Key wird nur
serverseitig über `getOpenAI()` genutzt und erreicht nie den Browser. Client-
Komponenten sprechen die Routen ausschließlich über die typisierten Helfer in
`lib/client.ts` an.

**Ablauf:** Formular → `POST /api/generate-text` (OpenAI
`chat.completions.parse` + `zodResponseFormat` → strukturiertes
`GeneratedCharacter`) → Anzeige Text + Merkmals-Tabelle → `POST
/api/generate-image` (liefert Base64-Data-URL) → `POST /api/characters`
(Prisma) speichern.

**API-Routen:**
- `POST /api/generate-text`, `POST /api/generate-image` – OpenAI (persistieren
  nichts).
- `GET|POST /api/characters` – Liste / Anlegen (POST akzeptiert optional `groupId`).
- `GET|PATCH|DELETE /api/characters/[id]` – **PATCH ist ein Teil-Update**
  (`.partial()`): jedes von `name`, `imageData`, `groupId`, `shortDescription`,
  `description`, `traits` kann einzeln geändert werden. Alle nachträglichen
  Bearbeitungen in der Galerie laufen darüber.
- `GET|POST /api/groups`, `DELETE /api/groups/[id]` – Gruppen/Projekte.

**Editierbare Felder:** Name, Kurzbeschreibung, Beschreibung und alle Merkmale
sind in beiden Ansichten editierbar. In der Erstellen-Ansicht wandern die
Änderungen in den Charakter-State und werden beim Speichern übernommen; in der
Galerie werden sie über PATCH persistiert. Merkmals-Änderungen laufen über den
`withTrait`-Helfer in `schema.ts` (konvertiert `alter` in eine Zahl).

**Zentrale Module in `lib/`:**
- `schema.ts` – Zod-Schemas & Typen (`CharacterInput`, `CharacterTraits` mit
  `TRAIT_LABELS`, `GeneratedCharacter`, `IMAGE_STYLES`). **Single source of
  truth**, von Client und Server geteilt.
- `prompts.ts` – `buildTextPrompt` / `buildImagePrompt`. Der Bild-Prompt wird
  aus Optionen `{ includeTraits, visualDetails, extraPrompt }` + Kurzbeschreibung
  (Szenen-Kontext) + Stilbeschreibung zusammengesetzt. **Hier** wird der Bild-Look
  getunt.
- `openai.ts` – serverseitiger OpenAI-Client + Modell-IDs aus der Env.
- `imageProvider.ts` – `ImageProvider`-Interface abstrahiert das Bild-Backend
  (aktuell OpenAI `gpt-image-1`); Austauschpunkt für z. B. Flux/Replicate.
- `visualDetails.ts` – separater LLM-Aufruf, der aus dem langen Beschreibungstext
  nur bildrelevante Details extrahiert (bei `includeTextDetails`).
- `prisma.ts` – Prisma-Client-Singleton **mit better-sqlite3 Driver-Adapter**.
- `serialize.ts` – DB-Zeile ↔ Client-Form (`StoredCharacter`, `StoredGroup`).
- `client.ts` – **einziger** Weg, wie Client-Komponenten die API ansprechen
  (typisierte fetch-Helfer für Generierung, CRUD, Umbenennen, Bild/Inhalt
  aktualisieren, Gruppen).
- `templates.ts` – statische Genre-Vorlagen; belegen beim Auswählen im Formular
  per Merge das `setting`-Feld vor.
- `image.ts` – `fileToDataUrl` (clientseitig): Bild-Upload einlesen,
  herunterskalieren, als Data-URL zurückgeben (gleiche Form wie generierte Bilder).

**Nennenswerte Komponenten** (`app/components/`): `CharacterPdf.tsx` erzeugt den
PDF-Export via `@react-pdf/renderer` (nur Browser, wird in der Galerie
**dynamisch** importiert); `AutoTextarea.tsx` ist eine randlose, mit dem Inhalt
mitwachsende Textarea für die editierbaren Textfelder.

**Datenmodell** (`prisma/schema.prisma`): `Character` (Felder `input` und
`traits` als **JSON-Strings**, `imageData` als Base64-Data-URL, optionale
`groupId`) und `Group` (`onDelete: SetNull` – beim Löschen der Gruppe bleiben
Charaktere erhalten). SQLite lokal.

## Nicht-offensichtliche Fallstricke

- **Structured Outputs + Zod:** `openai.chat.completions.parse` mit
  `zodResponseFormat` verwenden. **Kein** `z.number().int()` in Schemas, die an
  OpenAI gehen – `.int()` erzeugt `minimum`/`maximum`, was Structured Outputs
  ablehnt; stattdessen `z.number()`.
- **Prisma 7 braucht einen Driver-Adapter:** `PrismaBetterSqlite3`
  (`@prisma/adapter-better-sqlite3`) ist in `lib/prisma.ts` verdrahtet; ein
  blankes `new PrismaClient()` funktioniert nicht.
- Der generierte Prisma-Client liegt in `app/generated/prisma`; Typen aus
  `@/app/generated/prisma/client` importieren. Nach Schema-Änderungen
  `npx prisma generate` **und Dev-Server neu starten**.
- Bilder werden als Base64-Data-URLs direkt in SQLite gespeichert → Antworten von
  `GET /api/characters` können mehrere MB groß sein. Lokal ok; für ein späteres
  Vercel-Deployment auf Postgres + Blob-Storage umstellen (Migrationsweg steht in
  der `README.md`).
- **Dark Mode ist klassenbasiert:** `app/globals.css` definiert
  `@custom-variant dark (&:where(.dark, .dark *))`, d. h. `dark:`-Utilities
  hängen an der Klasse `.dark` am `<html>` – **nicht** an
  `prefers-color-scheme`. Gesetzt wird sie vom blockierenden Inline-Skript
  (`THEME_INIT_SCRIPT` in `lib/theme.ts`, im `<head>` des Root-Layouts, gegen
  Theme-Flash) und danach vom `ThemeToggle` (Hell/Dunkel/System, Wahl in
  `localStorage`). `<html>` trägt deshalb `suppressHydrationWarning`.
- Pfad-Alias `@/*` zeigt auf den Repo-Root.
- `@react-pdf/renderer` ist **browser-only** und wird deshalb nur im Klick-Handler
  **dynamisch** importiert (`await import(".../CharacterPdf")`), nicht statisch –
  sonst bläht es das Bundle auf bzw. bricht serverseitig.
- Diese Next.js-Version (16) hat Breaking Changes ggü. älterem Wissen – siehe
  `AGENTS.md` (oben importiert): vor Next-spezifischem Code die Doku unter
  `node_modules/next/dist/docs/` konsultieren.
