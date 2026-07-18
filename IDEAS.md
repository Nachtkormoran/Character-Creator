# Ideen & mögliche Erweiterungen

Sammlung von Vorschlägen für nützliche oder interessante Ergänzungen rund um
die Charaktererstellung. Gegliedert nach Themenbereichen; Top-Empfehlungen
sind mit ⭐ markiert.

Stand: 18.07.2026 (nach der Mehrbild-Umstellung).

## Terminsache

- **`gpt-image-1` wird am 23.10.2026 eingestellt.** Bis dahin muss ein
  Nachfolger gewählt sein. Die Umstellung selbst ist nur eine Auswahl in den
  Einstellungen, aber der Bildlook ändert sich dabei – das will in Ruhe
  verglichen werden, nicht unter Zeitdruck. `gpt-image-1.5` und `gpt-image-2`
  stehen bereits zur Auswahl. **Achtung:** `gpt-image-2` unterstützt keine
  Referenzbilder.

## Top-3-Empfehlungen

Wenn nur drei umgesetzt würden, mit dem größten Nutzen:

1. **Text nachträglich anpassen / neu erzeugen** – der einzige Teil der
   KI-Ausgabe, der sich noch nicht überarbeiten lässt.
2. **Kosten wirklich messen statt schätzen** – s. u., kleiner Aufwand mit
   sofort sichtbarem Nutzen.
3. **Bilder vergleichen** – jetzt, wo es mehrere pro Charakter gibt: zwei
   Bilder nebeneinander statt nacheinander im Vollbild. Klein, aber genau der
   Moment, in dem man sich fürs Primärbild entscheidet.

## Inhaltliche Tiefe (Text / Merkmale)

- ⭐ **Text nachträglich anpassen / neu erzeugen** – aktuell lässt sich nur das
  Bild neu erzeugen. Nützlich: Beschreibung regenerieren oder gezielt
  nachschärfen („kürzer", „länger", „düsterer", „humorvoller"). Manuelles
  Editieren geht bereits, das Nachgenerieren per KI nicht.
- **Mehr strukturierte Felder** – z. B. Motivation/Ziele, Ängste, Geheimnisse,
  Eigenheiten/Sprechweise, Fähigkeiten. Optional als eigene Abschnitte.
  **Vorher lesen:** Neue Merkmale fehlen allen Bestandsdaten;
  `normalizeTraits` fängt das ab, die DB sollte trotzdem nachgezogen werden
  (s. Fallstricke in `CLAUDE.md`).
- **RPG-Werteblock** (für Spiele) – Attribute wie Stärke/Geschicklichkeit,
  Gesinnung, Ausrüstung/Inventar. Als eigener, abschaltbarer Bereich.
- **„Überrasch mich"** – komplett zufälliger Charakter per Klick.

## Bilder

- ⭐ **Bilder vergleichen** – s. Top-3.
- **Bilder sortieren / beschriften** – die Bilder-Ansicht zeigt sie nach Datum,
  neueste zuerst. Eine eigene Reihenfolge oder eine kurze Notiz je Bild („mit
  Narbe", „Variante Winter") würde bei mehr als einer Handvoll helfen.
- **Bild in einen anderen Charakter verschieben / kopieren** – heute hängt ein
  Bild fest an dem Charakter, für den es erzeugt wurde.
- **Mehrere Referenzbilder gleichzeitig** – die API erlaubt bis zu 16, die
  Oberfläche bietet bisher eines. Provider und Route nehmen bereits ein Array
  entgegen.
- **Dauerhafte Stilvorlage** – ein Referenzbild in den Einstellungen, das für
  *alle* Generierungen gilt, damit die ganze Sammlung denselben Look bekommt.
  Anders als das Referenzbild pro Bild wäre das eine echte Einstellung.
- **Bildformat wählbar** – Hochformat / Quadrat / Ganzkörper. Die Größe ist in
  `lib/imageProvider.ts` weiter fest auf `1024x1024`. Kleiner geht nicht
  (Modell-Minimum), die anderen beiden Formate kosten mehr (6,3 statt 4,2 ct).
- **Günstigerer Anbieter** – FLUX Schnell über Replicate läge bei ~0,3 ct/Bild
  statt 4,2. Völlig anderer Look und ein zweiter API-Key, aber
  `lib/imageProvider.ts` ist als Austauschpunkt dafür gebaut.

## Organisation & Workflow

- **Charakter duplizieren** – als Ausgangspunkt für Varianten.
- **Beziehungen zwischen Charakteren** – innerhalb eines Projekts verknüpfen
  (Familie, Rivale, Verbündeter), evtl. als kleine Beziehungsübersicht.
- **Projekt-/Gruppen-Kontext** – pro Gruppe ein gemeinsames Setting/Welt-
  beschreibung, das alle Charaktere dieses Projekts beeinflusst.
- **Route `/gallery` → `/characters`** – die Seite heißt inzwischen
  „Charaktere", die Adresse noch nicht. Kosmetik; bricht bestehende
  Lesezeichen.

## Export & Teilen

- **Export als JSON / Markdown** – PDF-Steckbrief und Bild-Export stehen, die
  maschinenlesbaren Formate fehlen noch. JSON wäre zudem die Voraussetzung für
  einen Charakter-Import (die Datenbank-Sicherung ersetzt alles, taugt also
  nicht zum Zusammenführen).
- **Einzelne Charaktere importieren** – Gegenstück zum JSON-Export, additiv
  statt ersetzend.
- **Ganze Gruppe exportieren** – z. B. alle Figuren eines Projekts als
  Sammel-PDF.

## Kosten & Betrieb

- ⭐ **Kosten wirklich messen statt schätzen** – die Einstellungen zeigen nur
  hinterlegte Richtwerte. Alle drei kostenpflichtigen Aufrufe liefern ihren
  Verbrauch (`usage`) bereits mit, er wird nur verworfen. Stufe 1: Ist-Kosten
  pro Aktion anzeigen (kein Schema nötig). Stufe 2: `UsageEvent`-Tabelle für
  Summen je Charakter/Projekt/Monat – zeigt auch, was verworfene Generierungen
  gekostet haben.
- **Günstigeres Modell für die Detail-Extraktion** – `lib/visualDetails.ts`
  nutzt `TEXT_MODEL`, also dasselbe teure Modell wie die Hauptgenerierung, für
  eine Aufgabe mit 120 Token Ausgabe. Ein eigenes `OPENAI_EXTRACT_MODEL` wäre
  ein Einzeiler.
- **Alte Sicherungskopien aufräumen** – jeder Datenbank-Import legt eine
  `.bak`-Datei neben `dev.db` (~12 MB), die niemand löscht.
- **Preisangaben pflegen** – `IMAGE_PRICES_USD` in `lib/schema.ts` ist eine
  Momentaufnahme mit Stand-Datum, keine lebende Quelle.

## Umgesetzt

- **Mehrere Bilder pro Charakter** – eigenes `CharacterImage`-Modell, eines
  davon primär. Die Bilder-Ansicht liegt als eigene Ebene über der
  Detailansicht und trägt die gesamte Bild-Bedienung; neu erzeugte oder
  hochgeladene Bilder werden automatisch primär.
- **Suche & Sortierung** – Volltext über Name, Texte und Merkmale
  (diakritika-tolerant, UND-verknüpft), Sortierung nach Datum und Name.
- **Referenzbild** – Stil-/Motivvorlage pro Generierung, läuft über
  `images.edit`. Gilt nur für die Sitzung. Wahlweise eine Datei oder ein
  anderes Bild desselben Charakters (eigene Schaltfläche in der
  Bilder-Ansicht).
- **Einstellungsbereich** – Bildmodell × Qualitätsstufe als Auswahlmatrix mit
  Preisangaben.
- **Datenbank-Sicherung** – Export und Import der kompletten SQLite-Datei.
- **Vollbild-Ansicht** – Klick aufs Portrait zeigt das Original (1024×1024).
- **Bild-Export** – Portrait als Datei herunterladen, immer im Original.
- **Thumbnails** – 640-px-WebP für die Anzeige; die Listen-Antwort schrumpfte
  dadurch von 14,7 MB auf 321 KB.
- **Bildstil „Skizze"** – vierter Stil, mit stilabhängigem Bildaufbau
  (ohne Umgebung).
- **Felder editierbar machen** – Name, Kurzbeschreibung, Beschreibung und alle
  Merkmale in beiden Ansichten.
- **Export als PDF-Steckbrief** – `app/components/CharacterPdf.tsx`.
- **Genre-Vorlagen** – `lib/templates.ts`, belegen das Setting-Feld vor.
- **Light/Dark-Umschalter** – Hell/Dunkel/System im Header.
- **Bild neu erzeugen / ersetzen / hochladen** – inkl. Herunterskalierung.
- **Gruppen / Projekte** – Zuordnung und Filterung.
