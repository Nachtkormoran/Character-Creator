# UI-Modernisierung „Modernes Atelier" — Fundament + Muster-Seite Galerie

Plandokument neben den übrigen (`VERCEL+SUPABASE.md`, `HOSTINGER_VPS.md`,
`HTML_CSS_JS.md`, `EXTERNAL_PICS.md`, `SETTINGS_IDEEN.md`). Erstellt mit den
Skills `frontend-design` und `ui-ux-pro-max`.

## Context

Die App funktioniert, sieht aber unfertig/generisch aus und hat spürbare
Qualitäts- und Konsistenzlücken. Belegt durch Codeanalyse:

- **Farbsystem = reines Graustufen-Duo.** `app/globals.css` definiert nur
  `--background`/`--foreground` (hell `#f7f7f8` / dunkel `#0d0d10`). Kein Akzent,
  keine semantischen Tokens → keine Markenidentität.
- **Kein Display-Font.** Nur Geist Sans/Mono (Next-Default). Für ein Werkzeug,
  das Prosa und „Bücher" erzeugt, fehlt jede typografische Persönlichkeit.
- **Keine geteilten UI-Primitives.** Kein `components/ui/`. Dieselben Inline-
  Muster wiederholen sich: `rounded-xl border …` (18 Dateien), Primär-Button
  `bg-foreground … text-background` (16), `border-black/10|white/10` (23),
  `backdrop-blur`-Modale (14). Jede Stiländerung müsste an dutzenden Stellen
  nachgezogen werden.
- **Emojis als Struktur-Icons** in ~13 Dateien (🎲 ✨ 📑 📖 🖼️ ➕ ⭐ 🔍 🧝 …) —
  plattform-inkonsistent, nicht token-/theme-steuerbar (verstößt gegen die
  „no-emoji-icons"-Profiregel).
- **Quality-Floor fehlt:** **0** Vorkommen von `focus-visible`, **0** von
  `prefers-reduced-motion`/`motion-reduce` in der gesamten App. Nav ohne
  Aktiv-Zustand; Emoji-Logo; kein Skip-Link; desktop-only Header.

**Gewähltes Vorgehen (mit dem Nutzer abgestimmt):** Richtung **„Modernes
Atelier"** (hell, warm-neutral, ein Tinten-Violett-Akzent, Display-Serif
*sparsam*), Icons auf **Lucide** umstellen, und **erst das Fundament + genau eine
Muster-Seite (Galerie)** bauen — zum Bewerten, bevor der Rest folgt. Das
Modell/DB/Prompt-Verhalten wird **nicht** angefasst; dies ist rein Präsentation.

Grundprinzip aus dem `frontend-design`-Skill: Die Boldness steckt in **einem**
Signature-Element (die Charakter-„Tafel"), alles drumherum bleibt ruhig und
diszipliniert. Bewusst **nicht** die drei generischen KI-Defaults (Cream+Serif+
Terracotta / Near-Black+Acid-Green / Broadsheet).

---

## 1. Token-Layer (`app/globals.css`)

Semantische Tokens für beide Themes einführen und über `@theme inline` als
Tailwind-Farben verfügbar machen (`bg-card`, `text-muted-foreground`,
`border-border`, `bg-primary`, `ring-ring` …). Ersetzt das ad-hoc
`black/10`-Geflecht.

**Palette — Modernes Atelier**

| Token | Light | Dark |
|---|---|---|
| `--background` | `#FAF9F6` (warmes Papier, kein Klischee-Cream) | `#16151A` |
| `--card` | `#FFFFFF` | `#1E1D24` |
| `--foreground` | `#1A1A1E` | `#ECECEE` |
| `--muted` | `#F0EFEA` | `#24232B` |
| `--muted-foreground` | `#6B6B72` | `#A0A0AC` |
| `--border` | `rgba(0,0,0,.09)` | `rgba(255,255,255,.10)` |
| `--primary` | `#5B4FC4` (Iris/Tinten-Violett) | `#8B80E8` (heller, entsättigt — `color-dark-mode`-Regel) |
| `--primary-foreground` | `#FFFFFF` | `#16151A` |
| `--ring` | `#5B4FC4` | `#8B80E8` |
| `--destructive` / `-foreground` | `#DC2626` / `#FFFFFF` | `#F87171` / `#16151A` |

- **Ein** Akzent (Primary). Kein zweiter Buntton außer `destructive`; alles
  andere ist neutral. Kontraste gegen AA (4.5:1) in **beiden** Themes prüfen.
- **Radius-Skala** konsolidieren (heute mischt sich `rounded-md`=6 / `rounded-xl`
  =12): `--radius-sm .375rem`, `--radius .625rem`, `--radius-lg .875rem`.
- **Elevation-Skala** (konsistent, weich — Atelier ist nicht schattenlastig):
  `--shadow-sm`, `--shadow-md`, `--shadow-lg` als 3 feste Stufen.
- **Motion-Tokens:** `--dur-fast 150ms`, `--dur 220ms`, `--ease-out
  cubic-bezier(.2,.8,.2,1)`; Enter = ease-out, Exit = ease-in; nur
  transform/opacity animieren. Global in `@media (prefers-reduced-motion:
  reduce)` neutralisieren — schließt die 0-Vorkommen-Lücke an einer Stelle.
- Dark-Mode-Mechanik (`.dark`-Klasse, `THEME_INIT_SCRIPT`,
  `suppressHydrationWarning`) **unverändert** lassen.

## 2. Typografie (`app/layout.tsx`)

- **Display-Serif `Fraunces`** via `next/font/google` als `--font-display`
  ergänzen (Geist Sans/Mono bleiben). Fraunces statt des generischen Playfair —
  eigenwilligere, modernere Serife.
- Einsatz **streng begrenzt** auf: Seitentitel (`h1`), Charakternamen,
  Werk-/Buchtitel. UI, Fließtext, Formulare bleiben Geist. Zahlen in
  Merkmals-/Datenspalten → `font-mono` + `tabular-nums` (`number-tabular`-Regel).
- Konsistente Type-Skala über die Primitives (Headings 600–700, Body 400,
  Labels 500).

## 3. Geteilte UI-Primitives (neu: `app/components/ui/`)

Token-getriebene Bausteine, die die wiederkehrenden Inline-Muster ersetzen. Klein
halten, nur was die Muster-Seite + Shell brauchen:

- **`Button.tsx`** — Varianten `primary|secondary|ghost|danger`, Größen `sm|md`,
  `loading`-State (Spinner, disabled). Ersetzt das `bg-foreground …
  text-background`-Muster (16 Dateien) und die `rounded-md border …`-Chips.
  `focus-visible:ring-2 ring-ring` eingebaut.
- **`IconButton.tsx`** — quadratisch, ≥40px Trefferfläche, `aria-label`
  Pflicht-Prop (für die Ex-Emoji-Icons ✕/✎/⭐ …).
- **`Card.tsx`** — ersetzt `rounded-xl border border-black/10 bg-white dark:…`
  (18 Dateien) → `bg-card border-border rounded-lg`.
- **`Badge.tsx` / `Chip`** — Merkmals-/Status-Pillen.
- **`Field.tsx`** — Label + Input/Textarea + Helper/Fehler (nutzt bestehende
  `AutoTextarea`), sichtbares Label statt Placeholder-only (`input-labels`).
- **`EmptyState.tsx`** und **`Skeleton.tsx`** — bislang gar nicht vorhanden;
  füllen `empty-states`/`progressive-loading`-Lücken.
- **`Modal.tsx` (Shell)** — nur die **Optik** (Panel `bg-card`, Scrim 40–60%
  schwarz, Enter/Exit-Motion aus den Tokens). **Wichtig:** die bestehende
  verschachtelte Modal-Logik NICHT ersetzen — `useBackdropClose`,
  `useOpenAtTop`, die Capture-Phase-Esc-Kette und die `z-50→z-80`-Ebenen aus
  `CharacterDetailModal.tsx` bleiben; die Shell wird nur eingesetzt, wo sie
  ohne Verhaltensänderung passt (Muster-Seite: das eine Detail-Modal).

## 4. Icons: Emoji → Lucide

- `lucide-react` als Dependency hinzufügen (`npm i lucide-react`).
- Dünne Wrapper-/Re-Export-Datei `app/components/ui/icons.ts` mit fester Größe
  (20/24) und Strichstärke (1.75) als Default → konsistente Optik
  (`icon-style-consistent`).
- Emoji→Icon-Mapping (Beispiele): 🎲→`Dice5`, ✨→`Sparkles`, 📑→`ListTree`,
  📖→`BookOpen`, 🖼️→`Image`, ➕→`Plus`, ⭐/☆→`Star`(fill/outline), 🔍→`Search`,
  ✕→`X`, ✎→`Pencil`, ⧉→`Copy`, 🏞️→`Mountain`, 📚→`Library`.
- Für die **Muster-Seite** nur deren Icons umstellen (Galerie + Detail-Modal +
  Shell). Logo 🧝 → schlichte SVG-Wortmarke/Glyphe im Header.
- Jedes Icon-only-Control bekommt `aria-label` (bisher tragen Emojis diese Rolle
  implizit).

## 5. App-Shell (`app/layout.tsx`)

- **Skip-Link** („Zum Inhalt") als erstes fokussierbares Element.
- **Nav mit Aktiv-Zustand** (`nav-state-active`): aktuelle Route farblich/gewicht
  + `aria-current="page"` (via `usePathname` in einer kleinen Client-Nav-
  Komponente).
- Header sticky mit dezentem `backdrop-blur` und `border-border`; Logo als
  SVG-Wortmarke.
- `main` erhält `id` (Skip-Link-Ziel) + `min-h-dvh`-Rhythmus; Grid-Seiten dürfen
  auf `max-w-6xl` gehen (mehr Luft für Karten), Rest bleibt `max-w-5xl`.
- `ThemeToggle` bleibt funktional, wird nur an die Tokens angepasst.

## 6. Muster-Seite: Galerie (`app/gallery/page.tsx` + geöffnetes Detail-Modal)

Vollständige Anwendung des Systems auf **eine** Seite, damit der Look bewertbar
ist, bevor er ausgerollt wird.

- **Signature-Element — die Charakter-„Tafel":** die Karten der Galerie als
  edle „Manuskript-/Sammelkarten-Platte": Portrait mit feinem Innen-Passepartout
  (dünne `border-border`-Matte), **Name in Fraunces**, 2–3 Kern-Merkmale als
  kleine `tabular-nums`-Chips, Haarlinie, ruhiger Hover-Lift (`translateY(-4px)`
  + `shadow-md`, `--dur`, reduced-motion-aus). Das ist das *eine* bewusst
  auffällige Element; alles andere bleibt zurückhaltend.
- Grid mit **gestaffeltem Reveal** (Stagger 30–50ms, nur ohne reduced-motion),
  `Skeleton`-Karten während des Ladens (statt Leerzustand/Sprung),
  `EmptyState` mit klarer Handlungsaufforderung, wenn keine Charaktere.
- Such-/Sortier-Leiste auf `Field`/`Button`; Bild via `next/image` mit
  `width/height`/`sizes` (CLS vermeiden) — Thumbnails sind bereits vorhanden.
- Das aus der Karte geöffnete **`CharacterDetailModal.tsx`** auf Tokens +
  Primitives + Lucide umstellen (Buttons, Chips, Icon-Buttons, `TraitsTable`),
  **ohne** die Modal-Ebenen-/Esc-Logik zu verändern.
- Quality-Floor auf dieser Seite vollständig: sichtbare Fokusringe, Tastatur-
  Durchlauf, AA-Kontrast hell/dunkel, `aria-label` an Icon-Buttons.

## Wiederverwenden (nicht neu bauen)

`useBackdropClose`, `useOpenAtTop`, `useAutoGrow`, `AutoTextarea`,
`ThemeToggle`, `THEME_INIT_SCRIPT` (`lib/theme.ts`), `next/font`, `next/image`,
`primaryImage()`/Thumbnails aus `lib/serialize.ts`. Die Dark-Mode-Klassenmechanik
und die Modal-Verschachtelung bleiben unangetastet.

## Zu erstellende / zu ändernde Dateien (repräsentativ)

- **Neu:** `app/components/ui/{Button,IconButton,Card,Badge,Field,EmptyState,Skeleton,Modal}.tsx`, `app/components/ui/icons.ts`.
- **Ändern:** `app/globals.css` (Tokens/Motion), `app/layout.tsx` (Font, Shell,
  Nav), `app/gallery/page.tsx`, `app/components/CharacterDetailModal.tsx`,
  `app/components/TraitsTable.tsx` (Merkmals-Chips/tabular).
- **Dependency:** `lucide-react` in `package.json`.

## Verifikation (End-to-End)

1. `npm i lucide-react` → `npm run dev`, `/gallery` öffnen.
2. `npx tsc --noEmit` **und** `npm run lint` grün (primärer Korrektheits-Check).
3. **Theme:** Hell/Dunkel umschalten; Token-Paare gegen AA prüfen (Text
   `foreground`/`muted-foreground` auf `background`/`card`; `primary-foreground`
   auf `primary`; `border` in beiden Themes sichtbar).
4. **Tastatur:** durch Galerie + Detail-Modal taben — überall sichtbarer
   `focus-visible`-Ring; Esc schließt das Modal (bestehende Logik unverändert).
5. **Reduced-Motion:** OS-Einstellung an → Hover-Lift/Reveal deaktiviert, Inhalt
   sofort lesbar.
6. **Responsiv:** Viewport 375px → Grid reflowt, **kein** horizontales Scrollen;
   Nav bedienbar.
7. Vorher/Nachher-Screenshot der Galerie zum Abgleich mit dieser Beschreibung.

## Bewusst später (nach Freigabe der Muster-Seite)

Ausrollen von Tokens/Primitives/Icons auf: `scenarios` + `scenarios/[id]`
(inkl. `StoryArcSection`, `ScenarioFields`), `library`, `settings`, das
Erstellen-Formular (`CharacterForm`) und die übrigen Modale. Diese bleiben in
diesem Schritt funktional unverändert im Alt-Stil, bis der Muster-Look abgenommen
ist.
