# Plan: Zerlegung der Szenario-Detailseite (`app/scenarios/[id]/page.tsx`)

Plandokument neben den übrigen (`VERCEL+SUPABASE.md`, `HOSTINGER_VPS.md`,
`HTML_CSS_JS.md`, `EXTERNAL_PICS.md`, `SETTINGS_IDEEN.md`, `UI-Rework.md`,
`STRUKTUR.md`). Konkretisiert Alternative 1 aus `STRUKTUR.md`. **Verifizierter
Ist-Stand (Codeanalyse 03.08.2026), nicht Schätzung.**

## Context

`app/scenarios/[id]/page.tsx` ist mit **2760 Zeilen**, **57 `useState`**, 4
`useEffect`, ~40 Handlern und einer `useRef` die mit Abstand größte
handgeschriebene Datei. Die Komponente `ScenarioDetailPage` läuft von Zeile
125–2760; der JSX-Block beginnt bei 1673. Sie hält den kompletten Zustand von
Welt-Festlegungen, Handlungsentwürfen, Story Arcs, Kapiteln, Besetzung,
Weltbildern, Personensuche, Export und der Speichern-/Verwerfen-Mechanik – plus
Handler, die quer über diese Domänen schreiben.

Die *Optik* ist bereits zerlegt (`ScenarioFields` wird **5×** gerendert,
`StoryArcSection` mit **33 Props**, dazu 5 Modale); das Problem ist die
**Orchestrierung** in einer einzigen Sichtachse. Ziel: die Seite auf einen
**dünnen Orchestrator** reduzieren, der wenige **Custom-Hooks** komponiert
(jeder besitzt einen kohärenten Zustands-Ausschnitt + seine Handler) und
**Sektions-Komponenten** anordnet. **Kein Verhaltenswechsel – reiner
Struktur-Umbau.** Abnahmekriterium: gleiche Klicks, gleiche Ergebnisse, gleiche
gespeicherte Daten.

## Die zentrale Kopplung (bestimmt den ganzen Zuschnitt)

Name, Festlegungen, **alle** Handlungsentwürfe **und alle** Story Arcs teilen
sich **eine** Speicher-Einheit. Diese darf die Zerlegung nicht zerreißen — sie
gehört in *einen* Kern-Hook. Drei Invarianten, exakt zu erhalten:

1. **`dirty`-Vergleich** (Z. 1181–1199): `saved !== ""` **und**
   ```js
   JSON.stringify({ name, details,
     plot: { items: aktuelleVarianten(), aktiv,     meta: ausgerichtet(variantenMeta, aktuelleVarianten().length) },
     arc:  { items: aktuelleArcs(),      aktiv: arcAktiv, meta: ausgerichtet(arcMeta,       aktuelleArcs().length) },
   }) !== saved
   ```
2. **`saved`-Baseline** (Z. 984–991 im Load, Z. 1563–1570 nach `speichern`):
   **andere Wertquelle** – `plot`/`arc` sind das **Server-Objekt direkt**
   (`aktualisiert.plotVariants`), nicht der `ausgerichtet(...)`-Aufbau. Diese
   **Asymmetrie ist byte-genau zu bewahren** (sonst „ungespeichert"-Fehldiagnose
   direkt nach dem Laden).
3. **Zwei Merge-Invarianten** – die live editierte aktive Zelle wird erst beim
   *Lesen* in die Liste gefaltet:
   - `details.handlung === varianten[aktiv]` via `aktuelleVarianten()` (443–447)
   - `storyArc === arcVarianten[arcAktiv]` via `aktuelleArcs()` (594–598)
   - `ausgerichtet(meta, laenge)` (Z. 121, top-level, bereits **pure**) gleicht
     `meta` an `items.length` an.

`speichern(overrideDetails?)` (1534–1578) PATCHt alle vier Felder gemeinsam über
`updateScenario(id, {name, details, plotVariants, storyArcVariants})` und baut
`saved` neu. `save()` (1580) ist der Guard davor; „Verwerfen" ist ein **inline
`onClick`** (1738–1754), der aus `saved` alle neun States zurücksetzt. Der
`speichern(neueDetails)`-vor-Navigation-Trick in `figurCharakterAnlegen`
(1315–1335) hängt an genau diesem `overrideDetails`-Parameter.

## Vorbedingung: Es gibt kein Test-Setup

`package.json` hat **keine** Test-Abhängigkeit (nur `dev/build/start/lint`), es
existiert **keine** `*.test.ts`, kein vitest/jest. `STRUKTUR.md` nennt ein
Test-Fundament als Voraussetzung – das muss hier **zuerst mit-gebaut** werden,
sonst ist der Umbau nur manuell absicherbar. Pragmatischer Zuschnitt: **nur die
fragilen puren Kernfunktionen** bekommen Tests (nicht die ganze App), siehe
Stufe 0/1.

## Zielarchitektur

### Reine Logik zuerst (kein React): `lib/scenarioDocument.ts`
Die drei Invarianten sind heute Closures in der 2760-Zeilen-Komponente, obwohl
sie **fast pur** sind. Herausgezogen als testbare Funktionen:
- `mergeVarianten(varianten, aktiv, handlung)` ← `aktuelleVarianten`
- `mergeArcs(arcVarianten, arcAktiv, storyArc)` ← `aktuelleArcs`
- `ausgerichtet(meta, laenge)` (aus Z. 121 hierher)
- `currentSnapshot({name, details, plot, arc})` → **exakte** `dirty`-JSON-Form
- `savedSnapshot({name, details, plotVariants, storyArcVariants})` → die
  **asymmetrische** `saved`-Form (Server-Objekt direkt)
- `isDirty(saved, current)` → `saved !== "" && current !== saved`

### Der Dokument-Kern (ein Hook): `useScenarioDocument(id)`
Besitzt die geteilte Speicher-Einheit **und** die einmalige Ladung: ruft
`getScenario(id)` (liefert `{scenario, characters}`; Bilder aus
`scenario.images`), hydriert `name/details/varianten/aktiv/variantenMeta/
storyArc/arcVarianten/arcAktiv/arcMeta`, baut die `saved`-Baseline via
`savedSnapshot`, berechnet `dirty` via `currentSnapshot`+`isDirty`, stellt
`speichern/save/verwerfen` bereit und hält die Merge-Invarianten über die
`lib/scenarioDocument.ts`-Funktionen. Gibt zusätzlich die **einmalig geladenen**
`characters`/`bilder` als Startwerte an die Feature-Hooks weiter (kein zweites
`getScenario`). Rückgabe: ein `doc`-Objekt (State-Slices + Mutatoren), auf dem
alles Weitere aufbaut.

### Feature-Hooks (bekommen vom Kern nur ihre Slice)
Verzeichnis `app/scenarios/[id]/hooks/`:
- **`useRunParams(id)`** — das `localStorage`-Gedächtnis. **Schon fast gekapselt**
  (`ladeRunParams`/`speichereRunParams` aus `lib/scenarioRunParams`, der
  `runParamsGeladen`-Ref-Gate + Schreib-Effekt). Nur herausziehen, **skip-once
  1:1 erhalten**: laden im `getScenario`-`.then`, Schreib-Effekt bleibt bis
  `runParamsGeladen.current` gesetzt still.
- **`usePlotVarianten(doc)`** — `varianteWaehlen/Kopieren/Loeschen/
  alleLoeschen/leerenHinzufuegen`, `titelAendern`, `favoritUmschalten`.
- **`useHandlungserzeugung(doc, runParams)`** — `handlungFortsetzen`,
  `handleGenerate("handlung")` + die Lauf-Parameter (`handlungTon/Form/AlsBasis/
  Weiterspinnen/NeuePersonen(+Wunsch)`, `handlungProvider`, `zusatz`).
- **`useStoryArc(doc, runParams)`** — Arc-Varianten (`arcWaehlen/TitelAendern/
  TitelNeu/Favorit/Cover/AlsBuch/Kopieren/Loeschen`) + `storyArcAbleiten` +
  `arcParams`/`arcProvider`.
- **`useKapitel(doc)`** — `kapitelAbleiten`, `kapitelTextGenerieren`,
  `kapitelBusy/Fehler`, `kapitelTextBusy/Fehler`, `kapitelModell/storyTextModell`.
- **`useScenarioFeldGen(doc)`** — die ✨-Knöpfe der `ScenarioFields`
  (`handleGenerate` für ort/zeit/regeln/figuren/beschreibung/handlungselemente,
  `generatingField`, `zusatz`-Feldwünsche, `nameErzeugen`).
- **`useScenarioCharacters(id, doc)`** — Besetzung: `charLoeschen/InhaltSpeichern/
  Aktualisiert/Zuordnen/Hinzugefuegt`, `protagonistUmschalten`,
  `festlegungenAendern`+`genreUebertragen` (Genre-Sync), `selectedChar`,
  `allScenarios`. Persistiert **sofort** (unabhängig vom Dokument-Save).
- **`usePlotPersonen(id, doc)`** — Personensuche (`personenSuchen`,
  `personAnlegen`) + Figur→Charakter (`figurCharakterExtrahieren/Anlegen`) inkl.
  `sessionStorage`-Handoff (`stashPlotPerson`) und dem
  `speichern(neueDetails)`-vor-Navigation-Trick.
- **`useScenarioBilder(doc)`** — Weltbilder (`bilder`, `bildModalOffen`) +
  Modal-Callbacks.
- **`useScenarioExport(doc, characters, bilder)`** — `mitCharakteren/mitBildern`,
  `exportieren`, `entfernen`.

### Sektions-Komponenten (JSX): `app/scenarios/[id]/sections/`
Der JSX-Block (1673–2759) in präsentierende Sektionen, Props aus den Hooks:
- **`<ScenarioHeader>`** — Breadcrumb + editierbarer Name + KI-Name (1675–1723),
  Speichern-/Verwerfen-Leiste (1725–1766).
- **`<WeltKarte>`** — `ScenarioFields`(beschreibung, 1774–1852) +
  `ScenarioFields`(genre/ort/zeit/regeln, 1854–1871) + Weltbild-Vorschau/Modal.
- **`<CharaktereKarte>`** — Charaktere + Figuren-Notizen (1882–2059) inkl.
  Protagonist, Zuordnen/Hinzufügen.
- **`<HandlungsentwurfKarte>`** — Handlungselemente + Varianten-Reiter +
  Lauf-Parameter + `ScenarioFields`(handlung) + „fortsetzen" + Personensuche
  (2069–~2560).
- **`<StoryArcSection>`** — **existiert bereits** (nur Props aus den Hooks).
- **`<ExportLeiste>`** — Export/Löschen (2611–2676).
- Die **5 Modale existieren bereits** (`PlotPersonModal` ×2,
  `AddCharacterToScenarioModal`, `ScenarioImageModal`, `CharacterDetailModal`,
  `GenreSyncModal`, 2678–2757) – nur Verdrahtung wandert.

Ergebnis: `page.tsx` schrumpft auf ~150–250 Zeilen (Hooks komponieren,
Sektionen anordnen, Modale schalten).

## Wiederverwenden (nicht neu bauen)

`getScenario`/`listScenarios`/`updateScenario`/`deleteScenario`/
`buildScenarioFile` aus `lib/client.ts`; `ladeRunParams`/`speichereRunParams`
(`lib/scenarioRunParams`); `stashPlotPerson` (`lib/personHandoff`);
`aktiveEintraege`/`aktiveFiguren`/`splitFigurenDetail`/`joinFigurenDetail`
(`lib/figuren`); `primaryImage` (`lib/serialize`); `downloadBlob`/`safeFileName`
(`lib/download`). Die Modal-Verschachtelung (`useBackdropClose`, `useOpenAtTop`,
Capture-Phase-Esc, `z-50→z-80`) steckt **in den Kind-Komponenten** und bleibt
**unangetastet** – nur die *Auslöser* wandern in Hooks.

## Migrationsstrategie (inkrementell, jeder Schritt einzeln lieferbar)

Jeder Schritt endet grün: `npx tsc --noEmit` **und** `npm run lint`, plus
Dev-Server-Smoke-Test (Szenario öffnen, tippen → „ungespeichert", speichern,
neu laden, Variante/Arc wechseln, eine Erzeugung, Export). **Ein Commit je
Stufe.**

- **Stufe 0 — Test-Harness (klein).** `vitest` als devDependency + `test`-Script
  (`vitest run`), eine `vitest.config.ts`. Nur für pure `lib/`-Logik, kein
  DOM/React-Testing. Kein Eingriff in Laufzeit.
- **Stufe 1 — `lib/scenarioDocument.ts` + Tests.** Pure Funktionen extrahieren
  (oben), Seite importiert sie statt der Closures. **Byte-Vergleich**: `dirty`
  und `saved` müssen zeichengleich bleiben (Test: alte vs. neue Snapshot-Form,
  inkl. der Asymmetrie). Risiko minimal, Nutzen hoch – die fragilsten Zeilen
  sind danach getestet.
- **Stufe 2 — `useRunParams`.** Randständig, schon gekapselt; „skip-once" 1:1.
- **Stufe 3 — `useScenarioBilder`, `useScenarioExport`.** Geringe Kopplung.
- **Stufe 4 — `useScenarioDocument` (Kern).** Load + Speicher-Einheit + Invarianten
  (auf Stufe 1 aufsetzend). Die riskanteste Stufe; hier zahlt sich Stufe 1 aus.
- **Stufe 5 — `usePlotVarianten`, `useStoryArc`, `useKapitel`,
  `useHandlungserzeugung`, `useScenarioFeldGen`.**
- **Stufe 6 — `useScenarioCharacters`, `usePlotPersonen`** (berühren
  `sessionStorage`-Handoff + Detail-Modal – vorsichtig, `dirty={false}`-Pfad des
  Figur-Kandidaten und der `overrideDetails`-Trick müssen bleiben).
- **Stufe 7 — JSX in Sektions-Komponenten** (rein optisch, Props aus Hooks).
- **Stufe 8 — `page.tsx` auf den Orchestrator eindampfen.**

## Risiken & Leitplanken

- **Speicher-Einheit nicht zerreißen:** Name/Details/Plot/Arc bleiben in *einem*
  Kern-Hook; `currentSnapshot`/`savedSnapshot` behalten **exakt** die bisherige
  (asymmetrische) JSON-Form.
- **Merge-Invarianten** (`handlung===items[aktiv]`, `storyArc===items[aktiv]`) an
  *einer* Stelle, über die getesteten `lib/scenarioDocument.ts`-Funktionen.
- **Effekt-Reihenfolge:** die „skip-once"-Run-Params-Logik unverändert (Laden im
  `.then`, Schreib-Effekt erst danach scharf).
- **Modal-Ökosystem unangetastet.**
- **`sessionStorage`-Handoff** und der `speichern(overrideDetails)`-vor-Navigation-
  Trick bleiben erhalten.
- **Kein Verhaltenswechsel** = Abnahmekriterium.

## Auswirkung auf die UI

**Keine sichtbare.** Optik, Layout, Interaktion, Modale bleiben identisch;
markup-erhaltend verschoben. Möglicher Nebeneffekt: gezieltere Memoisierung →
weniger Re-Renders bei großen Szenarien. Der eigentliche Gewinn ist *zukünftige*
UI-Arbeit an der Seite, die dann nicht mehr im Monolithen stattfindet.

## Neu anzulegen (repräsentativ)

- `lib/scenarioDocument.ts` (+ `lib/scenarioDocument.test.ts`), `vitest.config.ts`
- `app/scenarios/[id]/hooks/{useScenarioDocument,useRunParams,usePlotVarianten,
  useStoryArc,useKapitel,useHandlungserzeugung,useScenarioFeldGen,
  useScenarioCharacters,usePlotPersonen,useScenarioBilder,useScenarioExport}.ts`
- `app/scenarios/[id]/sections/{ScenarioHeader,WeltKarte,CharaktereKarte,
  HandlungsentwurfKarte,ExportLeiste}.tsx`
- `page.tsx` als schlanker Orchestrator.

## Verifikation (End-to-End je Stufe)

1. `npx tsc --noEmit` + `npm run lint` grün.
2. `npm test` (ab Stufe 0) grün – Snapshot-Tests der `dirty`/`saved`-Form.
3. Dev-Server: Szenario öffnen → tippen (Banner „ungespeichert") → speichern →
   neu laden (kein Banner). Variante **und** Arc wechseln (aktive Zelle korrekt).
   Eine Feld-Erzeugung, „Handlung fortsetzen", einen Arc ableiten. Export mit/ohne
   Bilder. Personensuche → Kandidat → Anlegen (Handoff, Figur verschwindet).
4. Nach Stufe 8: Diff der erzeugten `page.tsx` gegen den Ausgangsstand nur noch
   Komposition; keine Domänenlogik mehr in der Datei.
