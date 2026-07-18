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

Drei Seiten: `/` (Erstellen; Client-Komponente mit Umschaltung Formular-/
Ergebnis-Ansicht), `/gallery` und `/settings`.

**Server/Client-Trennung:** Sämtlicher OpenAI- und DB-Zugriff liegt in den
API-Routen unter `app/api/*` (Node-Runtime). Der OpenAI-Key wird nur
serverseitig über `getOpenAI()` genutzt und erreicht nie den Browser. Client-
Komponenten sprechen die Routen ausschließlich über die typisierten Helfer in
`lib/client.ts` an.

**Ablauf:** Formular → `POST /api/generate-text` (OpenAI
`chat.completions.parse` + `zodResponseFormat` → strukturiertes
`GeneratedCharacter`) → Anzeige Text + Merkmals-Tabelle → `POST
/api/generate-image` (liefert Base64-Data-URL) → `POST /api/characters`
(Prisma) speichern. **Nach dem Speichern schließt die Ergebnis-Ansicht**
(zurück zum Formular, mit grünem Hinweis + Link zur Galerie). Das ist kein
Komfort, sondern nötig: die Ansicht kennt keine Charakter-ID, jeder weitere
Klick auf „Speichern" wäre ein **neues** `POST` und damit ein Duplikat. Der
Knopf allein reicht als Schutz nicht – `setSaved(false)` macht ihn nach jedem
neu erzeugten oder hochgeladenen Bild wieder scharf.

**API-Routen:**
- `POST /api/generate-text`, `POST /api/generate-image`,
  `POST /api/generate-name` – OpenAI (persistieren nichts).
- `GET|POST /api/characters` – Liste / Anlegen (POST akzeptiert optional
  `groupId`, `imageData` und `thumbnail`; ein mitgegebenes Bild wird das erste
  und primäre). **Keine Route liefert `imageData` in einer Liste** (`omit`),
  sonst wären es mehrere MB pro Aufruf; für die Anzeige genügt das Thumbnail
  des Primärbilds.
- `GET|PATCH|DELETE /api/characters/[id]` – **PATCH ist ein Teil-Update**
  (`.partial()`): jedes von `name`, `groupId`, `shortDescription`,
  `description`, `traits` kann einzeln geändert werden. Alle nachträglichen
  Text-Bearbeitungen in der Galerie laufen darüber. **Bilder nicht** – die
  haben eigene Routen.
- `POST /api/characters/[id]/images` – Bild hinzufügen (wird standardmäßig zum
  Primärbild).
- `GET|PATCH|DELETE /api/characters/[id]/images/[imageId]` – **GET ist der
  einzige Weg an ein Original** (Vollbild, Bild-Export, PDF holen es hier);
  PATCH `{ isPrimary: true }` wählt das Primärbild; DELETE löscht das Bild.
  Alle drei schreibenden Routen geben den vollständigen, aktualisierten
  Charakter zurück, damit der Client seinen Zustand einfach ersetzen kann.
- `GET|POST /api/groups`, `DELETE /api/groups/[id]` – Gruppen/Projekte.
- `GET|PATCH /api/settings` – App-Einstellungen (`imageModel`, `imageQuality`).
- `GET|POST /api/backup` – Datenbank sichern / wiederherstellen. **POST
  ersetzt den gesamten Bestand** (Bestätigung passiert in der UI).

**Mehrere Bilder pro Charakter:** Ein Charakter hat beliebig viele Bilder
(`CharacterImage`), genau eines ist `isPrimary` und wird überall groß gezeigt
(Karte, Detailansicht, PDF, Export). Die Bilder-Ansicht ist bewusst **nicht**
Teil der Detailansicht, sondern eine eigene Ebene darüber
(`CharacterImagesModal`, `z-70`); die gesamte Bild-Bedienung (Stil,
Zusatz-Details, Merkmale/Textdetails-Checkboxen, Referenzbild, Erzeugen,
Hochladen, **Exportieren**) liegt dort und **nur** dort. Die Detailansicht
zeigt nur das Primärbild plus den Knopf „Bilder verwalten (n)"; ihr
verbliebener Export-Knopf ist der fürs **PDF**. Der Bild-Export sitzt an der
einzelnen Kachel, damit jedes Bild einzeln herunterladbar ist – bei mehr als
einem Bild bekommt die Datei ihre Position angehängt (`Name_2.png`), sonst
überschrieben sich die Downloads gegenseitig.

**Editierbare Felder:** Name, Kurzbeschreibung, Beschreibung und alle Merkmale
sind in beiden Ansichten editierbar. Am Namensfeld hängen in **beiden**
Ansichten zwei Knöpfe: 🎲 würfelt lokal, ✨ fragt die KI. Im Formular speisen
sie sich aus den Vorgaben, in der Galerie aus der **Merkmalstabelle** (dort ist
der Name schon vergeben, geändert wird nachträglich). In der Erstellen-Ansicht wandern die
Änderungen in den Charakter-State und werden beim Speichern übernommen; in der
Galerie werden sie über PATCH persistiert. Merkmals-Änderungen laufen über den
`withTrait`-Helfer in `schema.ts` (konvertiert `alter` in eine Zahl).

**Zentrale Module in `lib/`:**
- `schema.ts` – Zod-Schemas & Typen (`CharacterInput`, `CharacterTraits` mit
  `TRAIT_LABELS`, `GeneratedCharacter`, `IMAGE_STYLES`). **Single source of
  truth**, von Client und Server geteilt.
- `prompts.ts` – `buildTextPrompt` / `buildImagePrompt`. Der **Wunschname**
  (`input.name`, optional) wird hier ausgewertet: ein einzelnes Wort gilt als
  Vorname und wird um einen passenden Nachnamen ergänzt, ab zwei Wörtern gilt
  der Name als vollständig und bleibt unverändert. Die Namens-Anforderung
  **ersetzt** dabei die freie Namenswahl in der Anforderungsliste – beide
  nebeneinander wären widersprüchlich. `buildNamePrompt` ist der Prompt für
  den KI-Namensknopf und bewusst **sehr knapp**: Aussehen, Persönlichkeit und
  „Weitere Wünsche" fließen nicht ein, weil sie den Namen nicht verbessern,
  aber Tokens kosten. Die Route `generate-name` nutzt aus demselben Grund
  `chat.completions.create` mit `max_tokens` statt Structured Outputs – ein
  JSON-Schema für einen einzelnen String wäre reiner Aufschlag. Gemessen:
  110 Token rein, 5 raus, rund **0,03 Cent pro Namen**. Der Body ist
  `{ input, traits? }`: die Merkmale kennt nur die Galerie, und sie haben im
  Prompt **Vorrang** vor den Formular-Vorgaben (Geschlecht, Alter, Herkunft) –
  sie beschreiben den fertigen Charakter, die Vorgaben nur den Wunsch. Der Bild-Prompt wird
  aus Optionen `{ includeTraits, visualDetails, extraPrompt }` + Kurzbeschreibung
  (Szenen-Kontext) + Stilbeschreibung zusammengesetzt. **Hier** wird der Bild-Look
  getunt. Neben `stilBeschreibung` gibt es `framingBeschreibung`: Der
  Standard-Bildaufbau verlangt eine Umgebung mit Tiefenschärfe, „Skizze"
  schließt sie ausdrücklich aus (nur dort weicht auch die Kontextzeile ab).
  Bei einem neuen Stil also prüfen, ob der Standard-Bildaufbau passt.
- `openai.ts` – serverseitiger OpenAI-Client + Modell-IDs aus der Env.
- `imageProvider.ts` – `ImageProvider`-Interface abstrahiert das Bild-Backend
  (aktuell OpenAI); Austauschpunkt für z. B. Flux/Replicate. **Sind
  `referenceImages` gesetzt, läuft die Erzeugung über `images.edit` statt
  `images.generate`** – der Prompt geht dabei unverändert mit, die Vorlage
  kommt hinzu. `gpt-image-2` unterstützt `images.edit` nicht und wird mit
  einer verständlichen Meldung abgefangen.
- `visualDetails.ts` – separater LLM-Aufruf, der aus dem langen Beschreibungstext
  nur bildrelevante Details extrahiert (bei `includeTextDetails`).
- `prisma.ts` – Prisma-Client-Singleton **mit better-sqlite3 Driver-Adapter**.
- `characterImages.ts` – **alle** serverseitigen Bild-Operationen
  (`loadCharacter(s)`, `addImage`, `setPrimaryImage`, `deleteImage`). Sie liegen
  zusammen, weil sie eine Regel halten müssen, die die DB nicht erzwingt:
  **genau ein Bild pro Charakter ist `isPrimary`**. Jede Änderung läuft in einer
  Transaktion, die zuerst alle anderen Markierungen entfernt. Löschen des
  Primärbilds lässt das neueste verbliebene nachrücken.
- `serialize.ts` – DB-Zeile ↔ Client-Form (`StoredCharacter`, `StoredImage`,
  `StoredGroup`). `primaryImage(c)` leitet das anzuzeigende Bild ab – bewusst
  abgeleitet statt als eigenes Feld mitgeschickt, sonst läge das Thumbnail des
  Primärbilds doppelt in jeder Antwort (Listen-Antwort: 465 KB statt 914 KB).
- `client.ts` – **einziger** Weg, wie Client-Komponenten die API ansprechen
  (typisierte fetch-Helfer für Generierung, CRUD, Umbenennen, Bild/Inhalt
  aktualisieren, Gruppen).
- `backup.ts` – Export/Import der SQLite-Datei. Export per **`VACUUM INTO`**
  (konsistenter Snapshot; ein blankes Kopieren der Datei kann bei parallelen
  Schreibzugriffen unvollständig sein). Import kopiert **Zeilen** in einer
  Transaktion statt die Datei auszutauschen – Prisma hält eine offene
  Verbindung, ein Dateitausch im Betrieb würde sie ins Leere laufen lassen.
  Gelesen wird die hochgeladene Datei über einen **zweiten PrismaClient** mit
  `$queryRawUnsafe('SELECT *')`, damit auch ältere Schema-Stände mit fehlenden
  Spalten funktionieren. Fehlt die Tabelle `CharacterImage` (Sicherung von vor
  der Mehrbild-Umstellung), wird aus `Character.imageData` je ein Primärbild
  gebaut – sonst verlören alte Sicherungen ihre Portraits. Vor dem Überschreiben entsteht eine `*.bak`-Kopie
  neben `dev.db` (in `.gitignore`).
- `settings.ts` – serverseitiger Zugriff auf die `Setting`-Tabelle
  (Key-Value: `imageModel`, `imageQuality`). **Vorrang: gespeicherter Wert →
  Env → Default (`gpt-image-1` / `medium`).** Gespeicherte Werte stammen aus
  dem Browser und werden gegen die Allowlists `IMAGE_MODELS` / `IMAGE_QUALITIES`
  geprüft. Beim **Modell** wird der Env-Wert (`OPENAI_IMAGE_MODEL`) als
  vertrauenswürdige Server-Konfiguration **ungeprüft** durchgereicht
  (Escape-Hatch für nicht gelistete Modelle); bei der **Qualität** nicht – die
  API kennt nur `low|medium|high`. Weil die Tabelle Key-Value ist, brauchen
  neue Einstellungen **keine Migration**.
  Die Preistabelle `IMAGE_PRICES_USD` in `schema.ts` ist nur eine Anzeige-Hilfe
  (Stand-Datum in `IMAGE_PRICES_AS_OF`, ohne Gewähr) und beeinflusst nichts.
- `templates.ts` – statische Genre-Vorlagen; belegen beim Auswählen im Formular
  per Merge das `setting`-Feld vor.
- `inspiration.ts` – je 100 Bausteine für die Würfel an „Aussehen",
  „Persönlichkeit" und „Hintergrund"; `pickSome` zieht mehrere **ohne
  Wiederholung**. Hier gibt es bewusst **keine Genre-Markierung** wie bei den
  Berufen: die Einträge sind so formuliert, dass sie überall passen (Körper und
  Auftreten statt Kleidungsstücke, Lebensereignisse statt setting-gebundener
  Stationen). Der Hintergrund verbindet mit **Semikolon**, weil seine Einträge
  selbst Kommas enthalten.
- `professions.ts` – 300 Berufe für den Würfel am Feld „Beruf / Rolle", jeder
  mit den Genres markiert, in die er passt (`randomProfession(genre)` filtert
  danach). Die Markierung ist der Zweck der Struktur: eine flache Liste würde
  einen „Netrunner" ins Mittelalter würfeln. Ohne Treffer steht die ganze Liste
  zur Auswahl. Berufe stehen in der Grundform, das Textmodell passt sie ans
  Geschlecht an.
- `names.ts` – Namensvorrat für den Würfel-Knopf: neun Kulturkreise à 200 Namen
  plus `GENRE_CULTURES` (Genre → Kulturkreise) und `randomName`. **Rein lokal,
  ohne API** – der Knopf lebt davon, dass man ihn mehrmals drückt, und das
  verträgt keine Netzwerk-Wartezeit. `randomName` bestimmt den Kulturkreis
  nach Spezifität: **Herkunft (Freitext) → Genre-Id → Setting (Freitext) →
  Gegenwart-Mix**. Die Galerie hat keine Genre-Id mehr, deshalb der Umweg über
  das Setting. Die Stichwortlisten decken bewusst **nur ab, was die Namens-
  listen hergeben** – für alles andere (z. B. „tibetisch") ist der KI-Knopf da;
  eine falsche Zuordnung wäre schlechter als der neutrale Mix.
- `image.ts` – clientseitige Bildhelfer: `fileToDataUrl` (Upload einlesen und
  herunterskalieren), `makeThumbnail` (640 px, WebP 0,85) und
  `fileToReferenceDataUrl` für Referenzbilder. Letzteres kodiert bewusst
  **verlustfrei** (unverändert bzw. PNG bis 1536 px): das Modell liest die
  Vorlage aus und kann JPEG-Artefakte als gewollte Bildmerkmale missdeuten.
  Alle brauchen Canvas, laufen also nur im Browser.
- `download.ts` – clientseitige Download-Helfer (`downloadBlob`,
  `imageExtension`, `safeFileName`, `downloadImage`). Geteilt, weil sowohl der
  PDF-Export in der Galerie als auch der Bild-Export je Kachel sie braucht.

**Referenzbilder:** Optionale Stil-/Motivvorlage pro Generierung, in beiden
Ansichten über `ReferenceImagePicker`. Sie gilt **nur für die Sitzung** und
wird nicht am Charakter gespeichert. Zwei Quellen: eine Datei vom Rechner oder
(nur in der Bilder-Ansicht, über die Zusatz-Schaltfläche `onChooseOwn`) ein
**anderes Bild desselben Charakters**. Letzteres holt bewusst das **Original**
über `getImage`, nicht das Thumbnail der Kachel – aus demselben Grund, aus dem
`fileToReferenceDataUrl` verlustfrei kodiert. Beachte: OpenAI erzeugt keine
stilisierten Bilder identifizierbarer realer Personen – deshalb ist das Feld
als „Stil- und Motivvorlage" beschriftet, nicht als Ähnlichkeitsfunktion. Bei
gesetzter Vorlage können die Merkmale aus der Tabelle mit dem Bild kollidieren
(z. B. Haarfarbe); die UI weist darauf hin.

**Nennenswerte Komponenten** (`app/components/`): `CharacterPdf.tsx` erzeugt den
PDF-Export via `@react-pdf/renderer` (nur Browser, wird in der Galerie
**dynamisch** importiert); `AutoTextarea.tsx` ist eine randlose, mit dem Inhalt
mitwachsende Textarea für die editierbaren Textfelder.

**Datenmodell** (`prisma/schema.prisma`): `Character` (Felder `input` und
`traits` als **JSON-Strings**, optionale `groupId`), `CharacterImage`
(`imageData` als Base64-Data-URL, `thumbnail` als verkleinerte Fassung davon,
`isPrimary`; `onDelete: Cascade` – Bilder gehen mit dem Charakter),
`Group` (`onDelete: SetNull` – beim Löschen der Gruppe bleiben
Charaktere erhalten) und `Setting` (Key-Value für App-Einstellungen). SQLite
lokal.

## Nicht-offensichtliche Fallstricke

- **Altbestände und neue Merkmale:** Wird `characterTraitsSchema` um ein Feld
  erweitert, fehlt es allen zuvor gespeicherten Charakteren – Bildgenerierung
  und Bearbeiten scheitern dann mit „Ungültige Eingaben". `serialize.ts` füllt
  fehlende Merkmale deshalb über `normalizeTraits` auf. Bei einer Erweiterung
  trotzdem die Bestandsdaten nachziehen, damit die DB sauber bleibt.
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
- **Zwei Bildgrößen pro Bild:** `imageData` ist das Original (1024×1024,
  ~2 MB Base64), `thumbnail` die 640-px-WebP-Fassung (~40 KB). **Anzeige immer
  aus `thumbnail`**, **Vollbild, Bild-Export und PDF aus `imageData`** – und
  das kommt ausschließlich über `getImage(id, imageId)`. Das Thumbnail entsteht
  clientseitig in `lib/client.ts` (`saveCharacter`, `addCharacterImage`), damit
  keine Aufrufstelle es vergessen kann; schlägt es fehl, wird ohne gespeichert.
- **Modale Ebenen und Esc/Klick:** Detailansicht (`z-50`) → Bilder-Ansicht
  (`z-70`) → Vorlagen-Auswahl (`z-75`) → Vollbild (`z-80`). Die inneren Ebenen werden **im DOM der
  äußeren** gerendert, deren Backdrop bei jedem Klick schließt – jede innere
  Ebene braucht daher `stopPropagation` auf ihrem eigenen Backdrop und
  Schließen-Knopf, sonst reißt ein Klick alles mit. Für Esc reicht das nicht:
  Ein Handler, der vom Offen-Zustand der Ebene darüber abhängt und deshalb neu
  registriert wird, hängt sich **während derselben Ereignisausbreitung** wieder
  ein und bekommt denselben Tastendruck ab (beide Ebenen schließen auf einmal).
  Deshalb hängt der Esc-Handler der Bilder-Ansicht **einmalig, in der
  Capture-Phase** und fragt den Zustand über Refs ab. Er entscheidet dort
  gleich für **alle** Ebenen, welche sich schließt; die Vorlagen-Auswahl hat
  aus genau diesem Grund **keinen eigenen** Esc-Handler. Neue Zwischenebenen
  also dort einhängen, nicht mit einem weiteren Listener.
- Bilder liegen als Base64-Data-URLs direkt in SQLite. Für ein späteres
  Vercel-Deployment auf Postgres + Blob-Storage umstellen (Migrationsweg steht
  in der `README.md`).
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
