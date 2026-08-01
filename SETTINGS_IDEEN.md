# Plan: Was noch in den Einstellungen geregelt werden könnte

Ideen-/Roadmap-Dokument neben den übrigen Plänen (`VERCEL+SUPABASE.md`,
`HOSTINGER_VPS.md`, `HTML_CSS_JS.md`, `EXTERNAL_PICS.md`).

## Aktueller Stand der Einstellungen

Heute regelt die Einstellungsseite:
- **Textmodell** (`textProvider`: OpenAI / Gemini)
- **Modell je Story-Erzeugung** (`useModelOverrides` + `storyModels`) sowie
  „Verwendetes Modell anzeigen" (`showModel`)
- **Bildmodell & Qualität** (`imageModel`, `imageQuality`)
- **Sicherung** (Export/Import der DB, inkl. Option „Bild-Originale
  mitexportieren")

---

## Rahmen (wie neue Einstellungen entstehen)

Die `Setting`-Tabelle ist **Key-Value**, Vorrang **gespeichert → Env → Default**.
Jede neue Einstellung kostet daher **keine Migration**, sondern folgt dem Muster
von `imageModel`/`showModel`: eine Key-Konstante, eine Parse-/Allowlist-Prüfung,
die Auflösungsreihenfolge und ein Zweig in `updateSettings` (bei Booleans mit dem
`!== undefined`-Check, sonst verschluckt `if (patch.x)` den Wert `false`).

**Ein Leitprinzip vorab** — die App trennt bewusst dreierlei, und jede Idee unten
gehört in genau einen Topf:
- **App-weite Einstellung** (→ DB/`Setting`): gilt überall, z. B. Anbieter,
  Standardwerte.
- **Reiner Client-Wunsch** (→ `localStorage`, wie das Theme heute): betrifft nur
  die Ansicht.
- **Lauf-Parameter** (Ton, Erzählform, kreativ, Werkform, Bindung …): gehören
  **an den Ort der Erzeugung**, nicht global. Was hier in die Einstellungen darf,
  ist nur ihr **Startwert** (Vorbelegung), nie der erzwungene Wert.

---

## A. Standard-Vorgaben für die Erzeugung *(billig, folgt Muster — höchster Alltagsnutzen)*

Vorbelegungen, die heute fest verdrahtet oder bei jedem Lauf neu einzustellen
sind. Sie speichern nur den **Startwert**, den man pro Lauf weiter ändern kann:
- **Standard-Genre** (Charakter-Formular & Szenario) — heute hart „Gegenwart".
- **Standard-Bildstil** (`IMAGE_STYLES`) für neue Bilder.
- **Story-Arc-Defaults:** Werkform, Kapitellänge, Kapitelzahl, Erzählform, Ton,
  „kreativ".
- **Standard-Bindung** (`STORY_HOOK_ANCHORS`) fürs Ableiten.
- **Standard „ohne Menschen"** beim Weltbild, **Standard „mit Bild/Bilder"** beim
  Export.

Alle haben bereits Allowlists (`IMAGE_STYLES`, `WERKFORMEN`, `STORY_FORMS/TONES`,
`KAPITEL_COUNTS`, `KAPITEL_LAENGEN`), also direkt als Parse nutzbar.

## B. Länge & Qualität der Texterzeugung *(billig bis mittel)*

Schwellen, die heute im Code stehen — zuletzt wurde eine davon (600 → 450) per
Hand geändert:
- **Mindestlänge Station** (`MIN_STUFE_LEN`, 700) und **Kapitel-Zusammenfassung**
  (`MIN_KAPITEL_LEN`, 450) als Zahlwert. Erspart künftige Code-Änderungen.
- **Temperatur** / `reasoning_effort` je Erzeugung *(fortgeschritten, optional)*.

## C. Sprache & Erzählstil *(Zeitform billig, Sprache groß)*

- **Zeitform Präteritum/Präsens** — die natürliche Verallgemeinerung der gerade
  eingebauten Präteritum-Regel; ein Prompt-Baustein, billig.
- **Erzählsprache** (heute überall „auf Deutsch" fest in den Prompts). Hoher
  Nutzen, aber **großes Vorhaben**: berührt alle Prompt-Bausteine
  (`buildTextPrompt`, alle Story-Prompts). Als eigenes Projekt einplanen.

## D. Bilder & Speicher *(Thumbnail billig, Rest hängt an Features)*

- **Thumbnail-Größe/-Qualität** (heute 640 px, WebP 0.85 in `lib/image.ts`) —
  Kompromiss Platz ↔ Schärfe.
- **Auto-Kompression** Portrait PNG → JPEG an/aus (der „Quick Win" aus
  `VERCEL+SUPABASE.md`/`EXTERNAL_PICS.md`) — senkt DB-Größe stark.
- **Bild-Auslagerung** (sobald `EXTERNAL_PICS.md` umgesetzt): Speicherziel/
  `IMAGE_DIR`-Status, GC-Knopf.

## E. Daten & Wartung — ein Diagnose-/Aufräum-Bereich *(billig bis mittel)*

- **DB-Statistik** (read-only): Dateigröße, Anzahl Charaktere/Szenarien/Bilder,
  Anteil der Bild-Daten. Beantwortet „warum ist die DB so groß?".
- **Verwaiste Sicherheitskopien aufräumen**: die `dev.db.vor-import-*.bak` neben
  der DB auflisten und löschen (der Import legt sie an, niemand räumt sie weg).
- **Import-Modus**: „ersetzen" (heute) vs. „additiv zusammenführen" als Wahl.

## F. Kosten & Nutzung *(Anzeige-Toggle billig, Zählung mittel)*

- **Kostenschätzung anzeigen** je Erzeugung — `IMAGE_PRICES_USD` existiert schon
  als Anzeige-Hilfe; ein Toggle wie `showModel`, evtl. auch Text-Token-Kosten.
- **Budget-Warnung / Nutzungszähler** (Sitzung/Tag) — größer, braucht
  serverseitige Zählung.

## G. Anbieter & Schlüssel *(Modell-IDs billig, Keys mittel + Sicherheit)*

- **Gemini-Textmodell wählen** (heute nur Env `GEMINI_TEXT_MODEL`) — als Auswahl,
  weil daran das Free-Tier-Kontingent hängt (s. Fallstricke in CLAUDE.md).
- **Eigene Modell-IDs** je Anbieter (Text/Bild) als Freitext — Escape-Hatch,
  heute nur über Env.
- **Bild-Anbieter wählen** — `imageProvider.ts` abstrahiert das schon; sobald ein
  zweiter (Flux/Replicate) existiert, Auswahl analog zu `textProvider`.
- **API-Schlüssel in der UI hinterlegen** (OpenAI/Gemini) statt nur `.env` —
  großer Komfort fürs Deployment (VPS/statisch). **Sicherheits-Auflage:** Keys
  bleiben serverseitig (in `Setting`), werden **nie** an den Client
  zurückgegeben; die UI zeigt nur „gesetzt / nicht gesetzt". Ties in die
  Deployment-Pläne.

## H. Oberfläche / Verhalten *(billig, teils reiner Client-Wunsch)*

- **Theme** (hell/dunkel/system) — existiert als `ThemeToggle` in `localStorage`;
  könnte in der Einstellungsseite gespiegelt werden (Konsistenz), muss aber nicht
  in die DB.
- **Standard-Sortierung** von Galerie/Szenarien (Name/Datum).
- **Lösch-Bestätigungen** an/aus.
- **Startseite** nach dem Öffnen (Erstellen/Galerie/Szenarien).

Diese gehören eher in `localStorage` (reine Ansicht) als in die DB — außer man
will sie geräteübergreifend.

## I. Sicherheit / Zugriff *(groß, relevant fürs Deployment)*

- **Passwort-/Zugriffsschutz** — verknüpft mit `HOSTINGER_VPS.md` (Phase 7) und
  `HTML_CSS_JS.md`. Ein einfaches, gehashtes Passwort-Gate. Größeres Thema
  (Auth), aber Voraussetzung für jeden öffentlichen Betrieb, weil heute jeder mit
  URL OpenAI-Geld verbrennen kann.

---

## Empfohlene Reihenfolge (Nutzen ÷ Aufwand)

1. **A — Standard-Vorgaben** (Genre, Bildstil, Story-Arc-Defaults): billig, spart
   bei jeder Erzeugung Klicks.
2. **B — Mindestlängen** (Station/Kapitel) als Zahl: zuletzt im Code getunt — das
   gehört in die UI.
3. **C — Zeitform-Umschalter**: kleine Verallgemeinerung der frischen
   Präteritum-Regel.
4. **E — DB-Statistik + `.bak` aufräumen**: beantwortet echte Fragen, rein
   additiv.
5. **F — Kostenschätzung-Toggle**: `IMAGE_PRICES_USD` ist schon da.
6. **Später/größer:** G (API-Keys in UI), C (Sprache), D
   (Bild-Auslagerung-Settings), I (Zugriffsschutz).

Alle Punkte aus A/B/C/E/F folgen dem bestehenden `Setting`-Muster (Key, Parse,
Vorrang, `updateSettings`) und brauchen **keine Migration**.
