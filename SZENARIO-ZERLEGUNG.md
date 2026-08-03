# Plan: Zerlegung der Szenario-Detailseite (`app/scenarios/[id]/page.tsx`)

Plandokument neben den übrigen (`VERCEL+SUPABASE.md`, `HOSTINGER_VPS.md`,
`HTML_CSS_JS.md`, `EXTERNAL_PICS.md`, `SETTINGS_IDEEN.md`, `UI-Rework.md`,
`STRUKTUR.md`). Konkretisiert Alternative 1 aus `STRUKTUR.md`.

## Context

`app/scenarios/[id]/page.tsx` ist mit **2701 Zeilen** und **58 `useState`** die
mit Abstand größte handgeschriebene Datei. Sie hält den kompletten Zustand von
Welt-Festlegungen, Handlungsentwürfen, Story Arcs, Kapiteln, Besetzung,
Weltbildern, Personensuche, Export und der Speichern-/Verwerfen-Mechanik — plus
~40 Handler, die quer über diese Domänen schreiben. Die *Optik* ist schon
zerlegt (`ScenarioFields` wird 5× gerendert, dazu `StoryArcSection` und 5
Modale); das Problem ist die **Orchestrierung**.

Ziel: die Seite auf einen **dünnen Orchestrator** reduzieren, der wenige
**Custom-Hooks** komponiert (jeder besitzt einen kohärenten Zustands-Ausschnitt
+ seine Handler) und **Sektions-Komponenten** anordnet. Kein Verhaltenswechsel —
reiner Struktur-Umbau.

## Ist-Analyse: State- und Handler-Domänen

Die 58 `useState` fallen sauber in ~11 Domänen:

| Domäne | State (Auszug) | Handler (Auszug) |
|---|---|---|
| **Dokument-Kern** (Name/Festlegungen) | `name`, `details`, `saved`, `saving`, `dirty` | `speichern`, `save`, `festlegungenAendern`, `nameErzeugen` |
| **Handlungsentwürfe** | `varianten`, `aktiv`, `variantenMeta` | `aktuelleVarianten`, `varianteWaehlen/Kopieren/Loeschen`, `titelAendern`, `favoritUmschalten`, `leerenEntwurfHinzufuegen` |
| **Handlungs-Lauf-Parameter** | `handlungTon/Form/AlsBasis/Weiterspinnen`, `handlungNeuePersonen(+Wunsch)`, `handlungProvider`, `zusatz` | `handlungFortsetzen`, `handleGenerate` |
| **Story Arc + Varianten** | `storyArc`, `arcVarianten`, `arcAktiv`, `arcMeta`, `arcBusy`, `arcTitelBusy` | `aktuelleArcs`, `arcWaehlen/TitelNeu/Favorit/Cover/AlsBuch/Kopieren/Loeschen`, `storyArcAbleiten` |
| **Kapitel** | `kapitelBusy`, `kapitelFehler`, `kapitelTextBusy/Fehler`, `kapitelModell`, `storyTextModell` | `kapitelAbleiten`, `kapitelTextGenerieren` |
| **Arc-Lauf-Parameter** | `arcParams`, `arcProvider` | (in `arcParams`) |
| **Run-Params-Gedächtnis** | (localStorage-Effekte) | Lade-/Schreib-Effekt (`runParamsGeladen`) |
| **Besetzung/Charaktere** | `characters`, `selectedChar`, `protagonistBusy`, `genreSync(+Busy/Fehler)` | `charLoeschen/InhaltSpeichern/Aktualisiert/Zuordnen/Hinzugefuegt`, `protagonistUmschalten`, `genreUebertragen` |
| **Figur→Charakter / Personensuche** | `figurBusy/Fehler/Kandidat`, `ergebnis`, `suchend`, `gewaehlt` | `personenSuchen`, `personAnlegen`, `figurCharakterExtrahieren/Anlegen` |
| **Weltbilder** | `bilder`, `bildModalOffen`, `addOffen` | (Modal-Callbacks) |
| **Export/Löschen/Feld-Gen** | `mitCharakteren`, `mitBildern`, `exportiert`, `generatingField` | `exportieren`, `entfernen`, `handleGenerate` |

**Zentrale Kopplung (die den Zuschnitt bestimmt):** Name, Festlegungen,
Handlungsentwürfe **und** Story Arcs teilen sich **eine** Speicher-Einheit —
`dirty` vergleicht `JSON.stringify({name, details, plot, arc})` gegen die
`saved`-Basislinie, `speichern` PATCHt alle vier gemeinsam, „Verwerfen" setzt
alle zurück. Dazu zwei Invarianten: `details.handlung === varianten.items[aktiv]`
und `storyArc === arcVarianten.items[arcAktiv]`. **Diese Einheit darf die
Zerlegung nicht zerreißen** — sie gehört in *einen* Kern-Hook.

## Zielarchitektur

### Der Dokument-Kern (ein Hook)
**`useScenarioDocument(id)`** besitzt die geteilte Speicher-Einheit: lädt
Szenario/Charaktere/Bilder, hält `name`/`details`/`plotVariants`/
`storyArcVariants`, die `saved`-Basislinie, berechnet `dirty`, und stellt
`speichern`/`save`/`verwerfen` bereit. Hält außerdem die Invarianten an *einer*
Stelle (`aktuelleVarianten()`, `aktuelleArcs()`). Alles Weitere baut darauf auf.

### Feature-Hooks (bauen auf dem Kern auf)
Jeder kapselt State **und** Handler seiner Domäne, bekommt vom Kern nur die
Slice, die er braucht:

- **`usePlotVarianten(doc)`** — Varianten-Handling (wählen/kopieren/löschen/
  Titel/Favorit).
- **`useHandlungserzeugung(doc, runParams)`** — `handlungFortsetzen` +
  Lauf-Parameter + Zusatzwunsch + Provider.
- **`useStoryArc(doc, runParams)`** — Arc-Varianten-Handling + `storyArcAbleiten`.
- **`useKapitel(doc)`** — `kapitelAbleiten`, `kapitelTextGenerieren`,
  Kapitel-Busy/Fehler/Modell-Anzeige.
- **`useRunParams(id)`** — das localStorage-Gedächtnis (ist **schon** weitgehend
  gekapselt — nur herausziehen, inkl. der „skip-once"-Effektlogik).
- **`useScenarioCharacters(id, doc)`** — Besetzung: CRUD, Zuordnung, Protagonist,
  Genre-Sync, Detail-Modal.
- **`usePlotPersonen(id, doc)`** — Personensuche im Entwurf + Figur→Charakter-
  Extraktion.
- **`useScenarioBilder(id)`** — Weltbilder + Modal-Zustände.
- **`useScenarioFeldGen(doc)`** — die ✨-Knöpfe der `ScenarioFields`
  (`handleGenerate`, `generatingField`).
- **`useScenarioExport(doc, characters, bilder)`** — Export-Optionen +
  `exportieren` + `entfernen`.

### Sektions-Komponenten (JSX)
Der JSX-Block (Zeilen ~1650–2700) wird in präsentierende Sektionen zerlegt, die
ihre Props aus den Hooks bekommen — vieles ist **schon** ausgelagert:

- `<ScenarioHeader>` — Name/Breadcrumb, Speichern-/Verwerfen-Leiste, Export,
  Löschen.
- `<WeltKarte>` — `ScenarioFields` (Welt) + Weltbild-Vorschau/Modal.
- `<CharaktereKarte>` — Charaktere + Figuren + Protagonist.
- `<HandlungsentwurfKarte>` — `ScenarioFields` (Handlung) + Varianten-Reiter +
  Lauf-Parameter + Personensuche.
- `<StoryArcSection>` — **existiert bereits**.
- Die 5 Modale — **existieren bereits**.

Ergebnis: `page.tsx` schrumpft auf ~150–250 Zeilen (Hooks komponieren, Sektionen
anordnen, Modale schalten).

## Vorteile

1. **Testbarkeit — der größte Gewinn.** Die Feature-Hooks und der Dokument-Kern
   kapseln die kniffligen Invarianten (`dirty`-Vergleich, `handlung===items
   [aktiv]`, „skip-once"-Run-Params) an *einer* Stelle und lassen sich isoliert
   testen — genau die Lücke, die `STRUKTUR.md` schließt. Heute ist all das nur im
   2701-Zeilen-Rumpf und nur manuell prüfbar.
2. **Lesbarkeit & Orientierung.** Statt 58 `useState` + 40 Handler in einer
   Sichtachse hat jede Domäne ihre eigene Datei mit klarer öffentlicher API. Ein
   Neuzugang findet „wo wird der Arc gespeichert?" in `useStoryArc`, nicht per
   Scroll durch 2700 Zeilen.
3. **Weniger Kopplung, sicherere Änderungen.** Die zentrale Speicher-Einheit
   lebt in **einem** Hook; wer den Arc-Teil ändert, kann die Dirty-/Save-
   Invariante nicht mehr versehentlich brechen, weil sie nicht mehr über die
   halbe Datei verstreut ist.
4. **Weniger Merge-Konflikte.** Heute berührt fast jede Szenario-Änderung
   dieselbe Riesendatei. Getrennte Hook-/Sektions-Dateien lassen parallele Arbeit
   zu.
5. **Wiederverwendung.** `useScenarioDocument`/`useRunParams` sind Kandidaten für
   andere Einstiegspunkte; heute ist alles an diese eine Route genagelt.
6. **Kleinere Re-Renders (Nebeneffekt).** Sauber getrennte States/Sektionen
   erlauben gezieltere Memoisierung — heute rendert die ganze Seite bei jedem
   Tastendruck neu.
7. **Fundament für die anderen Umbauten.** Die entdoppelten Text-Routen und eine
   Client-Datenschicht (aus `STRUKTUR.md`) docken an den Hooks an, nicht am
   Monolithen.

## Migrationsstrategie (inkrementell, verhaltenswahrend)

**Voraussetzung:** möglichst **nach** dem Test-Fundament aus `STRUKTUR.md` — dann
ist jeder Schritt durch Tests abgesichert. Mindestens aber die Dirty-/Save-
Invariante als Test festhalten, bevor man sie anfasst.

Reihenfolge (jeder Schritt: `tsc` + `lint` grün + kurzer Smoke-Test im
Dev-Server, Verhalten unverändert):
1. **Randständige, schon gekapselte Domänen zuerst** (geringstes Risiko):
   `useRunParams`, `useScenarioBilder`, `useScenarioExport`. Sofort spürbare
   Entlastung, kaum Kopplung.
2. **`useScenarioDocument`** herausziehen (der Kern) — Load, Name/Details/Plot/
   Arc, `saved`/`dirty`/`speichern`/`verwerfen`, Invarianten. **Byte-genau**
   dieselbe `dirty`-JSON-Form behalten.
3. **Darauf aufsetzend**: `usePlotVarianten`, `useStoryArc`, `useKapitel`,
   `useHandlungserzeugung`, `useScenarioFeldGen`.
4. **Besetzung/Personen**: `useScenarioCharacters`, `usePlotPersonen` (berühren
   `sessionStorage`-Übergabe und Detail-Modal — vorsichtig).
5. **JSX in Sektions-Komponenten** aufteilen (rein optisch, Props aus den Hooks).
6. `page.tsx` auf den Orchestrator eindampfen.

## Risiken & Leitplanken

- **Die Speicher-Einheit nicht zerreißen:** Name/Details/Plot/Arc bleiben in
  *einem* Kern-Hook; `dirty` behält exakt die bisherige JSON-Vergleichsform
  (sonst „ungespeichert"-Fehldiagnosen).
- **Modal-Ökosystem unangetastet:** `useBackdropClose`, `useOpenAtTop`,
  Capture-Phase-Esc und die `z-50→z-80`-Ebenen bleiben, wie sie sind — nur die
  *Auslöser* wandern in Hooks.
- **Effekt-Reihenfolge bewahren:** die „skip-once"-Logik der Run-Params (Laden im
  `getScenario`-`.then`, Schreib-Effekt erst danach scharf) 1:1 in `useRunParams`
  übernehmen.
- **`sessionStorage`-Handoff** (Person → Erstellen-Formular) und der
  `speichern(neueDetails)`-vor-Navigation-Trick (Figur→Charakter) müssen erhalten
  bleiben.
- **Kein Verhaltenswechsel** ist das Abnahmekriterium: gleiche Klicks, gleiche
  Ergebnisse, gleiche gespeicherten Daten.

## Neu anzulegen (repräsentativ)

`app/scenarios/[id]/hooks/{useScenarioDocument,usePlotVarianten,useStoryArc,useKapitel,useHandlungserzeugung,useRunParams,useScenarioCharacters,usePlotPersonen,useScenarioBilder,useScenarioFeldGen,useScenarioExport}.ts`
und `app/scenarios/[id]/sections/{ScenarioHeader,WeltKarte,CharaktereKarte,HandlungsentwurfKarte}.tsx`;
`page.tsx` als schlanker Orchestrator.
