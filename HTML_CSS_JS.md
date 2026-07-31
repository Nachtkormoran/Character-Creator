# Umbauplan: Charakter Creator als reine HTML/CSS/JS-App

Gegenstück zu den Deployment-Plänen (`VERCEL+SUPABASE.md`, `VERCEL_MIGRATION.md`,
`HOSTINGER_VPS.md`), aber hier geht es nicht ums Hosten des bestehenden Stacks,
sondern um den **Umbau auf eine rein statische App** ohne Server, ohne Next.js.

---

## 0. Die harte Wahrheit zuerst: der API-Schlüssel

Eine rein statische Seite (nur HTML/CSS/JS, kein Server) **kann kein geteiltes
Geheimnis halten.** Heute liegt `OPENAI_API_KEY` ausschließlich serverseitig in
den API-Routen und erreicht den Browser nie. Fällt der Server weg, gibt es genau
zwei Modelle:

- **A — Eigener Schlüssel im Browser (empfohlen für Selbst-/Einzelnutzung):** Der
  Nutzer trägt seinen OpenAI-/Gemini-Key in ein Einstellungsfeld ein, er wird in
  IndexedDB/localStorage gespeichert, und der Browser ruft OpenAI/Gemini
  **direkt** auf. Der Key gehört dem Nutzer, liegt nur in seinem Browser — für
  ein persönliches Werkzeug völlig okay. Für eine **öffentliche** Seite untauglich
  (jeder Besucher bräuchte einen eigenen Key, oder deiner läge offen).
- **B — Ein winziger Proxy bleibt:** Eine einzige serverlose Funktion (z. B.
  Cloudflare Worker, Netlify/Vercel Function), die nur den Key anhängt und
  weiterleitet. Dann ist es **nicht mehr 100 % statisch**, aber 99 % — und du
  kannst es öffentlich betreiben.

**Zusatzrisiko CORS:** Direkte Browser-Aufrufe hängen davon ab, ob der Anbieter
CORS erlaubt. OpenAI lässt Browser-Aufrufe mit API-Key grundsätzlich zu (der SDK
kennt `dangerouslyAllowBrowser: true`); bei Geminis OpenAI-kompatiblem Endpunkt
ist das **vorab zu verifizieren**. Blockt ein Anbieter Browser-CORS, ist er nur
über Modell B (Proxy) erreichbar.

> Der Rest des Plans nimmt **Modell A** an (echte statische App). Wo Modell B
> nötig wäre, ist es vermerkt.

---

## 1. Was „nur HTML/CSS/JS" konkret heißt — drei Auslegungen

Das bestimmt den Aufwand mehr als alles andere. Von wenig zu viel Arbeit:

| Option | Was bleibt | „Nur HTML/CSS/JS"? | Aufwand |
|---|---|---|---|
| **1 — Vite + React-SPA** | React-Komponenten bleiben, nur Next.js fällt weg; einmaliger Build erzeugt statische Dateien | Als **ausgeliefertes Ergebnis** ja (statisches HTML/CSS/JS), im Quelltext weiter React | **gering** |
| **2 — No-Build + leichte ESM-Lib** | Kein Bundler; ES-Module direkt im Browser, kleine Lib (Preact+htm / Alpine / lit) per CDN/vendored | Ja, im engeren Sinn | **mittel** |
| **3 — Vanilla DOM, kein Framework** | Reines `document.createElement`, kein Framework | Ja, im strengsten Sinn | **hoch** |

**Einordnung:** Wenn das eigentliche Ziel „auf billigem, statischem Webspace
laufen" ist (Strato/Hostinger Shared, GitHub Pages …), erreicht **Option 1** das
mit **weitaus geringstem Aufwand** — die gesamte, teuer gebaute UI (alle Modals,
`CharacterDetailModal`, `StoryArcSection` …) bleibt erhalten, es fällt nur der
Next-Server weg. „Komplett nur HTML/CSS/JS" im *wortwörtlichen* Sinn (kein React
im Quelltext) ist erst Option 2/3 — und bedeutet, praktisch die **gesamte
Oberfläche neu zu schreiben**.

Der Plan unten beschreibt den vollständigen Umbau (Option 2/3) und markiert, was
bei Option 1 entfällt.

---

## 2. Was erhalten bleibt — der große Gewinn

Die **wertvolle Fachlogik ist schon heute framework- und serverunabhängig** und
portiert nahezu 1:1 nach reinem JS:

- **Prompt-Bau & Schemas:** `lib/prompts.ts`, `lib/schema.ts` (Zod-Schemas,
  Labels, `IMAGE_STYLES`, `BILDWELTEN`, `WERKFORMEN`, `STORY_FORMS/TONES` …).
- **Würfel & Daten:** `names.ts`, `backgrounds.ts`, `professions.ts`,
  `templates.ts`, `inspiration.ts`, `scenarioPlaces/Times/Rules/Figures.ts`,
  `storyHooks.ts`, `figuren.ts`.
- **Schon browser-only:** `image.ts` (Canvas-Thumbnails, Referenzbilder),
  `download.ts`.
- **Datei-Formate:** `characterFile.ts`, `scenarioFile.ts` — Export/Import sind
  **bereits** client-seitig gebaute JSON-Dateien. Das ist im statischen Modell
  Gold wert (s. Datenschicht).

Diese Module haben keine Server-Abhängigkeit; sie werden zu `.js`-Modulen
(Option 2/3) bzw. bleiben unverändert (Option 1).

---

## 3. Was ersetzt werden muss — der Kern des Umbaus

### 3.1 Server-API-Routen → direkte Browser-Aufrufe
Jede Route unter `app/api/*` (`generate-text`, `generate-image`,
`scenario-plot`, `scenario-arc`, `story-arc-chapters`, `story-chapter-text`,
`story-title`, `scenario-from-character`, `scenario-plot-persons`,
`random-scenario`, `regenerate-text`, `generate-name`, `generate-input-field`,
`visual-details`, `scenario-description/field/figures`, `story-hooks`,
`scenario-image` …) wird zu einer **Client-Funktion**, die:
1. mit den (portierten) `prompts.ts`-Bausteinen den Prompt baut,
2. per `fetch` bzw. OpenAI-JS-SDK (`dangerouslyAllowBrowser: true`) OpenAI/Gemini
   aufruft — der Key kommt aus den Einstellungen,
3. Structured Outputs **im Browser** verarbeitet (`chat.completions.parse` +
   `zodResponseFormat` läuft auch client-seitig; Zod ist reines JS),
4. die serverseitigen Absicherungen mitnimmt, die heute in den Routen stecken:
   der **Umlaut-Wächter** (`hatKaputteZeichen`, rekursiv) und die
   **Wiederhol-/Mindestlängen-Logik** (`MIN_STUFE_LEN`, `MIN_KAPITEL_LEN`), die
   **Gemini-Sonderbehandlung** (`reasoning_effort: "minimal"` via `extraParams`)
   — all das ist reine Logik und wandert in die Client-API-Schicht.

`getTextClient()`/`getOpenAI()`/`imageProvider.ts` werden zu einer
client-seitigen `api.js` mit derselben Anbieter-Auflösung (OpenAI vs. Gemini,
Modell-je-Erzeugung).

> **Referenzbilder** laufen heute über `images.edit`; das bleibt ein direkter
> Aufruf, unverändert in der Logik.

### 3.2 Prisma/SQLite → IndexedDB
- **IndexedDB, nicht localStorage:** Bilder sind ~2 MB pro Stück; localStorage
  (~5 MB gesamt) reicht nicht. IndexedDB trägt große Objekte und viele davon.
- **Bilder als `Blob` statt Base64** speichern (spart ~33 % Platz und Speicher;
  `URL.createObjectURL` fürs Anzeigen). Die heutige Zwei-Größen-Logik (Original +
  640-px-Thumbnail) bleibt.
- **Object Stores:** `characters`, `characterImages`, `scenarios`,
  `scenarioImages`, `settings`. Die Beziehungen (Charakter→Szenario `SetNull`,
  Bilder→Eltern `Cascade`, „genau ein `isPrimary`") werden in der Datenschicht
  nachgebildet — genau die Regeln, die heute in `characterImages.ts`/
  `scenarioImages.ts` in Transaktionen liegen. IndexedDB-Transaktionen können das.
- Eine **Datenzugriffsschicht** (`data.js`) ersetzt `lib/client.ts` **und**
  Prisma zugleich; die `serialize.ts`-Formen (`StoredCharacter`,
  `StoredScenario`, `primaryImage()`, `normalizeTraits`/`normalizeMetaList` …)
  bleiben als reine JS-Helfer.

### 3.3 Backup & „Datenübernahme aus der bestehenden App"
- Das **App-Backup** (`backup.ts`, `VACUUM INTO`) entfällt. An seine Stelle tritt
  „**gesamte IndexedDB als eine JSON-Datei exportieren / importieren (ersetzt
  alles)**" — konzeptgleich, nur gegen IndexedDB statt SQLite.
- **Migration deiner heutigen Daten:** In der alten App einmal ein Voll-Backup /
  Szenario- und Charakter-Exporte ziehen und in der neuen statischen App
  importieren. Weil die Export-/Import-Formate schon existieren und stabil sind
  (`kind`+`version`), ist das der saubere Brückenweg — kein DB-Dump nötig.

### 3.4 Next App Router → Client-Routing
- Sechs Seiten (`/`, `/gallery`, `/scenarios`, `/scenarios/[id]`, `/settings`,
  `/library`) werden zu **einer SPA** mit History-/Hash-Routing
  (`/#/scenarios/<id>`), oder zu mehreren `.html`-Dateien. Für statische Hoster
  ist **Hash-Routing** am robustesten (kein Server-Rewrite nötig).
- `useSearchParams`-Fälle (`/?scenario=<id>`, `sessionStorage`-Übergabe bei
  „Person aus Entwurf") werden zu normaler URL-/Storage-Logik.

### 3.5 React-Komponenten → Vanilla/No-Build *(entfällt bei Option 1)*
Der größte Posten. Alle Komponenten in `app/components/` und die Seiten
(`CharacterForm`, `CharacterDetailModal` + verschachtelte Modals,
`StoryArcSection`, `ScenarioFields`, `ReferenceImagePicker`, `StoryReaderModal`,
`AutoTextarea`, `ThemeToggle`, `CharacterInputModal`,
`AddCharacterToScenarioModal`, `ScenarioFromCharacterModal`, `PlotPersonModal`,
`ScenarioImageModal`, `CharacterImagesModal` …) werden in Vanilla-DOM oder eine
No-Build-Lib überführt. Die knifflige **Modal-Ebenen-Logik** (`useBackdropClose`,
`useOpenAtTop`, Capture-Phase-Esc, `z-50→z-80`) muss dabei bewusst nachgebaut
werden — sie hängt heute an React-Hooks, ist aber im Kern reine DOM-Ereignislogik.

### 3.6 PDF-Export: `@react-pdf/renderer` → Alternative *(betrifft alle Optionen, wenn React fällt)*
`CharacterPdf.tsx` nutzt React-PDF. Ohne React: **jsPDF** oder **pdf-lib** (beide
Vanilla-JS), oder ganz ohne Lib eine **Druck-CSS-Lösung** (`@media print` +
„Als PDF drucken"). Das ist eine echte, eigenständige Neubau-Aufgabe
(Layout-Parität).

### 3.7 Tailwind-Build → statische CSS
Tailwind v4 läuft heute über PostCSS beim Build. Drei Wege ohne Server-Build:
- **Einmal vorkompilieren** zu einer statischen `styles.css` und ausliefern
  (behält alle bestehenden Klassen, kein Build zur Laufzeit) — **empfohlen**.
- **Play-CDN** (Tailwind-JS generiert im Browser) — bequem, aber nicht für
  Produktion gedacht.
- **Plain-CSS** von Hand — größter Aufwand.
- **Dark Mode** (klassenbasiert, Inline-Skript + `localStorage`) portiert
  unverändert.

---

## 4. Vorgeschlagene Zielarchitektur (Dateien)

```
/index.html            – App-Shell, lädt <script type="module" src="js/app.js">
/css/styles.css        – einmal vorkompiliertes Tailwind (oder Plain-CSS)
/js/
  app.js               – Router, App-Bootstrap
  data.js              – IndexedDB-Schicht (ersetzt Prisma + client.ts)
  api.js               – OpenAI/Gemini-Aufrufe + Key-/Anbieter-Auflösung
  prompts.js           – portiert aus lib/prompts.ts
  schema.js            – Zod-Schemas/Labels/Konstanten aus lib/schema.ts
  dice/                – names/backgrounds/professions/… (portiert)
  serialize.js, storyHooks.js, figuren.js, image.js, download.js
  ui/                  – Seiten & Komponenten (Vanilla/Preact) *(entfällt b. Option 1)*
/vendor/               – zod, openai-sdk, ggf. preact/htm (vendored o. CDN)
/assets/
```

---

## 5. Phasen / empfohlene Reihenfolge

1. **Logik-Kernel isolieren.** `prompts`, `schema`, alle Würfel/Daten,
   `serialize`, `storyHooks`, `figuren`, `image`, `download` als reine
   JS-Module lauffähig machen (die verlieren nur die Server-/React-Umgebung,
   nicht die Logik). Klein testbar.
2. **Datenschicht (IndexedDB).** `data.js` mit Object Stores + `isPrimary`-Regel
   + Cascade/SetNull; Import bestehender Export-JSONs → sofort echte Daten zum
   Entwickeln.
3. **API-Schicht.** `api.js`: Key-Verwaltung, Anbieter-Auflösung, Structured
   Outputs, Umlaut-Wächter & Retry, Gemini-`extraParams`. Erst **eine**
   Erzeugung (z. B. `generate-text`) end-to-end, dann die übrigen nach dem
   Muster.
4. **Oberfläche, Seite für Seite** *(bei Option 1: nur Next→Vite-SPA +
   Datenschicht/API tauschen)*: Erstellen → Galerie → Szenario-Detail →
   Story-Arc/Reader → Bibliothek → Einstellungen. Modal-Ebenen-Logik früh
   einmal sauber lösen, dann wiederverwenden.
5. **Feinschliff:** PDF-Ersatz, Tailwind→statische CSS, Backup-Export/-Import,
   Dark Mode, gpt-image-1-Hinweis.

---

## 6. Risiken / offene Punkte

- **Schlüssel-Sicherheit / Modell A vs. B** — die Grundsatzentscheidung
  (Abschnitt 0). Öffentlich ⇒ Proxy nötig.
- **CORS je Anbieter** — vorab prüfen, besonders Gemini-OpenAI-Endpunkt.
- **IndexedDB-Quota** — Browser können Speicher unter Druck räumen; bei vielen
  2-MB-Bildern relevant. Gegenmittel: Blobs statt Base64,
  `navigator.storage.persist()`, regelmäßiger Export als „echtes" Backup.
- **Verlust der TypeScript-Typen** (Option 2/3) — heute ist `tsc --noEmit` der
  primäre Korrektheits-Check. Ohne Build entfällt er; abmildern mit JSDoc-Typen
  oder einem *optionalen* einmaligen `tsc`-Check nur zur Entwicklung.
- **PDF-Parität** — Neubau ohne React-PDF ist Aufwand mit ungewissem
  Pixel-Ergebnis.
- **`gpt-image-1`** braucht weiterhin eine verifizierte OpenAI-Organisation —
  unabhängig vom Umbau.
- **Umfang.** Fachlogik überlebt; **Datenschicht, API-Schicht und die komplette
  UI** sind ein Neubau. Option 1 halbiert das (UI bleibt), erfüllt „nur
  HTML/CSS/JS" aber nur im Sinne des ausgelieferten Ergebnisses.

---

## 7. Empfehlung

- **Wenn das Ziel „billiger statischer Hoster, kein Serverbetrieb" ist:**
  **Option 1 (Vite + React-SPA)** + IndexedDB + eigener Key. Kleinster Aufwand,
  statisches Ergebnis, du behältst die ganze UI. Streng genommen nicht „vanilla",
  aber der pragmatische Sieger.
- **Wenn „komplett ohne React/Framework" ein echtes Ziel ist:** **Option 2
  (No-Build ESM + Preact/htm)** — nah an „nur HTML/CSS/JS", ohne die volle
  Vanilla-Handarbeit von Option 3.
- **In beiden Fällen** ist die Reihenfolge oben gleich (Kernel → Daten → API →
  UI), und der Schlüssel-Punkt (Abschnitt 0) entscheidet über öffentlich vs.
  privat.

---

## 8. Zwei offene Entscheidungen (bevor der Plan konkret wird)

1. **Öffentlich oder privat?** → bestimmt Modell A (eigener Key, echt statisch)
   vs. B (winziger Proxy).
2. **„Nur HTML/CSS/JS" wie streng?** → Option 1 (React-SPA, wenig Arbeit) vs.
   2/3 (kein Framework, UI-Neubau).
