# Plan: Strukturelle Verbesserung — Automatisierte Test-Suite als Fundament

Plandokument neben den übrigen (`VERCEL+SUPABASE.md`, `HOSTINGER_VPS.md`,
`HTML_CSS_JS.md`, `EXTERNAL_PICS.md`, `SETTINGS_IDEEN.md`, `UI-Rework.md`).

## Kennzahlen (gemessen)

- **Riesen-Komponente:** `app/scenarios/[id]/page.tsx` = **2701 Zeilen** mit
  **58 `useState`**; dazu `StoryArcSection` (1471), `lib/prompts.ts` (2317),
  `lib/client.ts` (1185).
- **34 API-Routen**, davon **19** über `getTextClient`; **7** duplizieren die
  Umlaut-Wächter-/Retry-Logik.
- **Keine Tests** — kein Framework, kein `test`-Script. Verifikation heute:
  `tsc --noEmit` + manuelles `curl`.

## Context

Die App hat gemessene strukturelle Schwächen: eine 2701-Zeilen-„God-Component",
~20 fast baugleiche Text-Routen mit kopierter Retry-Logik, und **null
automatisierte Tests**. Der Korrektheits-Check ist heute `tsc --noEmit` plus
manuelles `curl` gegen den Dev-Server.

Der Preis dafür ist real und frisch belegt: Beim Bauen des additiven Imports
fiel auf, dass der **bestehende** Restore stillschweigend `details`,
`plotVariants`, `storyArc`, `storyArcVariants` und `isProtagonist` verlor — ein
schwerer Datenverlust-Bug, der **Monate** unbemerkt blieb. Ein einziger
Round-Trip-Test hätte ihn sofort gezeigt.

Zugleich ist CLAUDE.md voll von **manuell** verifizierten Invarianten („Prompt
zeichengenau wie vorher", „150 Kombinationen des Gegenwarts-Bildprompts
identisch", „Byte-Vergleich der Plot-/Arc-Prompts"). Diese Garantien sind heute
nur Prosa — jede Änderung riskiert sie neu.

**Empfehlung:** Als erste strukturelle Verbesserung eine **Test-Suite (Vitest)**
einführen. Nicht weil Tests „gut" sind, sondern weil sie hier das höchste
Verhältnis von Wirkung zu Risiko haben: additiv (kein Umbau), sie sichern die
dokumentierten Invarianten ab, hätten den Backup-Bug gefangen — und sie sind die
**Voraussetzung**, um die riskanteren Umbauten (God-Component zerlegen, Routen
entdoppeln) überhaupt sicher zu machen.

## Warum genau das, und nicht direkt der große Umbau

Die App besteht zu einem großen Teil aus **reiner, abhängigkeitsfreier Logik**
in `lib/` — genau das, was sich trivial und schnell testen lässt, und genau das,
worauf die riskante UI aufsetzt:

- **Normalisierer/Serialisierung:** `normalizeTraits`, `normalizeMetaList`,
  `normalizePlotVariants`, `normalizeScenarioDetails`, `normalizeInputGenre`,
  `serialize.ts` (`primaryImage`).
- **String-Zerleger:** `storyHooks.ts` (`splitHooks`/`joinHooks`), `figuren.ts`
  (`splitEintraege`/`joinEintraege`/`aktiveEintraege`), `splitKapitelSegmente`,
  `kapitelSpanne`.
- **Prompt-Bau:** `prompts.ts` (die ganzen „byte-identisch"-Garantien).
- **Datei-Formate:** `characterFile.ts` / `scenarioFile.ts` (Round-Trips).
- **Würfel:** `names.ts`, `backgrounds.ts`, `professions.ts` (Genre-Trennung,
  keine Vermischung).
- **Neu:** `scenarioRunParams.ts` (`.catch`-Fallbacks — bereits manuell mit tsx
  geprüft; gehört in die Suite).

## Setup

- **Vitest** (+ `@vitest/coverage-v8` optional) als DevDependency. Passt zu
  Vite/ESM, versteht TS und die `@/`-Pfad-Aliase (über `vite-tsconfig-paths`),
  startet in Millisekunden.
- `vitest.config.ts` mit `environment: "node"` als Default; für die wenigen
  DOM-nahen Helfer (`lib/image.ts` braucht Canvas — eher auslassen/mocken) ggf.
  `jsdom` pro Datei.
- Scripts in `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`.
  **`tsc --noEmit` bleibt** der primäre Typ-Check; Tests treten daneben.
- Tests liegen neben dem Code (`lib/foo.test.ts`) oder in `tests/` — eine
  Konvention wählen und halten.

## Was getestet wird — vier Tiers nach Wirkung/Aufwand

**Tier 1 — Reine Logik (sofort, größter ROI):**
Normalisierer (Altbestand → aufgefüllt, defekte Eingaben → Defaults),
`split/join`-Round-Trips (byte-identisch, inkl. der `⊘ `-Aktiv-Markierung und
Nummern-Abstreifen), `scenarioRunParamsSchema` (feldweise `.catch`),
`kapitelSpanne`/`splitKapitelSegmente` (n Marker → n+1),
`safeFileName`/`imageExtension`. Reine Funktionen, keine Mocks.

**Tier 2 — Prompt-Invarianten (die „byte-identisch"-Garantien festnageln):**
- `buildScenarioPlotPrompt` / `buildStoryArcPrompt`: bei leerem
  `figuren`/`handlungselemente` **zeichengleich** zur Referenz (Snapshot).
- `buildStoryArcChaptersPrompt`: Segment-Modus vs. Nicht-Segment;
  Mindestlängen-Zeile mit `minZeichen`.
- `buildChapterTextPrompt`: Präteritum-Anforderung vorhanden; Werkform/Ton-
  Klausel; „frei"+neutral bleibt zeichengleich.
- `buildImagePrompt`: Gegenwarts-Prompt-Regression über die dokumentierten
  Kombinationen (`BILDWELTEN`), unbekannte Genre-Id → Gegenwart.
- `buildTextPrompt`: Wunschname (ein Wort → Nachname ergänzt; zwei Wörter →
  unverändert).
Snapshot-Tests (`toMatchInlineSnapshot`) sind hier ideal: Ändert jemand einen
Prompt versehentlich, schlägt der Test an.

**Tier 3 — Datenintegrität / Round-Trips (hätte den Backup-Bug gefangen):**
- `characterFile`/`scenarioFile`: `serialize → parse` erhält alle Felder; alte
  Dateien ohne neue Felder bleiben gültig.
- **Backup import/export** gegen eine **temporäre SQLite-Kopie** (das Muster,
  das beim Bau des additiven Imports verwendet wurde: `DATABASE_URL` auf eine
  Wegwerf-Kopie zeigen lassen — **nie** die echte `dev.db`): Replace erhält alle
  Szenario-Felder + `isProtagonist`; Additiv vergibt neue IDs, hängt Beziehungen
  um, lässt Einstellungen unberührt; Import weist falsches `kind`/zu neue
  Version/kaputte Datei ab.

**Tier 4 — Routen (später, mit Mocks):**
Die 34 Route-Handler lassen sich direkt importieren und mit einem gemockten
`getTextClient` (kein echter API-Aufruf, deterministische Antwort) aufrufen: 400
ohne Charaktere/Figuren, Umlaut-Retry, Mindestlängen-Retry, Segment-Deckelung.
**Harte Regel: keine echten OpenAI-/Gemini-Aufrufe in Tests** — Anbieter-Clients
werden gemockt; DB-Tests laufen auf Temp-Kopien.

## Leitplanken

- **Offline & deterministisch:** externe LLM-/Bild-Clients immer mocken; kein
  Netz, keine Kosten, keine Free-Tier-Verbrennung.
- **Nie die echte DB:** DB-Tests ausschließlich auf Temp-Kopien
  (`DATABASE_URL`-Redirect), mit Aufräumen — das „Vor dem Löschen sichern"-
  Prinzip gilt auch im Test.
- **Klein anfangen:** Tier 1+2 zuerst (ein Nachmittag, hoher Schutz), Tier 3 als
  Nächstes (fängt die teuren Bugs), Tier 4 nach Bedarf.

## Alternativen (bewusst nachgelagert)

Diese sind ebenfalls strukturell wertvoll, aber **riskanter ohne Testnetz** —
deshalb danach:

1. **`scenarios/[id]/page.tsx` zerlegen** (2701 Z / 58 `useState`): in
   Feature-Komponenten + Custom-Hooks (`useScenarioData`, `usePlotVarianten`,
   `useStoryArc`, `useRunParams`) aufteilen. Größter Lesbarkeits-/Wartungsgewinn,
   aber komplexe Modal-/State-Verflechtung → mit Tests im Rücken sicher.
2. **Text-Routen entdoppeln:** ein `generateStructured()`-Helfer (Prompt +
   Schema → Parse mit Umlaut-Wächter, Retry, Mindestlängen-Check) und ein
   `generateFreeText()`; die 7 Retry-Duplikate und die 19 `getTextClient`-
   Aufrufe verschlanken.
3. **Client-Datenschicht:** die wiederholte `fetch`+`useState`+optimistisch+
   Rollback-Mechanik (jede Einstellung, jede Seite) hinter geteilte Hooks bzw.
   eine kleine Query-Abstraktion legen.

Tests machen 1–3 erst gefahrlos — deshalb zuerst das Fundament.

## Verifikation / Rollout

1. Vitest + Config + `test`-Script hinzufügen; ein Trivialtest läuft grün
   (`npm test`).
2. Tier 1 schreiben → grün. Tier 2 (Snapshots) → grün. Tier 3 (Temp-DB-Harness)
   → grün, und **den bereits behobenen Backup-Bug als Regressionstest**
   festhalten.
3. `tsc --noEmit`, `npm run lint`, `npm test` alle grün. Optional später: ein
   CI-Schritt (GitHub Actions), der die drei bei jedem Push fährt.

## Neu anzulegen (repräsentativ)

`vitest.config.ts`, `test`-Scripts in `package.json`, DevDeps (`vitest`,
`vite-tsconfig-paths`, optional `@vitest/coverage-v8`); Tests wie
`lib/schema.test.ts`, `lib/storyHooks.test.ts`, `lib/scenarioRunParams.test.ts`,
`lib/prompts.test.ts`, `lib/characterFile.test.ts`, `lib/backup.test.ts`.
