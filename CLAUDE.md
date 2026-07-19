# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Was ist das

Web-App zur KI-gestützten Erstellung menschlicher Charaktere (für Buch/Spiel):
Vorgaben im Formular → OpenAI erzeugt Fließtext + strukturierte Merkmale
(Tabelle) → Portrait via `gpt-image-1` → speichern in SQLite, verwalten in
einer Galerie mit Szenarien.

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

Seiten: `/` (Erstellen; Client-Komponente mit Umschaltung Formular-/
Ergebnis-Ansicht), `/gallery`, `/scenarios` (+ `/scenarios/[id]`) und
`/settings`.

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
  `POST /api/generate-name`, `POST /api/regenerate-text`,
  `POST /api/scenario-description`, `POST /api/scenario-plot`,
  `POST /api/story-hooks` – OpenAI (persistieren nichts).
- `GET|POST /api/characters` – Liste / Anlegen (POST akzeptiert optional
  `scenarioId`, `imageData` und `thumbnail`; ein mitgegebenes Bild wird das erste
  und primäre). **Keine Route liefert `imageData` in einer Liste** (`omit`),
  sonst wären es mehrere MB pro Aufruf; für die Anzeige genügt das Thumbnail
  des Primärbilds.
- `GET|PATCH|DELETE /api/characters/[id]` – **PATCH ist ein Teil-Update**
  (`.partial()`): jedes von `name`, `scenarioId`, `shortDescription`,
  `description`, `traits`, `storyHooks` kann einzeln geändert werden. Alle nachträglichen
  Text-Bearbeitungen in der Galerie laufen darüber. **Bilder nicht** – die
  haben eigene Routen.
- `POST /api/characters/[id]/images` – Bild hinzufügen (wird standardmäßig zum
  Primärbild).
- `GET|PATCH|DELETE /api/characters/[id]/images/[imageId]` – **GET ist der
  einzige Weg an ein Original** (Vollbild, Bild-Export, PDF holen es hier);
  PATCH `{ isPrimary: true }` wählt das Primärbild; DELETE löscht das Bild.
  Alle drei schreibenden Routen geben den vollständigen, aktualisierten
  Charakter zurück, damit der Client seinen Zustand einfach ersetzen kann.
- `GET|POST /api/scenarios` – Liste / Anlegen (`details` optional, s. u.).
- `GET|PATCH|DELETE /api/scenarios/[id]` – **GET liefert das Szenario samt
  seiner Charaktere** (ohne Bild-Originale, nur Thumbnails – wie die
  Charakter-Liste); PATCH ist ein Teil-Update von `name` und `details`.
- `GET|PATCH /api/settings` – App-Einstellungen (`imageModel`, `imageQuality`).
- `GET|POST /api/backup` – Datenbank sichern / wiederherstellen. **POST
  ersetzt den gesamten Bestand** (Bestätigung passiert in der UI).
- `POST /api/characters/import` – **einzelnen** Charakter aus einer
  Exportdatei einspielen, **additiv**. Nicht zu verwechseln mit `/api/backup`:
  das ersetzt alles, das hier legt hinzu.

**Einzelne Charaktere exportieren/importieren:** Format und Zod-Schema stehen
in `lib/characterFile.ts` (`kind` + `version` im Kopf, damit nicht irgendein
JSON eingelesen wird). Der **Export braucht keine Route** – Texte und Merkmale
liegen im Client, nur die Bild-Originale holt `buildCharacterFile` einzeln über
`getImage` nach (Thumbnail geht mit, weil der Server keines erzeugen kann:
Canvas gibt es nur im Browser). Der **Import** ist eine eigene Route, weil
Charakter und alle Bilder in **einer Transaktion** entstehen müssen; der Weg
über `POST /api/characters` plus je Bild `POST …/images` ließe bei einem Fehler
im dritten Bild einen halben Charakter stehen. Die Datei trägt bewusst **keine**
`id`, `scenarioId` und `createdAt` – Begründung je Feld steht in
`characterFile.ts`. Die Ansatzpunkte (`storyHooks`) kamen später dazu und
**ohne** Versionssprung: als optionales Feld mit `default("")` bleiben alte
Dateien lesbar, und alte Stände dieser Anwendung überlesen das Feld in neuen
Dateien. Eine erhöhte Version hätte hier nichts geschützt, sondern nur ältere
Dateien abgelehnt. Die Merkmale werden beim Import **lose** validiert und durch
`normalizeTraits` geschickt: eine Exportdatei ist ein Altbestand außerhalb der
DB und kennt ein später ergänztes Merkmal nicht.

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

**Text neu erzeugen & Ansatzpunkte:** Zwei Knöpfe in der Detailansicht der
Galerie, beide **nur dort** – sie setzen einen fertigen Charakter voraus.

„Text neu erzeugen" (`POST /api/regenerate-text`) schreibt den
Beschreibungstext neu, aus den gespeicherten Vorgaben plus einem freien
Zusatzwunsch aus dem Feld daneben (Stil, Perspektive, Schwerpunkt). Der
Unterschied zu `/api/generate-text` ist der Zuschnitt: dort entsteht ein
**ganzer** Charakter, hier nur der Text. Name und Merkmale sind **Vorgabe, nicht
Ergebnis** – sie gehen in den Prompt ein und bleiben unangetastet, denn ein Text,
der der Merkmalstabelle widerspricht, wäre schlechter als der alte. Grundlage
sind dabei die **bearbeiteten** Merkmale (`edited`), nicht die gespeicherten:
wer gerade den Beruf geändert hat und dann neu schreiben lässt, meint den neuen.

„Ableiten" (`POST /api/story-hooks`) erzeugt drei Ansatzpunkte für eine
Geschichte aus Beschreibung **und** Merkmalen – beide steuern bei, was der
andere nicht hat (Text die Vorgeschichte, Tabelle die Eckdaten). Die
Formular-Vorgaben gehen bewusst **nicht** mit: was aus ihnen wurde, steht längst
im Text.

Davor steht die Wahl **„Bindung"** (`STORY_HOOK_ANCHORS` in `schema.ts`:
`eng` | `mittel` | `frei`, Default `eng`). Ohne sie driftet das Modell
verlässlich ins Allgemeine – ein Zufallsfund, ein anonymer Hinweis, ein Netz von
Intrigen; Aufhänger, die an jede Figur passen und deshalb an keiner etwas
erzählen. Die Stufe steuert genau eine Frage: **darf Neues erfunden werden, und
wie viel?** Sie ist deshalb als **Verbot mit Nachweispflicht** formuliert
(„erfinde keine neuen Personen", „setze die Belegstelle in Klammern dahinter")
und nicht als Bitte um mehr Nähe – „bleib nah am Charakter" ist eine
Geschmacksangabe, die das Modell mit ein paar Namensnennungen erfüllt zu haben
glaubt. Bei `eng` senkt die Route zusätzlich die Temperatur auf 0.7: dort ist
der Vorrat an zulässigem Material klein, und hohe Temperatur führt dann zu genau
dem Ausweichen ins Erfundene, das die Stufe verhindern soll.

Die Stufe wird **nicht gespeichert**. Sie beschreibt nichts am Charakter,
sondern wie man ihn gerade befragen will – anders als die Ansatzpunkte selbst,
die am Charakter hängen.

Beide Routen liefern **Freitext**, kein Structured Output: eine Beschreibung ist
ein String und drei Ansatzpunkte landen in einem Textfeld, das von Hand
weitergeschrieben wird – ein JSON-Schema drumherum wäre reiner Token-Aufschlag
(dieselbe Überlegung wie bei `generate-name`). Und beide **persistieren nichts**:
das Ergebnis geht in den Bearbeitungs-Zustand der Detailansicht und wird erst
über „Änderungen speichern" abgelegt. Das ist hier keine Nachlässigkeit, sondern
der Punkt – ein neu erzeugter Text ist nicht zwangsläufig besser als der alte,
und „Verwerfen" muss den alten zurückbringen. Aus demselben Grund fragt
„Neu ableiten" nach, sobald im Feld schon etwas steht.

Die Ansatzpunkte liegen in der eigenen Spalte `storyHooks` und **nicht** in
`GeneratedCharacter`: dieser Typ beschreibt, was das Modell bei der
Erstgenerierung liefert, und dazu zählen sie nicht (sie entstehen später, auf
Knopfdruck). Deshalb führt die Detailansicht sie in einem eigenen State neben
`edited` und teilt mit ihm nur den Speichern-Knopf; `updateCharacterContent`
nimmt sie als **optionalen** dritten Parameter, und bleibt er weg, rührt der
Teil-PATCH das Feld nicht an.

**Szenarien:** Ein Szenario fasst Charaktere für eine Geschichte zusammen und
hält fest, was für sie alle gilt. Eigener Bereich unter `/scenarios`
(Übersicht mit Anlege-Formular) und `/scenarios/[id]` (Detailansicht:
Festlegungen bearbeiten, zugeordnete Charaktere als Kacheln, Löschen).

**Die Festlegungen liegen als JSON-String in `Scenario.details`**, nicht als
einzelne Spalten – dasselbe Muster wie `Character.traits` und
`Character.input`, und aus demselben Grund: hier kommen weitere Felder dazu,
und jedes einzelne wäre sonst eine Migration. Ein neues Feld kostet **zwei
Zeilen** in `schema.ts` (`scenarioDetailsSchema` + `SCENARIO_LABELS`, dazu
optional ein Hinweis in `SCENARIO_HINTS` und ein Eintrag in
`SCENARIO_MULTILINE`); Formular, Detailansicht und die Zusammenfassungszeile
der Übersicht ziehen automatisch mit, weil alle drei über `SCENARIO_LABELS`
laufen statt über die Schlüssel des Objekts. `normalizeScenarioDetails` füllt
fehlende Felder beim Lesen auf – Altbestände kennen ein neues Feld nicht.

Der **Name** bleibt dagegen eine echte Spalte: nach ihm wird sortiert, und er
ist die Identität des Szenarios, nicht eine seiner Eigenschaften.

*Praxistest:* Das Feld `beschreibung` kam nach dem Bereich dazu und kostete
genau das – vier Zeilen in `schema.ts`, keine Migration, keine Änderung an
Formular oder Detailansicht. Extra-Arbeit entstand nur durch die Eigenheiten
**dieses** Feldes: der Erzeugen-Knopf und der Ausschluss aus der
Zusammenfassungszeile der Übersicht (ein 1200-Zeichen-Text füllte sie allein).

An **Ort, Zeit und Regeln** hängt je ein **Würfel** (`scenarioPlaces.ts`,
`scenarioTimes.ts`, `scenarioRules.ts` – je sechs Listen zu 100, eine pro
Genre, zusammen 1800 Einträge). Rein lokal wie alle Würfel im Projekt. Welche
Liste gezogen wird, entscheidet das **Genre-Feld daneben**; ohne Auswahl fällt
es auf „Gegenwart" zurück, und über die Listen wird **nie** gemischt – dieselbe
Regel wie in `backgrounds.ts`. Die Zuordnung Feld → Funktion steht in der Karte
`WUERFEL` in `ScenarioFields.tsx`; ein Feld ohne Eintrag dort bekommt keinen
Knopf. Der Würfel sitzt **in der Komponente**, nicht in den Seiten: nur sie
kennt das gerade gewählte Genre.

Der Unterschied zwischen den drei: **Ort und Zeit ziehen genau einen Eintrag**
(ein Szenario spielt an einem Ort, zu einer Zeit), **Regeln ziehen zwei bis
drei** über `pickSome` – eine Welt entsteht erst aus dem Zusammentreffen
mehrerer Festlegungen. Regeln sind deshalb **vollständige Sätze mit Punkt** und
werden mit **Leerzeichen** verbunden, nicht mit Semikolon wie Aussehen und
Hintergrund (das sind Satzteile). Sie enthalten bewusst keine Zahlen,
Eigennamen oder Aussagen über die Regierungsform – zwei gezogene Regeln müssen
nebeneinander stehen können, ohne sich zu widersprechen, und über Ort und Zeit
sagen sie nichts, dafür gibt es die anderen Felder.

Die **Beschreibung** lässt sich per KI erzeugen (`POST
/api/scenario-description`), aus Genre, Ort, Zeit und Regeln. Sie steht deshalb
**hinter** ihnen: sie ist deren Fließtext-Fassung, nicht eine weitere Quelle,
und darf ihnen nie widersprechen. Der Prompt bekommt bewusst **nicht** die
Charaktere des Szenarios – sonst beschriebe der Text den heutigen Bestand statt
die Welt und änderte sich mit jeder neuen Figur. Wie überall persistiert die
Route nichts: das Ergebnis geht ins Formularfeld, und ein zweiter Klick fragt
nach, bevor er eine von Hand geschriebene Beschreibung ersetzt.

**Zwei Wege zum Anlegen**, beide gewollt: das Feld in der Galerie schickt nur
einen Namen (man ordnet gerade einen Charakter zu und will nicht in ein
Formular gedrängt werden), das Formular unter `/scenarios` schickt alles.
Deshalb ist `details` beim POST optional. Alle Felder dürfen leer bleiben – ein
Szenario entsteht oft, bevor feststeht, wo es spielt, und ein Pflichtfeld führte
nur zu Platzhaltern.

Das **Genre** kommt aus `GENRE_TEMPLATES` (`templates.ts`), derselben Liste wie
die Vorlagen im Erstellen-Formular. Gespeichert wird die Id, angezeigt das
Label. Beide Seiten müssen dieselben Genres kennen, sonst stünde im Szenario
„Steampunk" und im Charakter-Formular etwas, das nicht dazu passt.

Der **Handlungsentwurf** (`POST /api/scenario-plot`) ist das Gegenstück zur
Beschreibung und die **einzige Stelle im Projekt, an der mehrere Figuren
zugleich betrachtet werden**. Bis dahin stand jeder Charakter für sich: eigene
Beschreibung, eigene Ansatzpunkte, die einander nie begegneten. Hier treffen
sie aufeinander – die `storyHooks` der zugeordneten Charaktere sind das
eigentliche Material des Prompts.

Je Figur gehen **Kurzbeschreibung, der lange Beschreibungstext, die
vollständige Merkmalstabelle und die Ansatzpunkte** mit – letztere, sofern
erzeugt. Anfangs waren es nur Kurzbeschreibung und drei Merkmale; das war zu
wenig, denn die Vorgeschichte steht im langen Text, und aus Vorgeschichte
entsteht Konflikt. Text und Merkmale gehen **immer** mit, auch wenn Ansatzpunkte
vorhanden sind: die sind eine Destillation und ersetzen die Quelle nicht. Kostet
bei sechs Figuren rund 2000 zusätzliche Token, also Bruchteile eines Cents.

Die Merkmale laufen dabei über `TRAIT_LABELS` statt als Aufzählung von Hand –
anders als in `buildImagePrompt`, und das ist richtig so: ins Bild darf nur, was
Aussehen ist, in einen Handlungsentwurf gehört **jedes** Merkmal, ein später
ergänztes eingeschlossen. Leere Werte bleiben draußen.

Drei Zuschnitte, die zusammengehören:
- Die **Charaktere lädt die Route selbst** über die `scenarioId`, statt sie im
  Request entgegenzunehmen. Sonst hätte sie eine zweite Wahrheit über den
  Bestand, und der Client müsste alle Figuren mitschicken.
- Die **Festlegungen kommen dagegen aus dem Request**: in der Detailansicht
  können sie ungespeichert geändert sein, und wer gerade die Regeln
  umgeschrieben hat, meint die neuen.
- **Ohne zugeordnete Charaktere antwortet die Route mit 400** und einem
  Hinweis, was zu tun ist. Ein Handlungsentwurf über niemanden wäre teurer
  Unsinn. Aus demselben Grund ist der Knopf im **Anlege-Formular gar nicht
  vorhanden** – dort gibt es weder Id noch Besetzung.

Welche Felder einen KI-Knopf bekommen, bestimmt die **aufrufende Seite** über
`generatable` (ein `Set` von Feldnamen), nicht `ScenarioFields`. Die Komponente
bleibt darstellend: sie kennt kein `fetch` und ruft nur `onGenerate(key)`.
Während ein Feld erzeugt wird, sind **alle** Knöpfe gesperrt – die Erzeugung
liest die übrigen Felder mit, und zwei gleichzeitige Läufe säßen auf
verschiedenen Ständen.

**Noch offen:** Die Festlegungen fließen bisher nur in die Szenario-eigenen
Texte ein (Beschreibung, Handlungsentwurf), **nicht** in die
Charakter-Generierung. Ein Charakter, der einem Szenario zugeordnet ist, weiß
nichts von dessen Ort, Zeit und Regeln.

**Vorgaben-Ansicht:** Die Formular-Eingaben, aus denen ein Charakter entstanden
ist, liegen seit jeher in der Spalte `input` (JSON-String) und sind über
`StoredCharacter.input` bereits im Client. Der Fußzeilen-Knopf „Vorgaben
anzeigen" öffnet sie als eigene Ebene (`CharacterInputModal`). Bewusst **reine
Anzeige, nicht editierbar**: die Werte protokollieren den Erstellungszeitpunkt.
Wären sie änderbar, stünde in der DB eine Vorgabe, aus der der gespeicherte
Text nie entstanden ist. Gerendert wird über `INPUT_LABELS`, nicht über die
Schlüssel des Objekts – Altbestände haben nicht alle Felder, und die fehlen so
sichtbar („— nichts angegeben —") statt lautlos.

**Editierbare Felder:** Name, Kurzbeschreibung, Beschreibung und alle Merkmale
sind in beiden Ansichten editierbar. Am Namensfeld hängen in **beiden**
Ansichten zwei Knöpfe: 🎲 würfelt lokal, ✨ fragt die KI. Im Formular speisen
sie sich aus den Vorgaben, in der Galerie aus der **Merkmalstabelle** (dort ist
der Name schon vergeben, geändert wird nachträglich). In der Erstellen-Ansicht wandern die
Änderungen in den Charakter-State und werden beim Speichern übernommen; in der
Galerie werden sie über PATCH persistiert. Merkmals-Änderungen laufen über den
`withTrait`-Helfer in `schema.ts` (konvertiert `alter` in eine Zahl).

**Zentrale Module in `lib/`:**
- `schema.ts` – Zod-Schemas & Typen (`CharacterInput` mit `INPUT_LABELS`,
  `CharacterTraits` mit `TRAIT_LABELS`, `GeneratedCharacter`, `IMAGE_STYLES`).
  **Single source of truth**, von Client und Server geteilt.
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
  Der `merkmaleBlock` zählt die Merkmale **einzeln** auf statt über
  `TRAIT_LABELS` zu laufen. Deshalb landet ein neues Merkmal nicht automatisch
  im Bild-Prompt – `interessen` steht bewusst nicht drin (Hobbys sind kein
  Aussehen). Soll ein neues Merkmal ins Bild wirken, muss es hier ergänzt
  werden.
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
  `StoredScenario`). `primaryImage(c)` leitet das anzuzeigende Bild ab – bewusst
  abgeleitet statt als eigenes Feld mitgeschickt, sonst läge das Thumbnail des
  Primärbilds doppelt in jeder Antwort (Listen-Antwort: 465 KB statt 914 KB).
- `client.ts` – **einziger** Weg, wie Client-Komponenten die API ansprechen
  (typisierte fetch-Helfer für Generierung, CRUD, Umbenennen, Bild/Inhalt
  aktualisieren, Szenarien).
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
- `inspiration.ts` – Bausteine für die Würfel an „Aussehen" und
  „Persönlichkeit"; `pickSome` zieht mehrere **ohne Wiederholung** (auch von
  `backgrounds.ts` genutzt, deshalb exportiert). Nach **Genre** ist hier
  bewusst nichts getrennt: die Einträge sind so formuliert, dass sie überall
  passen (Körper und Auftreten statt konkreter Kleidungsstücke). Das Aussehen
  verbindet mit **Semikolon**, weil seine Einträge selbst Kommas enthalten
  („silbergraues Haar, mit Stolz getragen").
  **Das Aussehen hat drei Listen zu je rund 100 Einträgen** (die Länge ist
  nirgends fixiert, die Listen dürfen wachsen): `FEMALE_APPEARANCE`,
  `MALE_APPEARANCE` und `NEUTRAL_APPEARANCE`. `randomAppearance(gender)` zieht
  2–3 geschlechtsspezifische plus 1–2 neutrale Merkmale. Das Geschlecht ist
  **Freitext** und wird wie in `names.ts` per `startsWith` geprüft, damit auch
  ein gespeichertes Merkmal hineinpasst. Bei „egal"/„divers" entscheidet eine
  **Münze für eine der beiden Listen**, statt aus beiden zu mischen – ein Bart
  neben schweren Ohrringen wäre kein vielfältiger Charakter, sondern ein
  widersprüchlicher. In `NEUTRAL_APPEARANCE` gehört deshalb nur, was an jedem
  Charakter funktioniert (Augen, Haut, Narben, Gewohnheiten, Mitgeführtes) –
  **kein** Haarschnitt und kein Schnitt der Kleidung.
- `backgrounds.ts` – Hintergründe für den Würfel am Feld „Hintergrund":
  **sechs Listen zu je 100**, eine pro Genre-Id aus `templates.ts`
  (`BACKGROUNDS_BY_GENRE`). `randomBackground(genre)` zieht **1–3** Einträge,
  mit Semikolon verbunden. Anders als bei den Berufen wird **nicht** markiert,
  sondern getrennt: ein Beruf passt in mehrere Genres, ein Lebenslauf nicht –
  eine Kindheit im Fabrikviertel und eine im fensterlosen Wohnblock meinen
  dieselbe Armut in Worten, die sich nicht austauschen lassen. Ohne bekanntes
  Genre fällt die Wahl auf „Gegenwart"; über die Listen wird **nie gemischt**
  (ein Konzernvertrag neben einem gebrochenen Lehnseid wären zwei Charaktere).
  Die Einträge sind subjektlose Verbalphrasen („floh aus der Heimat"), damit
  sie sich aneinanderreihen lassen und kein Geschlecht festlegen.
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
`traits` als **JSON-Strings**, optionale `scenarioId`, optionale `storyHooks`),
`CharacterImage`
(`imageData` als Base64-Data-URL, `thumbnail` als verkleinerte Fassung davon,
`isPrimary`; `onDelete: Cascade` – Bilder gehen mit dem Charakter),
`Scenario` (`details` als JSON-String, `onDelete: SetNull` – beim Löschen des Szenarios bleiben
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
  Die **Vorgaben-Ansicht** (`CharacterInputModal`, ebenfalls `z-70`) ist die
  Ausnahme und hat einen eigenen, gewöhnlichen Handler: über ihr liegt nichts,
  und sie ist mit der Bilder-Ansicht nie gleichzeitig offen (beide öffnen aus
  der Detailansicht). Damit gibt es nichts, wovon der Handler abhängen könnte –
  die Falle oben entsteht gar nicht erst.
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
