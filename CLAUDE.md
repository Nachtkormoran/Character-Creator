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
(Prisma) speichern. **Nach dem Speichern führt der Weg in die Galerie**
(`router.push("/gallery")`). Dass die Ergebnis-Ansicht dabei verschwindet, ist
kein Komfort, sondern nötig: sie kennt keine Charakter-ID, jeder weitere Klick
auf „Speichern" wäre ein **neues** `POST` und damit ein Duplikat. Der Knopf
allein reicht als Schutz nicht – `setSaved(false)` macht ihn nach jedem neu
erzeugten oder hochgeladenen Bild wieder scharf.

Vorher schloss die Ansicht **zurück zum Formular**, mit grünem Hinweis und Link
zur Galerie. Das war der falsche Ort: Nach dem Speichern will man den Charakter
sehen, nicht den nächsten anfangen. Die Meldung ist mit dem Rücksprung
entfallen – die Galerie sortiert absteigend nach `createdAt`, der neue
Charakter steht also oben und ist seine eigene Bestätigung.

Das gilt **auch für den Weg über ein Szenario** (`/?scenario=<id>`), wo der
alte Hinweis „Zum Szenario" anbot. Die Galerie zeigt die Figur in beiden
Fällen; ein Ziel, das je nach Herkunft wechselt, wäre schwerer vorherzusagen
als eines, das immer dasselbe ist.

**API-Routen:**
- `POST /api/generate-text`, `POST /api/generate-image`,
  `POST /api/generate-name`, `POST /api/regenerate-text`,
  `POST /api/scenario-description`, `POST /api/scenario-plot`,
  `POST /api/scenario-image`, `POST /api/story-hooks` – OpenAI (persistieren
  nichts).
- `GET|POST /api/characters` – Liste / Anlegen (POST akzeptiert optional
  `scenarioId`, `imageData` und `thumbnail`; ein mitgegebenes Bild wird das erste
  und primäre). **Keine Route liefert `imageData` in einer Liste** (`omit`),
  sonst wären es mehrere MB pro Aufruf; für die Anzeige genügt das Thumbnail
  des Primärbilds.
- `GET|PATCH|DELETE /api/characters/[id]` – **PATCH ist ein Teil-Update**
  (`.partial()`): jedes von `name`, `scenarioId`, `shortDescription`,
  `description`, `traits`, `storyHooks` und `genre` kann einzeln geändert
  werden. Alle nachträglichen Text-Bearbeitungen in der Galerie laufen darüber.
  `genre` ist dabei der einzige Schlüssel, der in der Spalte `input` landet und
  nicht in einer eigenen – s. u. **Bilder nicht** – die haben eigene Routen.
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
  **Das Szenario-Bild nicht** – es hat eine eigene Route (s. u.).
- `GET|PUT|DELETE /api/scenarios/[id]/image` – das **eine** Weltbild eines
  Szenarios. GET ist der einzige Weg ans Original (Vollbild, Export), PUT
  setzt/ersetzt es (`imageData` + `thumbnail`), DELETE entfernt es; PUT/DELETE
  geben das aktualisierte Szenario zurück (ohne `imageData`). Bewusst getrennt
  vom `PATCH` oben, weil ein Bild ~2 MB ist und nicht bei jedem Namensspeichern
  mitreisen soll.
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

**Szenarien exportieren:** `lib/scenarioFile.ts` (`kind` +
`version` wie beim Charakter), Knopf in der Szenario-Detailansicht, daneben
eine Checkbox **„Charaktere mitexportieren (n)"**. Damit gibt es drei
Dateiformate, und die Abgrenzung ist der Zuschnitt: `backup.ts` sichert
**alles** und ersetzt beim Einspielen, `characterFile.ts` ist **eine** Figur,
und dieses hier liegt dazwischen – eine Welt und, wenn gewünscht, ihre
Besetzung. Genau das, was man weitergibt, wenn jemand anders in derselben Welt
weiterspielen soll.

Die Charaktere stecken als `characterPayloadSchema` darin – **dieselbe Form wie
in einer Einzeldatei, nur ohne deren Kopf**. Dafür wurde die Nutzlast aus
`characterFileSchema` herausgezogen; `kind` und `version` gehören zur *Datei*
und nicht zu jedem Eintrag darin, sonst könnte eine Datei in sich
widersprüchliche Versionen tragen. Die Form ist damit weiter an genau einer
Stelle beschrieben: Wer dort ein Feld ergänzt, ergänzt es in beiden Formaten
zugleich. Geprüft, dass alte Charakterdateien danach unverändert lesen.

Die Festlegungen werden – anders als die Merkmale – **streng** über
`scenarioDetailsSchema` validiert. Das ist kein Widerspruch zur losen Prüfung
dort, sondern folgt aus dem Schema: Alle Szenario-Felder sind
`.optional().default("")`, ein später ergänztes fehlt in alten Dateien also
folgenlos. Genau die Eigenschaft, die den Merkmalen fehlt.

Ist die Checkbox abgewählt, steht `characters: []` in der Datei – kein
Sonderfall, sondern eine vollständige Datei über eine Welt ohne Besetzung. Die
Checkbox steht **an** (die Besetzung wegzulassen ist der seltenere Fall) und
wird ausgegraut, wenn dem Szenario niemand zugeordnet ist; ein Häkchen, das
nichts bewirken kann, wäre ein falsches Versprechen. Exportiert wird der
**bearbeitete** Stand, nicht der gespeicherte – dieselbe Regel wie bei
„Text neu erzeugen" und der Ableitung.

Wie beim Charakter braucht der Export **keine Route**: Alles liegt im Client,
nur die Bild-Originale holt `buildScenarioFile` je Figur einzeln nach – und
zwar **nacheinander**, nicht über `Promise.all`: Mehrere Figuren mit mehreren
Bildern legten sonst Dutzende Megabyte gleichzeitig in den Speicher. Deshalb
nennt die Checkbox die Zahl der Figuren: Sie ist der Unterschied zwischen einer
kleinen und einer sehr großen Datei.

**Der Import** (`POST /api/scenarios/import`, Knopf „Szenario importieren" auf
`/scenarios`) ist die Gegenrichtung und wie der Charakter-Import **additiv**:
Die Datei trägt keine Id, ein zweiter Import derselben Datei ergibt bewusst ein
zweites Szenario.

**Alles in einer Transaktion** – beim Charakter war das schon nötig (ein Fehler
im dritten Bild hinterließe einen halben Charakter), hier gilt es doppelt: Ein
Szenario ohne seine Figuren wäre nicht bloß unvollständig, sondern falsch. Wer
eine Welt **mit** Besetzung einspielt, bekäme sonst eine Welt zurück, deren
Zusammensetzung niemand so gewählt hat.

Die Figuren werden dem **neuen** Szenario zugeordnet, nie einem gleichnamigen
bestehenden. Ein Import legt an, er verschmilzt nicht: Zwei Welten mit
demselben Namen können verschiedene Welten sein, und eine Zuordnung nach
Namensgleichheit zöge Figuren in ein Szenario, das niemand ausgewählt hat.

Je Figur gilt dasselbe wie beim Einzel-Import: Merkmale über `normalizeTraits`
auffüllen (die Datei kann ein später ergänztes Merkmal nicht kennen) und **genau
ein** `isPrimary` erzwingen – die Regel aus `characterImages.ts`, die die
Datenbank nicht hält; ohne Markierung in der Datei gewinnt das erste Bild.

Der Knopf nimmt bewusst **keine** Mehrfachauswahl, anders als der
Charakter-Import: Eine Szenario-Datei bringt eine ganze Welt samt Besetzung
mit, und bei Dateien von vielen Megabyte ist der Reihe nach verständlicher. Die
Erfolgsmeldung nennt die Zahl der mitgekommenen Figuren – sie beantwortet die
Frage, die man bei einer fremden Datei hat: War die Besetzung dabei?

*Gegen den Dev-Server geprüft* (Testdaten danach entfernt): zwei Figuren hängen
am neuen Szenario, das Bild mit `isPrimary` bleibt das primäre, Merkmale werden
auf 15 Felder aufgefüllt, `storyHooks` bleibt erhalten, ein leeres `input`
bekommt `genre: "gegenwart"`. Abgewiesen werden eine Charakterdatei
(falsches `kind`), eine zu neue Formatversion und ein leerer Name.

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

**Ein Bild pro Szenario (Weltbild):** Das bewusste Gegenteil zum Charakter. Ein
Szenario hat **genau ein** Bild, direkt als Spalten `imageData` + `thumbnail`
am `Scenario` (kein eigenes `ScenarioImage`, keine `isPrimary`-Logik). Ein
Szenario ist eine **Stimmung, kein Steckbrief**; ein repräsentatives Bild
genügt, und die Mehrbild-Maschinerie wäre hier Aufwand ohne Gewinn – so, wie
der Charakter es vor der Mehrbild-Umstellung hielt. Wie dort liefert **keine
Listen-Route `imageData`** (`omit`), nur das Thumbnail; das Original holt
`GET …/image` einzeln (Vollbild).

Das Bild zeigt die **Welt, keine Figuren** – ein Establishing-Shot des Ortes.
Nicht nur, weil das die Wahl war, sondern weil ein Szenario für viele Figuren
zugleich gilt und keine einzelne es bebildern sollte. `buildScenarioImagePrompt`
baut den Prompt aus `ScenarioDetails` (Ort trägt das Motiv, Zeit + Genre die
Epoche über `BILDWELTEN`, Beschreibung die Stimmung; **Regeln gehen nicht ein** –
Technikstand ist selten ein Bildmotiv). Das „**keine Personen**" steht betont und
doppelt im Prompt: Bild-Modelle setzen sonst reflexhaft einen Menschen als Anker
in die Szene. Stehen mehrere Schauplätze im Ort-Feld, wählt das Modell **einen**
Blick, statt sie zu collagieren. Die **Stilauswahl ist dieselbe wie beim
Charakter** (`IMAGE_STYLES`), die Stiltexte sind aber auf eine Szene statt ein
Portrait gemünzt (die „Skizze" ist hier eine Landschaftsstudie, keine Büste).

Die Route `POST /api/scenario-image` **persistiert nichts** (wie alle
Erzeugen-Routen) und liest die Festlegungen **aus dem Request** – in der
Detailansicht können sie ungespeichert bearbeitet sein. Die UI führt Erzeugtes
und Hochgeladenes zuerst als **Kandidat** (ungespeichert): Erst „Als
Szenario-Bild speichern" ersetzt das vorhandene Bild über
`PUT …/image`. So zerstört ein probeweises „Neu erzeugen" das gute alte Bild
nicht, bis eins gefällt. Das Speichern des Bildes ist **unabhängig** vom
„Änderungen speichern" der Festlegungen (eigene Route, sofort). Daneben ein
Stichwörter-Feld (`extraPrompt`, Perspektive/Lichtstimmung, nicht gespeichert).
Auf den Übersichtskarten unter `/scenarios` erscheint das Thumbnail links.

**Noch nicht dabei** (mögliche Folgeschritte): Das Weltbild ist **nicht** Teil
der Szenario-Exportdatei (`scenarioFile.ts`) und **nicht** im Charakter-PDF.
Beides ließe sich analog nachrüsten.

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

„Ableiten" (`POST /api/story-hooks`) erzeugt **einen** Ansatzpunkt für eine
Geschichte aus Beschreibung **und** Merkmalen – beide steuern bei, was der
andere nicht hat (Text die Vorgeschichte, Tabelle die Eckdaten). Die
Formular-Vorgaben gehen bewusst **nicht** mit: was aus ihnen wurde, steht längst
im Text.

Die Ansatzpunkte sind eine **Liste**, und jeder Klick hängt einen an. Vorher
waren es drei auf einmal in einem Textfeld – ein Block, der nur ganz zu haben
war, während der häufigste Fall ist, dass zwei taugen und einer nicht. Jetzt
löscht ein ✕ an der Karte einen einzelnen, sofort und ohne Rückfrage; die
Rückfrage vor dem Ableiten ist dafür entfallen, weil der Knopf nichts mehr
ersetzen kann. „Sofort" heißt dabei **in der Ansicht**, nicht in der Datenbank:
Wie Text, Merkmale und Genre wird die Liste erst über „Änderungen speichern"
abgelegt, und „Verwerfen" holt die gespeicherte zurück.

**Gespeichert bleibt ein String** (Spalte `storyHooks`), die Einträge durch eine
Leerzeile getrennt; zerlegt und zusammengesetzt wird in `lib/storyHooks.ts`
(`splitHooks` / `joinHooks`). Kein JSON-Array, obwohl das Projekt das sonst tut
(`traits`, `input`, `details`): Die Verbraucher dieses Feldes – die Prompts von
`scenario-plot` und `scenario-from-character` sowie die Exportdatei – wollen
Fließtext. Ein Array müsste an jeder Stelle wieder zu Text werden, und alte
Sicherungen und Exportdateien würden ungültig. **Die Liste ist eine Sache der
Oberfläche.** `joinHooks` ebnet Leerzeilen **innerhalb** eines Eintrags zu
einfachen Umbrüchen ein – ohne das zerfiele ein Eintrag, in den jemand einen
Absatz tippt, beim nächsten Laden in zwei. `splitHooks` streift eine führende
Nummer ab: Bestände von vor der Liste sind nummeriert („1. Titel: …"), und in
einer Liste, aus der einzeln gelöscht wird, wäre die Nummer sofort falsch.

Die **vorhandenen** Ansatzpunkte gehen als Ausschlussliste in den Prompt („keine
Vorlage … setze an einer anderen Stelle an"). Ohne sie liefert der zweite Klick
die erste Idee in anderen Worten. Sie kommen aus dem Client und nicht aus der
Datenbank, weil die Liste ungespeichert bearbeitet sein kann – dieselbe Regel
wie bei `regenerate-text`.

Das Zeichenlimit für `storyHooks` liegt im PATCH und in
`scenario-from-character` bei **20000**, vorher 4000. Das war für drei bemessen;
gemessen liegen zehn Ansatzpunkte bereits bei rund 4700 Zeichen. Ein zu enges
Limit schlägt hier nicht früh zu, sondern spät: erst beim Speichern, wenn die
Arbeit getan ist.

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

Daneben steht ein Freitextfeld **„Richtung"** (`richtung`, max. 500 Zeichen,
optional): Stichworte, worum es gehen soll – „alte Schuld", „Verrat im
Kollegium", „eher leise". Bewusst **kein** weiteres Menü: Was jemand von drei
Ansatzpunkten will, lässt sich nicht in eine Liste sperren.

Die Richtung steht im Prompt **hinter** der Bindung und ist ihr ausdrücklich
untergeordnet („Die Bindung oben schlägt diese Stichworte", dazu die
Anweisung, ein Stichwort notfalls fallenzulassen und seinen **Kern** im
Charakter zu suchen statt es wörtlich zu erfüllen).

**Diese Rangfolge hält nicht, und darauf darf man sich nicht verlassen.**
Gemessen am 19.07.2026 (`gpt-4o`, Grafikdesignerin aus Portland, Stufe `eng`,
Stichwort „Verschwörung in einem Großkonzern, geheime Organisation"): In **2
von 2** Läufen erfand das Modell eine geheime Organisation und lieferte einen
Zufallsfund – beides schließt `eng` ausdrücklich aus. Der zweite Lauf lief
bereits mit der verschärften Formulierung; sie änderte nichts. Ein
ausdrücklicher Nutzerwunsch schlägt eine Rangordnung, die nur im Prompttext
steht.

Ohne Konflikt funktioniert das Feld dagegen sauber: Dieselbe Figur mit `eng`
und „alte Schuld, ein ungeklärtes Verhältnis" ergab drei Ansatzpunkte
ausschließlich aus Vorhandenem (beruflicher Rückschlag, Tattoo, Wortsuche), mit
korrekten Belegstellen.

Der Widerspruch wird deshalb **in der Oberfläche sichtbar gemacht** statt im
Prompt bekämpft: Stehen bei `eng` Stichworte im Feld, erscheint darunter eine
Warnung in Bernstein, dass Erfundenes verlangende Stichworte die Bindung
aufweichen und dafür `mittel` oder `frei` besser passt. Die verschärfte
Prompt-Formulierung bleibt als Stupser stehen – sie schadet nicht, garantiert
aber nichts.

**Beide werden nicht gespeichert** – weder Stufe noch Richtung. Sie beschreiben
nichts am Charakter, sondern wie man ihn gerade befragen will; anders als die
Ansatzpunkte selbst, die am Charakter hängen. In der Oberfläche steht das
Richtungsfeld deshalb **über** dem Ansatzpunkte-Textfeld, direkt unter der
Stufe: Beides zusammen stellt die Frage, die der Knopf beantwortet. Das ist der
Unterschied zum Zusatzwunsch bei „Text neu erzeugen", der **unter** seinem
Textfeld sitzt – der greift einen vorhandenen Text auf, dieser hier füllt ein
leeres Feld.

Beide Routen liefern **Freitext**, kein Structured Output: eine Beschreibung ist
ein String und ein Ansatzpunkt ist ein Absatz, der von Hand weitergeschrieben
wird – ein JSON-Schema drumherum wäre reiner Token-Aufschlag
(dieselbe Überlegung wie bei `generate-name`). Und beide **persistieren nichts**:
das Ergebnis geht in den Bearbeitungs-Zustand der Detailansicht und wird erst
über „Änderungen speichern" abgelegt. Das ist hier keine Nachlässigkeit, sondern
der Punkt – ein neu erzeugter Text ist nicht zwangsläufig besser als der alte,
und „Verwerfen" muss den alten zurückbringen.

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
`scenarioTimes.ts`, `scenarioRules.ts` – je neun Listen zu 100, eine pro
Genre, zusammen 2700 Einträge). Rein lokal wie alle Würfel im Projekt. Welche
Liste gezogen wird, entscheidet das **Genre-Feld daneben**; ohne Auswahl fällt
es auf „Gegenwart" zurück, und über die Listen wird **nie** gemischt – dieselbe
Regel wie in `backgrounds.ts`. Die Zuordnung Feld → Funktion steht in der Karte
`WUERFEL` in `ScenarioFields.tsx`; ein Feld ohne Eintrag dort bekommt keinen
Knopf. Der Würfel sitzt **in der Komponente**, nicht in den Seiten: nur sie
kennt das gerade gewählte Genre.

**Der Würfel überschreibt nichts mehr.** Er sieht nur, ob das Feld leer ist –
lesen kann er nicht, was dasteht:

| Feld | leeres Feld | gefülltes Feld |
|---|---|---|
| Ort | Rahmen + 2 Schauplätze | hängt **einen Schauplatz** an |
| Zeit | Rahmen + Spanne | hängt **eine Spanne** an |
| Regeln | 2–3 Regeln (`pickSome`) | hängt **eine Regel** an |

Dahinter steckt eine Annahme: Was Leute selbst tippen, ist die obere Ebene –
„Berlin", „Sommer 1923". Was ihnen fehlt, ist das Konkrete darunter. Vorher warf
jeder Klick weg, was im Feld stand; das war richtig, solange ein Wurf ein
vollständiger Ort war, und wurde falsch, als das Feld mehrere Ebenen aufnahm.
Das Anhängen erledigt `anhaengen` in `ScenarioFields.tsx` (Zeilenumbruch bei Ort
und Zeit, Leerzeichen bei den Regeln – so, wie die Felder es jeweils halten).

**Die Ortslisten haben dafür zwei Ebenen bekommen** (`*_AREAS` / `*_SPOTS`,
`*_PLACES` bleibt als Zusammenfassung für alles, was die ganze Liste will).
Rahmen ist, worin gespielt wird (Stadt, Landstrich, Station); Schauplätze sind
Orte *darin*, an denen sich fremde Leben kreuzen. Das war **keine neue
Textarbeit**: Die Gliederung stand seit jeher als Rubrik-Kommentar in den Listen
(„Stadt", „Provinz & Land" gegen „Arbeitsplätze", „Einrichtungen"), sie musste
nur aus den Kommentaren in den Code. Sie ist damit auch nur so genau wie diese
Rubriken – ein einzelner Eintrag kann auf der falschen Ebene sitzen.

**Bei der Zeit ging das nicht:** Deren Rubriken sind thematisch (Jahreszeit,
Herrschaft, Krieg), die Dimension „Zeitraum" kam in den Daten **gar nicht** vor –
alle 900 Einträge sind Zeitpunkte. Dafür gibt es jetzt `SPANS`, rund 40 Spannen
und die **einzige nach Genre ungetrennte Liste** im Projekt: Zwei Winter sind in
jeder Welt zwei Winter, das Genre steckt im Rahmen darüber. Die dritte Dimension
des Zeitfeldes – **was sich in der Spanne verschiebt** – fehlt dort absichtlich:
Das ist keine Zufallsentscheidung, sondern der Anfang einer Geschichte. Dafür
ist der KI-Knopf da.

Regeln sind **vollständige Sätze mit Punkt** und
werden mit **Leerzeichen** verbunden, nicht mit Semikolon wie Aussehen und
Hintergrund (das sind Satzteile). Sie enthalten bewusst keine Zahlen,
Eigennamen oder Aussagen über die Regierungsform – zwei gezogene Regeln müssen
nebeneinander stehen können, ohne sich zu widersprechen, und über Ort und Zeit
sagen sie nichts, dafür gibt es die anderen Felder.

**Ort, Zeit und Regeln lassen sich zusätzlich per KI ergänzen** (`POST
/api/scenario-field`) – der Knopf heißt dort „✨ Ergänzen", nicht „Neu
erzeugen", und das ist der ganze Unterschied zum Würfel: Was im Feld steht,
geht als **Vorgabe** in den Prompt und kommt im Ergebnis wieder vor (dieselbe
Regel wie bei `regenerate-text`). Ein Knopf, der „Berlin" durch „Hamburg"
ersetzt, weil das besser zu seinem Einfall passt, wäre unbrauchbar. Deshalb
fragt hier auch nichts nach, bevor er läuft – es kann nichts verlorengehen.

Das Modell kann, was eine Liste prinzipiell nicht kann: Es liest den Feldinhalt
**und die Nachbarfelder**. „Berlin" plus Zeit „Anfang des 19. Jahrhunderts"
ergibt Kutschen und Kohlengeruch, nicht die S-Bahn.

**Die Antwort muss ins Feld passen, und das Feld hat ein Limit.** Beim Ergänzen
enthält die Antwort das Vorhandene **mit** – die ganze Antwort zählt gegen das
Limit, nicht nur das Neue. Ein zu langer Ergänzen-Lauf schlug deshalb erst beim
Speichern zu („Too big"), wenn die Arbeit getan war. Dreifach abgesichert: Der
Prompt nennt das Zeichenbudget (bei Bestand den **Rest**, nicht das volle Limit,
sonst reizt das Modell es punktgenau aus), `max_tokens` in der Route ist aus dem
Limit bemessen (`maxLen/3 + 80`, gedeckelt – Deutsch ~3 Zeichen/Token), und als
letzte Absicherung kürzt die Route eine dennoch zu lange Antwort an einer
Wortgrenze. Das Formular zeigt zusätzlich unter jedem Feld die aktuelle **und**
die maximale Länge (`… / 2000`, bernsteinfarben ab 90 %) und setzt `maxLength`.

**Die Limits stehen an genau einer Stelle** (`SCENARIO_MAXLENGTHS` in
`schema.ts`): `scenarioDetailsSchema` zieht sein `.max(...)` von dort, das
Formular Zähler und `maxLength`, die Route Prompt-Budget und `max_tokens`. Sonst
liefe die Erzeugung irgendwann über ein Limit, das das Formular längst höher
gesetzt hat. Die Konstante trägt bewusst **keine** Typ-Annotation über
`keyof ScenarioDetails` (das wäre ein Zirkelbezug, weil der Typ aus dem Schema
kommt, das die Werte liest); die Vollständigkeit prüft `_maxlengthsCheck`
darunter, sobald `ScenarioDetails` existiert.

**Welche Nachbarfelder ein Feld sehen darf, steht in `SCENARIO_READS`**
(`schema.ts`) – die Festlegungen haben eine Richtung:

```
Genre ──► Ort ──► Beschreibung ──► Handlung
      └──► Zeit ─┘                    ▲
      └──► Regeln ────────────────────┘
```

Erzeugt wird **nur aus dem, was oberhalb steht**. Flösse die Beschreibung in die
Ort-Erzeugung zurück, entstünde ein Kreis: Sie wurde aus dem alten Ort
geschrieben, der neue Ort entstünde aus ihr – und danach passt sie nicht mehr zu
dem Ort, aus dem sie stammt. Beim Handlungsentwurf wäre es schlimmer: Er hängt
an den Figuren, und dann definierten die Ereignisse einer einzelnen Geschichte
rückwirkend die Welt. **Gefiltert wird serverseitig**, obwohl der Client die
kompletten Festlegungen schickt – so kann eine neue Aufrufstelle die Regel nicht
umgehen, und sie steht an genau einer Stelle. *Geprüft:* Erfundene Namen aus
`beschreibung` und `handlung` tauchen im erzeugten Ort nicht auf.

*Eine Lehre aus der Messung:* Die Aufgabe steht im Prompt als **prüfbarer
Endzustand** („Am Ende muss im Feld beides stehen: ein Rahmen und zwei bis drei
Schauplätze") und nicht als Verfahren („prüfe erst, was fehlt, dann ergänze").
Mit der Verfahrensfassung hängte das Modell an „In einem anonymen Wohnblock"
drei weitere Schauplätze an und ließ den Rahmen weg – es klassifizierte gar
nicht erst. Dieselbe Erfahrung wie beim „wäre der Satz noch wahr, wenn die Figur
wegzöge" der Ableitung: Eine am Ergebnis prüfbare Bedingung hält besser als eine
Anweisung, die unterwegs eine Entscheidung verlangt. Ebenso musste die
**Ausgabeform** ausdrücklich werden – „keine Aufzählungszeichen" allein ließ das
Modell nummerieren, Nummern zählt es nicht dazu.

Die **Beschreibung** lässt sich per KI erzeugen (`POST
/api/scenario-description`), aus Genre, Ort, Zeit und Regeln. Sie steht deshalb
**hinter** ihnen: sie ist deren Fließtext-Fassung, nicht eine weitere Quelle,
und darf ihnen nie widersprechen. Der Prompt bekommt bewusst **nicht** die
Charaktere des Szenarios – sonst beschriebe der Text den heutigen Bestand statt
die Welt und änderte sich mit jeder neuen Figur. Wie überall persistiert die
Route nichts: das Ergebnis geht ins Formularfeld, und ein zweiter Klick fragt
nach, bevor er eine von Hand geschriebene Beschreibung ersetzt.

Neben dem Erzeugen-Knopf steht – wie beim Handlungsentwurf – ein Feld für
**Stichwörter**
(`zusatz`, max. 1000 Zeichen, optional): was in der Beschreibung vorkommen soll,
das aus Ort, Zeit und Regeln nicht hervorgeht („ständiger Regen", „Misstrauen
gegen Fremde"). Route und Prompt konnten das von Anfang an, es fehlte nur die
Oberfläche; im Prompt steht es als „Besonders wichtig" **hinter** den
Anforderungen, aber die Festlegungen bleiben übergeordnet („Erfinde nichts, was
ihnen widerspricht"). Anders als der Zusatzwunsch am Handlungsentwurf erscheint
es an **beiden** Stellen: Die Beschreibung ist auch im Anlege-Formular erzeugbar
(`/scenarios`), das den Wert deshalb ebenfalls hält – ungespeichert, wie überall,
und in `resetForm` mit dem übrigen Formular geräumt.

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

Daneben steht ein **Zusatzwunsch** (`zusatz`, max. 1000 Zeichen,
optional): Stichworte und Inhalte, die der nächste Entwurf berücksichtigen soll
– „ein verschollener Brief soll eine Rolle spielen", „ohne Gewalt". Route und
Prompt konnten das von Anfang an, nur die Oberfläche fehlte; im Prompt steht er
als „Besonders wichtig – zusätzliche Wünsche für diesen Entwurf" **hinter**
Welt und Figuren.

Gemessen am 19.07.2026 („Das Herz von York", zwei Figuren, `gpt-4o`): Ohne
Wunsch kommt kein Brief vor, mit Wunsch trägt der Brief die ganze Handlung, und
der Konflikt bleibt gewaltfrei. Anders als bei der „Richtung" der Ansatzpunkte
gibt es hier **keine konkurrierende Bindungsstufe**, die das Feld überstimmen
müsste – der Konflikt, der dort auftrat, entsteht hier gar nicht.

Er steht in der **Kopfzeile des Feldes, direkt neben dem Erzeugen-Knopf** –
nicht unter dem Textfeld, wo er anfangs saß. Dort las man ihn als weitere
Angabe zum Szenario, und der Zusammenhang zum Knopf, an den er sich richtet,
war nicht zu sehen. Die Nähe zum Knopf sagt beides zugleich: dass er die
Erzeugung steuert und nicht den Inhalt. Gehalten wird er in
der **Seite**, nicht in `ScenarioDetails`, und **gespeichert wird er nicht** –
er beschreibt nichts am Szenario, sondern wie man es gerade befragen will
(dieselbe Regel wie bei Bindung und Richtung). Nach dem Erzeugen bleibt er
stehen: Der häufigste Fall ist, dass der Entwurf nicht taugt und man mit
demselben Wunsch plus einer Ergänzung noch einmal drückt.

In `ScenarioFields` ist er wie `generatable` **je Feld** geführt
(`ZUSATZ_PLATZHALTER` + Props `zusatz` / `onZusatzChange`) und erscheint nur,
wo alle drei zusammenkommen – ein Wunsch ohne Erzeugen-Knopf hätte keinen
Empfänger.

Weil in der Kopfzeile jetzt ein **zweites** Eingabefeld steht, umschließt das
`<label>` das Feld nicht mehr, sondern verweist über `htmlFor` auf eine Id
(`szenario-<key>`). Ein Label um beide wäre für Screenreader eine falsche
Zuordnung, und ein Klick auf die Beschriftung landete womöglich im
Stichwort-Feld. Das trägt deshalb sein eigenes `aria-label` und **keine**
sichtbare Beschriftung – die täuschte eine Festlegung des Szenarios vor, die es
nicht ist. Der Platzhalter ist knapp gehalten (die Kopfzeile hat wenig Platz),
das ausführliche „wofür" steht im `title`.

Welche Felder einen KI-Knopf bekommen, bestimmt die **aufrufende Seite** über
`generatable` (ein `Set` von Feldnamen), nicht `ScenarioFields`. Die Komponente
bleibt darstellend: sie kennt kein `fetch` und ruft nur `onGenerate(key)`.
Während ein Feld erzeugt wird, sind **alle** Knöpfe gesperrt – die Erzeugung
liest die übrigen Felder mit, und zwei gleichzeitige Läufe säßen auf
verschiedenen Ständen.

**Szenario aus einem Charakter ableiten:** Die Gegenrichtung, Knopf „✨ Szenario
ableiten" in der Fußzeile der Charakter-Detailansicht →
`ScenarioFromCharacterModal` (`z-70`, gewöhnlicher Esc-Handler wie
`CharacterInputModal`). Beide Richtungen müssen gehen, weil beides vorkommt:
mal steht die Welt zuerst fest, mal fällt einem eine Person ein.

Der Ablauf ist **zweistufig**: `POST /api/scenario-from-character` schlägt vor,
der Vorschlag landet in derselben `ScenarioFields`-Maske, in der das Szenario
später bearbeitet wird, und erst „Szenario anlegen" schreibt (über
`POST /api/scenarios`) und ordnet den Charakter zu. Die Route **persistiert
nichts** – wie alle Erzeugen-Routen.

Der Charakter kommt **aus dem Request**, nicht über eine Id: anders als bei
`scenario-plot` geht es hier um seinen **Inhalt**, und der ist in der
Detailansicht womöglich ungespeichert bearbeitet (dieselbe Regel wie bei
`regenerate-text`). Mitgegeben werden Beschreibung, vollständige Merkmale,
Ansatzpunkte, `input.genre` und `input.setting`; `input.notes` bewusst
**nicht**: stammt die Figur aus einem Szenario, stünde dort dessen kompletter
Weltkontext, und der Vorschlag wäre eine Abschrift statt einer Ableitung.

**Das Genre wird übernommen, nicht erzeugt.** Es steht in den Vorgaben des
Charakters (s. u.), geht als „Genre (steht fest)" in den Prompt und wird der
Modellantwort von der Route wieder angehängt; im `scenarioDraftSchema` kommt es
**nicht** vor. Vorher musste das Modell es aus dem Setting-Freitext erschließen
und lag oft daneben – eine Märchenfigur mit Mühle und Wald landete verlässlich
im Genre „historisch". Die Figur weiß es besser als der Text über sie. Der
Prompt sagt zusätzlich ausdrücklich, dass Ort, Zeit, Regeln und Beschreibung in
diesem Genre spielen müssen, „auch dann, wenn der Charakter für sich genommen
ebenso gut in ein anderes passen würde".

Es ist die **einzige Route mit Structured Output außer `generate-text`**
(`scenarioDraftSchema`): es entstehen fünf Felder, die getrennt in die Maske
müssen – dafür ist das JSON-Schema da, nicht um Tokens zu kosten. `handlung`
liefert der Entwurf **nicht**: der braucht mehrere Figuren, das frische Szenario
hat eine.

**Der Prompt widersprach sich selbst, und das Modell löste es auf die
naheliegende Weise auf.** Er forderte „**jede** Festlegung muss ihren Anhalt im
Charakter haben" und zugleich „keine Aussage über diesen einen Charakter". Genau
eine Sorte Antwort erfüllt beides wörtlich: eine Eigenschaft der Figur nehmen,
den Namen abstreifen und sie als Weltzustand hinschreiben. Aus der
Goldschmiedin wurde „Handwerk ist angesehen, die Zünfte bestimmen den Markt" –
die Regeln der Welt waren eine Umschrift ihres Steckbriefs.

Behoben wurde das durch **Streichen des Widerspruchs, nicht durch ein schärferes
Verbot** – die Erfahrung mit „Bindung vs. Richtung" (s. o.) sagt, dass eine
bloß im Prompttext behauptete Rangordnung nicht hält. Drei Änderungen:
- Die **Richtung der Ableitung ist umgedreht**: nicht „leite die Regeln aus ihm
  ab" (Herkunft), sondern „diese Person ist dein **Zeuge**, nicht dein Thema –
  was muss gelten, damit es einen solchen Menschen geben kann?" (Voraussetzung).
- Statt der Geschmacksangabe „größer als die Figur" steht ein **prüfbares
  Kriterium**: „Wäre der Satz noch wahr, wenn diese Figur morgen wegzöge und nie
  wiederkäme?"
- Die fette Forderung ist von *Herkunft* auf *Verträglichkeit* zurückgenommen:
  Die Welt darf dem Charakter nicht widersprechen, muss aber nicht aus ihm
  bestehen. Das meiste ergibt sich aus Genre, Ort und Zeit.

**Ort und Zeit haben jetzt mehrere Dimensionen.** Vorher verlangte der Prompt
vom Ort nur „konkret genug, dass man es sich vorstellen kann" – eine Latte, die
„Ein Fischerdorf an der Nordküste" bereits reißt, weshalb das Modell dort
aufhörte. Der Ort ist jetzt ein **Gebiet mit mehreren Orten** (Rahmen + zwei bis
drei Schauplätze, jeder mit einem Riss), die Zeit ein **Zeitraum statt eines
Zeitpunkts** (Rahmen + Spanne + was sich in ihr verschiebt). Eine Geschichte
spielt selten an einem Punkt in Raum und Zeit.

**Beide Felder brauchten dafür mehr Platz** (`scenarioDetailsSchema`): `ort` von
300 auf **2000** Zeichen, `zeit` von 200 auf **1000**. Die alten Grenzen waren
für einen Schauplatz und ein Datum bemessen; gemessen liegt ein abgeleiteter Ort
bei 400–800 Zeichen. Dieselbe Lehre wie bei den Ansatzpunkten, und derselbe
Fehler noch einmal gemacht: Ein zu enges Limit schlägt nicht früh zu, sondern
spät – es hielt weder das Formular noch die Erzeugung auf, sondern erst das
Speichern, mit „Too big: expected string to have <=300 characters", als die
Arbeit längst getan war.

Als Folge zieht `scenarioToInput` für das Feld `setting` jetzt den **ersten
Satz** von Ort und Zeit statt des ganzen Feldes (`ersterSatz`). `setting` ist
einzeilig und fasst 200 Zeichen; ein 600-Zeichen-Ort hätte es allein gefüllt und
die Zeit ganz herausgedrängt. Der erste Satz ist bei beiden Feldern der Rahmen –
die Schauplätze und Verschiebungen stehen dahinter und gehören ohnehin eher in
`notes`.

Dazu kam eine strukturelle Ursache: Ort und Beschreibung entstehen im **selben
Aufruf**, „konkret und sinnlich" forderte der Prompt aber nur von der
Beschreibung – die sinnliche Arbeit floss also dorthin, und der Ort blieb deren
Überschrift. Im normalen Weg ist das anders, dort entsteht die Beschreibung
**nach** einem feststehenden Ort. Beide Felder tragen ihre Anforderung nun
zusätzlich im `.describe()` von `scenarioDraftSchema`: Unter Structured Outputs
sieht das Modell diese Beschreibungen. `zeit` ist deshalb auch in
`SCENARIO_MULTILINE` gewandert.

**Würfel-Einträge als Formbeispiel** (`lib/scenarioSamples.ts`, Checkbox in der
Maske, Default **an**): Für Ort und Regeln steht der Hausstandard längst
geschrieben – 900 Orte und 900 Regelsätze, gebaut nach einer Regel, die in den
Kopfkommentaren der Listen steht („Ein Ort ohne Riss ist eine Kulisse"). Der
Prompt kannte ihn nicht und umschrieb ihn mit eigenen Worten. Drei echte
Einträge je Feld zeigen die Tonlage genauer als drei Sätze über die Tonlage.

Gezogen wird aus der Liste des **Genres** (Formbeispiel aus der falschen Welt
wäre ein Stilbruch) und **in der Route**, nicht im Prompt-Baukasten: So bleibt
`buildScenarioFromCharacterPrompt` bei gleichen Eingaben derselbe und lässt sich
vergleichen – und der zweite Anlauf nach kaputten Umlauten schickt denselben
Prompt, nicht andere Beispiele. Der Warnsatz „übernimm nichts davon inhaltlich"
steht **vor und hinter** dem Block: Es ist der einzige Teil des Prompts, der
fertig formuliertes Material derselben Sorte enthält, die auch die Antwort sein
soll – die größte Versuchung zum Abschreiben, die es hier gibt.

**Der Auto-Start ist dafür entfallen, und der Ablauf ist jetzt dreistufig:
einstellen, ableiten, anlegen.** Vorher lief die Ableitung beim Öffnen von
selbst los – mit guter Begründung, solange es nichts zu entscheiden gab: Der
Knopf, der hierher führt, heißt bereits „Szenario ableiten", und eine leere
Maske mit einem weiteren Knopf wäre ein Klick ohne Entscheidung gewesen.

Diese Begründung ist mit der Checkbox hinfällig geworden. Es **gibt** jetzt eine
Entscheidung, und beim Auto-Start kam sie zwangsläufig zu spät: Wer die Maske zu
Gesicht bekam, sah bereits das Ergebnis. Ein Schalter, der erst nach seiner
Wirkung erscheint, ist keiner – er täuscht eine Wahl vor, die man nur durch
einen zweiten, kostenpflichtigen Aufruf einlösen kann. Der zusätzliche Klick
kauft also die Wahl, die vorher nur wie eine aussah.

Der Startzustand zeigt deshalb, was gleich passiert (und dass nichts gespeichert
wird), darunter die Option und einen betonten „✨ Ableiten"-Knopf. Danach heißt
die Haupthandlung „Szenario anlegen" und die Ableitung wird zum Nebenknopf
„✨ Neu ableiten": Es gibt keinen Zustand, in dem beide betont wären – anlegen
ohne Vorschlag geht nicht, und nach dem Vorschlag ist ein weiterer Lauf die
Ausnahme.

Die Checkbox steht in **eigener Zeile über dem Knopf**, nicht daneben. Zuerst
saß sie neben „Neu ableiten", in einer umbrechenden Reihe aus drei Knöpfen und
als kleine graue Schrift – dort war sie schlicht nicht zu finden.

**Und sie erscheint nur im Startzustand.** Neben dem fertigen Entwurf hätte sie
zwar eine echte Funktion (sie wirkt auf „Neu ableiten"), liest sich dort aber
falsch: Wer auf ausgefüllte Felder schaut, bezieht einen Schalter daneben auf
das, was dasteht – während er einen Lauf beschreibt, den es noch nicht gibt.
Möglich wurde das Ausblenden erst durch den Wegfall des Auto-Starts: Seither
kostet der Weg zurück nichts (Dialog schließen, Knopf erneut drücken, kein
Modellaufruf), und der Entwurf, den man dabei verliert, wäre beim Neu-Ableiten
ohnehin ersetzt worden. Was für den laufenden Dialog eingestellt ist, steht im
`title` von „Neu ableiten".

*Zwei Fallen, beide beobachtet und behoben:*
- Das Modell kodiert Umlaute unter Structured Outputs **gelegentlich als
  fehlerhaftes `\u`-Escape** (NUL-Zeichen plus Reste, dabei gehen Buchstaben
  verloren: „Nordküste" → „Nordkfce"). Das ist **nicht reparierbar**, die
  Zeichen sind weg. Die Route prüft deshalb auf Steuerzeichen, versucht es
  **einmal neu** und antwortet sonst mit 502. Trat in ~3 von 8 Läufen auf; bei
  `generate-text` nicht beobachtet, aber derselbe Mechanismus.
- `ableiten` liest seine Eingaben aus einem **Ref**, nicht aus den
  Abhängigkeiten. Hing es an `edited`, wechselte es beim Anlegen die Identität
  (die Detailansicht rendert neu, weil das Szenario in die Liste und an den
  Charakter wandert), der Start-Effekt lief erneut und schickte **nach** dem
  Anlegen eine zweite Ableitung hinterher, die den fertigen Vorschlag aus der
  Maske räumte. **Auch die Beispiel-Checkbox liegt deshalb im Ref**: `ableiten`
  hat leere Abhängigkeiten, eine direkt gelesene State-Variable bliebe für immer
  auf ihrem Startwert – das Häkchen ließe sich umstellen, ohne dass sich etwas
  ändert.

**Charakter für ein Szenario anlegen:** Der Knopf in der Szenario-Detailansicht
führt auf `/?scenario=<id>`. Die Erstellen-Seite lädt das Szenario, belegt das
Formular über `scenarioToInput` (`lib/scenarioInput.ts`) vor **und** wählt es
als Zuordnung aus – wer den Weg über den Knopf nimmt, meint genau dieses.

Die Übernahme läuft bewusst **über die Formularfelder**, nicht als unsichtbarer
Zusatz am Prompt: So sieht man, was den Charakter prägt, kann es ändern, und es
landet in `input`, also in der Vorgaben-Ansicht. Später ist damit
nachvollziehbar, aus welchem **Weltstand** die Figur entstand; ändert sich das
Szenario danach, bleibt die Figur bei dem, was zu ihrer Zeit galt. Deshalb
brauchte **keine Route eine Änderung** – `setting` und `notes` fließen längst in
`buildTextPrompt`.

Die Aufteilung folgt den Feldtypen: `setting` ist ein **einzeiliges** Feld mit
200 Zeichen und bekommt Genre, Ort und Zeit als Gerüst – von Ort und Zeit je nur
den **ersten Satz**, seit die Ableitung dort mehrere liefert (s. o.); `notes` ist ein
**Textfeld** mit 2000 Zeichen und der einzige Platz für Regeln und
Weltbeschreibung. Nicht belegt werden `background`, `personality` und
`appearance` – das sind Eigenschaften der Person, nicht der Welt, und ein
Szenario, das sie vorschreibt, brächte sechs Varianten derselben Figur.

`CharacterForm` liest `initialInput`/`initialGenre` **nur beim ersten Rendern**;
die Seite rendert es deshalb erst, wenn die Vorbelegung da ist. Nachziehen
würde Eingaben überschreiben, die inzwischen entstanden sind. „Zurücksetzen"
führt auf die Vorbelegung zurück, nicht auf ein leeres Formular. Und weil
`useSearchParams` eine Suspense-Grenze verlangt, ist `app/page.tsx` in eine
Hülle gewickelt.

**Personen aus dem Handlungsentwurf:** Der Entwurf entsteht aus den Figuren
eines Szenarios, erfindet dabei aber regelmäßig weitere – den Vorgesetzten, die
Schwester, den Mann am Hafen. Das war eine Sackgasse: Die Person stand im Text,
und wer sie anlegen wollte, tippte alles von Hand ab. Der Knopf „🔍 Personen im
Entwurf suchen" unter den Festlegungen schließt die Lücke.

Der Ablauf ist **dreistufig**: `POST /api/scenario-plot-persons` liefert die
genannten Personen samt dem, was der Entwurf über sie sagt → ein Klick auf einen
Namen öffnet `PlotPersonModal` mit den gefundenen Angaben → „Ja, Charakter
anlegen" führt auf `/?scenario=<id>` mit vorbelegtem Formular. Die Route
**persistiert nichts**; angelegt wird am Ende über den gewöhnlichen Weg.

**Ein KI-Aufruf, kein Mustervergleich** – im Deutschen ist jedes Substantiv
großgeschrieben. „Der Schmied Bengt verwehrte ihr den Auftrag" enthält drei
großgeschriebene Wörter und genau einen Namen; ein Abgleich auf Großschreibung
böte „Schmied" und „Auftrag" als Personen an. Gemessen erkennt die Route in
einem Testentwurf genau die drei Personen und lässt „Ratsversammlung" (Gruppe),
„Bauernmarkt" (Ort) und „Hafenmeister" (Rolle) draußen.

**Auf Knopfdruck, nicht beim Öffnen der Seite.** Ein Aufruf, der beim bloßen
Ansehen eines Szenarios Geld kostet, wäre der erste seiner Art im Projekt.

Es ist die **dritte Route mit Structured Output** (nach `generate-text` und
`scenario-from-character`): Es entsteht eine Liste von Objekten mit je sieben
Feldern, die einzeln in Formularfelder müssen – genau dafür ist das JSON-Schema
da. Die Umlaut-Prüfung wanderte dabei aus `scenario-from-character` nach
`lib/openai.ts` (`hatKaputteZeichen`) und läuft jetzt **rekursiv**: Ein kaputter
Umlaut im dritten Listeneintrag ist so schlimm wie einer auf oberster Ebene.

**Die zugeordneten Figuren lädt die Route selbst** (wie `scenario-plot`) – es
geht um die Zuordnung, und die gibt es nur gespeichert. **Der Entwurf kommt
dagegen aus dem Request** (wie `regenerate-text`): Er kann ungespeichert
bearbeitet sein. Der Ausschluss bekannter Figuren macht das **Modell**, weil ein
Entwurf „Thora" schreibt, wo die Figur „Thora Eisenbach" heißt. Die Route prüft
danach noch einmal grob nach, und zwar über **ganze Namensteile** statt über
Teilzeichenketten: „Mira" und „Mira Lindqvist" sind dieselbe Person, „Alva" und
„Alvarez" nicht – obwohl das eine im anderen steckt.

Der Prompt verlangt ausdrücklich **leere Felder statt Erfindungen**. Was hier
entsteht, sind die *Vorgaben* einer Figur, und die sollen aus dem Entwurf
stammen; ausgedacht wird beim Erzeugen des Charakters, wo es sichtbar ist.
Bestätigt: Zu einer Person, über deren Aussehen der Entwurf schweigt, bleibt
`aussehen` leer.

Die Übergabe ans Formular läuft über **`sessionStorage`** (`personHandoff.ts`),
nicht über die URL: Hintergrund und Persönlichkeit dürfen zusammen mehrere
tausend Zeichen haben, und die hingen sonst an einer Adresse, die im Verlauf und
in Server-Logs landet. Gelesen und **gelöscht wird getrennt** – React ruft
`useState`-Initialisierer und Effekte im Entwicklungsmodus doppelt auf, und eine
Funktion, die beides täte, käme beim zweiten Mal leer zurück.

`plotPersonToInput` belegt genau die Felder, die `scenarioToInput` **nicht**
belegt (Name, Geschlecht, Alter, Beruf, Hintergrund, Persönlichkeit, Aussehen);
die beiden werden übereinandergelegt und überschneiden sich in keinem Feld.
Leere Angaben fehlen ganz, statt als leerer String die Weltvorbelegung zu
überschreiben. Ein Geschlecht, das nicht in `GENDERS` passt, wird „egal" – eine
erfundene Zuordnung stünde später als Vorgabe da, die niemand gemacht hat.

**Noch offen:** Die Festlegungen fließen in **neu erstellte** Charaktere ein,
aber nicht rückwirkend: Wer einen bestehenden Charakter nachträglich einem
Szenario zuordnet, ändert nichts an dessen Text. Auch „Text neu erzeugen" in
der Galerie kennt das Szenario nicht – es arbeitet mit den gespeicherten
Vorgaben, und die enthalten den Weltkontext nur, wenn die Figur über diesen Weg
entstanden ist.

**Vorgaben-Ansicht:** Die Formular-Eingaben, aus denen ein Charakter entstanden
ist, liegen seit jeher in der Spalte `input` (JSON-String) und sind über
`StoredCharacter.input` bereits im Client. Der Fußzeilen-Knopf „Vorgaben
anzeigen" öffnet sie als eigene Ebene (`CharacterInputModal`). Bewusst **reine
Anzeige, nicht editierbar**: die Werte protokollieren den Erstellungszeitpunkt.
Wären sie änderbar, stünde in der DB eine Vorgabe, aus der der gespeicherte
Text nie entstanden ist. Gerendert wird über `INPUT_LABELS`, nicht über die
Schlüssel des Objekts – Altbestände haben nicht alle Felder, und die fehlen so
sichtbar („— nichts angegeben —") statt lautlos.

**Das Genre gehört zu den Vorgaben** (`input.genre`, Default `gegenwart`) und
ist damit die erste, die etwas **steuert** statt nur zu protokollieren: Die
Auswahl im Formular belegt wie bisher das Setting vor und bestimmt die Würfel,
wird aber jetzt auch gespeichert – und beim Ableiten eines Szenarios übernommen.
Vorher verfiel sie beim Speichern, und später war nicht mehr feststellbar, in
welche Welt eine Figur gehört.

Genau deshalb ist es das **einzige** Feld, das `serialize.ts` in den Vorgaben
auffüllt (`normalizeInputGenre`): Ein fehlender Wert wäre mitten im Ablauf ein
`undefined`, während die übrigen Vorgaben reine Anzeige sind und einem
Altbestand ruhig sichtbar fehlen dürfen. Im Schema steht `.catch(DEFAULT_GENRE)`
statt bloßem `.default` – eine Genre-Id, die es nicht mehr gibt, darf nicht die
**gesamten** Vorgaben ungültig machen. Alte Charaktere und alte Exportdateien
gelten damit zunächst als „Gegenwart".

Deshalb ist das Genre die **einzige Vorgabe, die sich nachträglich ändern
lässt** – als Auswahlfeld in der Charakter-Detailansicht, das über „Änderungen
speichern" geht (eigener State neben `edited`, wie die Ansatzpunkte). Das
widerspricht der Regel oben nur scheinbar: Sie schützt davor, dass in der DB
eine Vorgabe steht, aus der der gespeicherte Text nie entstanden ist – und die
Genre-Id geht gar nicht in den Text-Prompt ein, dorthin gehen `setting` und
`notes`. Ohne diesen Weg blieben alle Altbestände dauerhaft „Gegenwart" und
leiteten falsche Szenarien ab.

Im PATCH ist es entsprechend ein **eigener Schlüssel `genre`**, nicht ein
ganzes `input`-Objekt: Die Route liest die gespeicherten Vorgaben, setzt darin
nur das Genre und schreibt zurück. So kann ein Patch die übrigen Vorgaben nicht
anrühren, auch nicht versehentlich.

**Genre und Szenario stehen zusammen** in der Bild-Spalte, unter „Bilder
verwalten": Beides **ordnet die Figur ein**, statt sie zu beschreiben – anders
als Name, Text und Merkmale in der Spalte daneben. Sie speichern aber
**verschieden**: Das Szenario ordnet sofort zu (eigener PATCH über
`updateCharacterScenario`, es kann nichts halb geändert sein), das Genre wartet
auf „Änderungen speichern", weil es zu den Vorgaben gehört und mit Text und
Merkmalen zusammen verworfen werden darf. Deshalb stehen sie **untereinander
mit eigener Beschriftung** und je einem Hinweis, der das sagt – nebeneinander
in einer Zeile wäre der Unterschied unsichtbar und eine Falle.

Der **Namens-Würfel in der Galerie** bekommt das Genre trotzdem **nicht**
mitgegeben: `randomName` stellt die Genre-Id über das Setting, und bei einem
Altbestand ist die Id nur der aufgefüllte Default – ein vor der Umstellung
angelegter Fantasy-Charakter bekäme dadurch plötzlich Gegenwartsnamen. Das
Setting-Feld sagt in beiden Fällen die Wahrheit.

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
  aus Optionen `{ includeTraits, visualDetails, extraPrompt, genre }` +
  Kurzbeschreibung
  (Szenen-Kontext) + Stilbeschreibung zusammengesetzt. **Hier** wird der Bild-Look
  getunt. Neben `stilBeschreibung` gibt es `framingBeschreibung`: Der
  Standard-Bildaufbau verlangt eine Umgebung mit Tiefenschärfe, „Skizze"
  schließt sie ausdrücklich aus (nur dort weicht auch die Kontextzeile ab).
  Bei einem neuen Stil also prüfen, ob der Standard-Bildaufbau passt.

  **Stil und Genre sind zwei verschiedene Fragen:** Der Stil bestimmt, *wie*
  gemalt wird (Illustration, Ölbild, Foto, Skizze), das Genre *was* zu sehen
  ist. Vorher war Letzteres fest auf Gegenwart verdrahtet – „Contemporary,
  present-day clothing", „a fitting modern real-world environment" –, also auf
  genau eines von neun Genres: Eine Fantasy-Figur bekam eine Straßenszene und
  einen Mantel von heute, obwohl im Text eine Burg stand. Die Welt steckt jetzt
  in der Karte `BILDWELTEN` (Genre-Id → `epoche`, `umgebung`, `umgebungIllu`,
  `orte`, `bueste`); die Stilbeschreibungen bleiben dieselben Sätze, nur die
  Welt darin wechselt. Ein neues Genre kostet damit **einen Eintrag** und keine
  neue Stilbeschreibung.

  `umgebungIllu` ist der eine Schönheitsfehler: Er existiert nur, weil der
  Gegenwarts-Prompt in der Illustration „modern **real-world** environment"
  sagt und zeichengenau erhalten bleiben musste – für Fantasy wäre
  „real-world" falsch. Bei allen anderen Genres steht dort dasselbe wie in
  `umgebung`.

  `bueste` ist der Kleidungshinweis für „Skizze", die keine Umgebung zeigt und
  die Welt deshalb allein über die Kleidung transportieren kann. Bei Gegenwart
  ist er **leer**: Der bisherige Skizzen-Prompt sagt zur Epoche nichts, und
  ohne Angabe malen die Modelle ohnehin Gegenwart.

  Eine unbekannte oder fehlende Genre-Id fällt auf Gegenwart zurück – dieselbe
  Regel wie bei den Würfeln, und hier zusätzlich die Garantie, dass
  Altbestände und ältere Clients denselben Prompt bekommen wie zuvor. Die
  Route `generate-image` nimmt `genre` deshalb als `z.string().default(...)`
  ohne Allowlist: Eine Bildgenerierung an einer Genre-Id scheitern zu lassen
  wäre die teurere Reaktion. Das Genre kommt dabei **aus dem Client**, nicht
  aus der Datenbank – im Formular aus `input.genre`, in der Bilder-Ansicht aus
  dem **bearbeiteten** Genre der Detailansicht (eigener Prop, wie bei
  `ScenarioFromCharacterModal`): Wer eben auf Fantasy gestellt hat und dann ein
  Bild erzeugt, meint Fantasy.

  Der Gegenwarts-Prompt ist gegen Regressionen geprüft: 150 Kombinationen aus
  Stil, Optionen und Kurzbeschreibung (explizit `gegenwart`, ohne Genre und mit
  unbekannter Id) sind zeichengenau die von vorher. Wer `BILDWELTEN` ändert,
  sollte das wiederholen.
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
  **neun Listen zu je 100**, eine pro Genre-Id aus `templates.ts`
  (`BACKGROUNDS_BY_GENRE`). `randomBackground(genre)` zieht **1–3** Einträge,
  mit Semikolon verbunden. Anders als bei den Berufen wird **nicht** markiert,
  sondern getrennt: ein Beruf passt in mehrere Genres, ein Lebenslauf nicht –
  eine Kindheit im Fabrikviertel und eine im fensterlosen Wohnblock meinen
  dieselbe Armut in Worten, die sich nicht austauschen lassen. Ohne bekanntes
  Genre fällt die Wahl auf „Gegenwart"; über die Listen wird **nie gemischt**
  (ein Konzernvertrag neben einem gebrochenen Lehnseid wären zwei Charaktere).
  Die Einträge sind subjektlose Verbalphrasen („floh aus der Heimat"), damit
  sie sich aneinanderreihen lassen und kein Geschlecht festlegen.
- `professions.ts` – 360 Berufe für den Würfel am Feld „Beruf / Rolle", jeder
  mit den Genres markiert, in die er passt (`randomProfession(genre)` filtert
  danach). Die Markierung ist der Zweck der Struktur: eine flache Liste würde
  einen „Netrunner" ins Mittelalter würfeln. Ohne Treffer steht die ganze Liste
  zur Auswahl. Berufe stehen in der Grundform, das Textmodell passt sie ans
  Geschlecht an.
  **Die einzige Datei, in der ein neues Genre keine eigene Liste bekommt.**
  Science Fiction, Märchen und Superhelden erben über die Karte `GEERBT` die
  Markierungen von Cyberpunk, Fantasy bzw. Gegenwart und haben daneben je 20
  eigene Einträge. Ein Lebenslauf trägt sein Genre in sich, ein Beruf nicht:
  ein Arzt bleibt ein Arzt, ein Müller im Märchen derselbe wie in der Fantasy.
  Dreihundert Berufe zu kopieren, um an fast identische Einträge eine zweite
  Markierung zu hängen, wäre Pflegeaufwand ohne Gewinn.
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
`Scenario` (`details` als JSON-String, dazu **ein** Weltbild direkt als
`imageData` + `thumbnail` am Szenario – anders als der Charakter, der eine eigene
Bildtabelle hat; `onDelete: SetNull` – beim Löschen des Szenarios bleiben
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
  Schließen-Knopf, sonst reißt ein Klick alles mit.

  **Kein Backdrop hängt direkt an `onClick`** – alle fünf laufen über
  `useBackdropClose` (`app/components/`). Grund war ein Datenverlust: Wer die
  Beschreibung in der Detailansicht markieren wollte und die Maustaste über dem
  Rand losließ, verlor die Ansicht **samt aller ungespeicherten Änderungen**.
  `click` feuert nämlich nicht dort, wo losgelassen wird, sondern auf dem
  **gemeinsamen Vorfahren** von Druck- und Loslass-Punkt – bei einer Markierung
  aus dem Dialog heraus ist das der Backdrop selbst. `stopPropagation` am Dialog
  hilft dagegen **nichts**: Das Ereignis entsteht am Backdrop und steigt gar
  nicht erst durch ihn hindurch auf. Der Hook prüft deshalb zusätzlich den
  **Beginn** der Geste über `mousedown` und schließt nur, wenn beide auf dem
  Backdrop lagen. Das Stoppen der Ausbreitung passiert dabei **unabhängig**
  davon, ob geschlossen wird – sonst käme ausgerechnet die abgefangene
  Markierungs-Geste bei der Ebene darunter an und schlösse dort.

  **Dieselbe Verschachtelung verschiebt die inneren Ebenen aus dem Blick.**
  Jede Ebene ist `fixed inset-0`, also eigentlich am Sichtfenster verankert –
  aber jede äußere trägt `backdrop-blur-sm`, und ein `backdrop-filter` macht
  ein Element zum **Bezugsrahmen für `position: fixed`-Nachfahren** (wie
  `transform` und `filter`). Das `fixed` der inneren Ebene bezieht sich damit
  auf den gescrollten Container der äußeren. Wer in der Detailansicht nach
  unten gescrollt hat – und das muss, wer ihre Fußzeilen-Knöpfe erreichen will
  – bekam den neuen Dialog **oberhalb des Sichtbaren** und sah gar nichts.
  Alle vier inneren Ebenen rufen deshalb `useOpenAtTop` (`app/components/`),
  das beim Öffnen einmal `scrollIntoView` auslöst. Die Ursache bleibt stehen:
  Ein Portal an `document.body` würde die Verschachtelung auflösen, an der die
  gesamte Ereignis-Logik hängt, und ohne Weichzeichner verlöre man den Effekt,
  für den er da ist.

  Für Esc reicht das nicht:
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
