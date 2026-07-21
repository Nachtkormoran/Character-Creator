# Konzept: Story Arc aus dem Handlungsentwurf

Planungsdokument für ein noch **nicht umgesetztes** Feature. Es lehnt sich an die
vorhandene Architektur und die Entwurfsphilosophie des Projekts an
(Handlungsentwurf/`plotVariants`, `storyHooks`, die Structured-Output-Routen,
`getTextClient`/`extraParams`). Reihenfolge der Wahrheit wie überall: erst die
gespeicherten Festlegungen, dann das, was der Nutzer gerade bearbeitet hat.

---

## 1. Idee und Abgrenzung

Der **Handlungsentwurf** (`POST /api/scenario-plot`) ist ein Fließtext-Absatz:
der zentrale Konflikt und die grobe Flugbahn einer Geschichte, destilliert aus
den Figuren des Szenarios. Er sagt *worum es geht* – aber nicht, *in welcher
Reihenfolge es sich entfaltet*.

Der **Story Arc** ist genau diese fehlende Ebene: die **dramaturgische
Zerlegung** eines Handlungsentwurfs in eine geordnete Folge von **Stationen**
(Beats/Akte). Er erfindet keine neue Geschichte, sondern gliedert die
vorhandene.

Das ist dieselbe Sorte Abgrenzung wie **Beschreibung ↔ Handlungsentwurf**: eine
Fassung derselben Sache auf anderer Ebene, die der Quelle **nie widersprechen**
darf. Die Kette der Ableitungen wächst um ein Glied:

```
Figuren (+ storyHooks) ──► Handlungsentwurf ──► Story Arc
       (scenario-plot)              (scenario-arc, neu)
```

---

## 2. Datenmodell

Eine **eigene Spalte `Scenario.storyArc`** (JSON-String), neben `plotVariants` –
dieselbe Begründung wie dort und wie `storyHooks` neben `traits`: Es ist eine
**Struktur, die die Oberfläche führt und erst auf Knopfdruck entsteht**. Kein
Feld in `details`, damit `ScenarioDetails`, alle `SCENARIO_LABELS`-Karten und
jeder Verbraucher von `details.handlung` unangetastet bleiben.

```ts
type StoryArc = {
  stufen: ArcStufe[];
};

type ArcStufe = {
  titel: string;        // "Der Auslöser", "Der Punkt ohne Umkehr"
  phase: ArcPhase;      // feste Dramaturgie-Stufe (Enum, s. u.)
  beschreibung: string; // was in dieser Station passiert (Fließtext)
  figuren: string[];    // Namen der Figuren, die sie tragen – Rückbindung
};
```

`ArcPhase` als kleines Enum in `schema.ts` (deutsche Fünf-Akt-Tradition nach
Freytag, weil das Ziel „Buch/Spiel" ist, nicht Drehbuch):

```
exposition | steigerung | hoehepunkt | fall | aufloesung
```

**Ein Arc je Szenario**, abgeleitet aus dem **aktiven** Handlungsentwurf
(`details.handlung`). Bewusst *nicht* je Variante – das wäre der aufwändigere
Weg (`plotVariants` müsste von Strings auf Objekte umgestellt werden).
Stattdessen wie bei den `storyHooks`: eine Struktur, die neu erzeugt oder
verworfen wird.

`normalizeStoryArc` in `serialize.ts` liefert für Altbestände `{ stufen: [] }` –
kein Sonderfall „kein Arc" nötig, dieselbe Idee wie `normalizePlotVariants`.

---

## 3. Route: `POST /api/scenario-arc`

Die **vierte Structured-Output-Route** (nach `generate-text`,
`scenario-from-character`, `scenario-plot-persons`) – es entstehen mehrere Stufen
mit je vier Feldern, die einzeln in die Oberfläche müssen; genau dafür ist das
JSON-Schema da.

Zuschnitt exakt wie `scenario-plot`:

- **Figuren lädt die Route selbst** über die `scenarioId` (Namen für die
  `figuren`-Rückbindung, Kurzbeschreibung + `storyHooks` als Material).
- **Der Handlungsentwurf kommt aus dem Request** – er kann in der
  Detailansicht ungespeichert bearbeitet sein (dieselbe Regel wie überall).
- **Ohne Handlungsentwurf → 400** mit Hinweis. Ein Arc über nichts wäre teurer
  Unsinn; genau wie `scenario-plot` ohne Figuren.
- **Persistiert nichts** – Ergebnis geht in den Bearbeitungs-Zustand,
  gespeichert wird über „Änderungen speichern" (PATCH um `storyArc` erweitert).
- `getTextClient()` liefert Client/Modell/`extraParams`; die Umlaut-Prüfung
  `hatKaputteZeichen` (rekursiv, greift also auch tief in den Stufen) plus
  **ein** Wiederholversuch, wie bei den anderen Structured-Routen. Bei Gemini
  schaltet `reasoning_effort: "minimal"` das Nachdenken ab.

---

## 4. Prompt-Design (der eigentliche Kern)

Hier zahlen sich die dokumentierten Lehren des Projekts direkt aus:

- **Prüfbarer Endzustand statt Verfahren.** Nicht „arbeite den Entwurf in Akte
  um", sondern: „Am Ende müssen **genau N Stationen** dastehen, die zusammen den
  Entwurf lückenlos von seinem Ausgangszustand bis zu seiner Auflösung
  abschreiten; jede Station verändert die Lage gegenüber der vorigen." (Wie beim
  „Rahmen + zwei Schauplätze" der Ortserzeugung.)
- **Zerlegung, keine Neuerfindung.** Der Entwurf ist die **Obergrenze der
  Wahrheit**: „Erfinde keine Ereignisse, die nicht im Entwurf angelegt sind.
  Wenn er etwas offenlässt, konkretisiere es aus den Figuren – erfinde keine
  neue Wendung." Das ist die `eng`-Bindung der `storyHooks`, hier als Default.
- **Rückbindung mit Nachweis.** Jede Stufe nennt in `figuren` die Namen, die sie
  tragen – und der Prompt verlangt, dass diese Namen aus der mitgelieferten
  Besetzung stammen (nicht erfunden). Grobe Nachprüfung serverseitig über
  **ganze Namensteile**, wie in `scenario-plot-persons`.
- **Ausgabeform ausdrücklich.** „Keine Nummerierung, keine Aufzählungszeichen in
  der Beschreibung" – Nummern zählt das Modell nicht zu „Aufzählung", das musste
  bei der Ortserzeugung explizit werden.
- **Material, nicht nur Kurzfassung.** Wie bei `scenario-plot` gehen
  Kurzbeschreibung, langer Text, Merkmale **und** `storyHooks` der Figuren mit –
  die Vorgeschichte trägt die Konflikte, die eine Station braucht.

---

## 5. Parameter (vor dem Erzeugen)

- **Länge** (`laenge`: `kurz` | `mittel` | `lang` → 3 / 5 / 8 Stationen). Als
  Enum, weil die Stufenzahl die Dramaturgie bestimmt: 5 = klassischer
  Fünfakter, 3 = Buch/Spiel-Kurzbogen, 8 = Kampagne/Roman. Steuert direkt das
  „genau N" im Prompt.
- **Format** (`format`: `buch` | `spiel`, optional). Nur eine Tonlage-Angabe im
  Prompt: bei `spiel` sind die Stationen *spielbare Szenen* (etwas, das eine
  Gruppe *tut*), bei `buch` *Erzählabschnitte*. Passt zum Doppelzweck der App.
  Kein eigenes Datenfeld – beschreibt den Lauf, nicht den Arc (nicht
  gespeichert, wie „Bindung"/„Richtung").
- **Zusatzwunsch** (`zusatz`, max. 1000, optional), in der Kopfzeile neben dem
  Knopf – wie beim Handlungsentwurf („ein Verrat soll den Wendepunkt tragen").
  Nicht gespeichert.

Anders als bei den `storyHooks` gibt es hier **keine konkurrierende
Bindungsstufe** – der Konflikt „Wunsch schlägt Rangordnung" entsteht nicht, weil
die Zerlegung ohnehin eng am Entwurf bleibt.

---

## 6. Oberfläche

In der **Szenario-Detailansicht, direkt unter dem Handlungsentwurf-Feld** (unter
der Varianten-Reiterleiste), ein Abschnitt „Story Arc":

- Knopf **„📖 Story Arc ableiten"** (Nebenknopf, kein zweiter betonter neben
  „Handlungsentwurf erzeugen"), daneben Länge-Auswahl, Format und
  Zusatzwunsch-Feld.
- Die Stufen als **vertikale Zeitleiste** von Karten: `phase`-Marke (farbig,
  die Farbfolge encodiert die dramaturgische Kurve – echte Struktur, keine
  Deko), editierbarer `titel`, editierbare `beschreibung` (`AutoTextarea`), die
  `figuren` als kleine Chips. ✕ je Karte löscht eine Station; Stufen per Drag
  oder ▲▼ umsortierbar.
- Wie `storyHooks`/`plotVariants`: lebt im **Bearbeitungs-Zustand**, „Änderungen
  speichern" legt ab, „Verwerfen" holt den gespeicherten Arc zurück.
- **Warnung in Bernstein**, wenn der aktive Handlungsentwurf seit der letzten
  Arc-Erzeugung geändert wurde (Vergleich gegen einen mitgespeicherten
  Hash/Snapshot der `handlung`) – „Der Arc stammt aus einer früheren Fassung des
  Entwurfs." Ehrlicher Umgang mit der Ein-Arc-Entscheidung aus §2, statt das
  Problem im Prompt zu verstecken.

Ein visueller Mockup des MVP-Layouts (Fünfakter-Timeline im App-Look, hell/
dunkel) wurde als Artifact erstellt.

---

## 7. Grenzen und Fallstricke (aus der Projekterfahrung)

- **Zeichenlimit großzügig.** 8 Stationen × ein Absatz ≈ mehrere tausend
  Zeichen. Das PATCH-Limit für `storyArc` von Anfang an weit setzen und
  `max_tokens` daraus bemessen – ein enges Limit schlägt **spät** zu (erst beim
  Speichern, wenn die Arbeit getan ist).
- **Umlaut-Wächter greift rekursiv** – der kaputte Umlaut in der dritten Stufe
  ist so schlimm wie einer oben (`hatKaputteZeichen` kann das schon).
- **Kein Auto-Start** beim Öffnen – ein Modellaufruf beim bloßen Ansehen wäre
  der falsche Präzedenzfall (dieselbe Regel wie bei `scenario-plot-persons`).

---

## 8. Noch nicht dabei / Folgeschritte

- **Arc pro Variante**: `plotVariants` von Strings auf Objekte mit optionalem
  `arc` heben. Der sauberere, aber größere Umbau – erst, wenn sich das
  Ein-Arc-Modell als zu eng erweist.
- **Arc im Szenario-Export** (`scenarioFile.ts`) – analog nachrüstbar, wie das
  Weltbild dort noch fehlt.
- **Rückrichtung**: aus einer Arc-Station einen Charakter ableiten (die Station
  nennt ja `figuren`, darunter evtl. neue) – analog zu `scenario-plot-persons`.

---

## 9. MVP

Kleinster sinnvoller erster Schritt: **Route + Spalte + einfache Karten-Liste**,
feste 5 Stufen (Fünfakter), ohne Format/Länge/Zusatz/Umsortieren/Änderungs-
Warnung. Das liefert den Kern (Entwurf → strukturierter Bogen) und lässt sich
exakt an `scenario-plot` modellieren; die Parameter und die Zeitleisten-Politur
kommen danach.

**Umsetzungsschritte:**

1. **Migration** – Spalte `storyArc` (JSON-String, nullable) an `Scenario`.
2. **`schema.ts`** – `ArcPhase`-Enum, `arcStufeSchema` / `storyArcSchema`
   (Structured Output, **kein** `.int()`), `MAX_ARC_STUFEN`, PATCH-Schema um
   `storyArc` erweitern.
3. **`serialize.ts`** – `normalizeStoryArc` (Altbestand → `{ stufen: [] }`),
   `StoredScenario` um `storyArc` ergänzen; `serializeScenario` liest die Spalte.
4. **Route `app/api/scenario-arc/route.ts`** – Figuren via `scenarioId` laden,
   `handlung` aus dem Request, Structured Output über `getTextClient`, 400 ohne
   Handlung, Umlaut-Guard + ein Retry.
5. **`prompts.ts`** – `buildStoryArcPrompt(handlung, figuren)` nach den Regeln
   aus §4.
6. **`client.ts`** – `generateStoryArc(scenarioId, handlung)` +
   `updateScenarioArc(...)` (bzw. `storyArc` in das bestehende PATCH aufnehmen).
7. **UI** – Abschnitt in `app/scenarios/[id]/page.tsx` unter dem
   Handlungsentwurf: Ableiten-Knopf, Karten-Timeline, ✕ je Karte, Speichern/
   Verwerfen über den vorhandenen Mechanismus.

**Aufwand:** vergleichbar mit dem, was `plotVariants` gekostet hat.

**Verifikation** (wie im Projekt üblich, keine Testsuite): `npx tsc --noEmit`
als Standard-Check; Route per `curl` gegen den Dev-Server (Arc aus einem
Szenario mit ≥1 Figur und gesetztem Handlungsentwurf; 400 ohne Handlung;
Rückbindung der `figuren` auf die tatsächliche Besetzung; PATCH persistiert
`storyArc`). Testdaten danach entfernen.
