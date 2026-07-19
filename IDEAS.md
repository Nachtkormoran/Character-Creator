# Ideen & mögliche Erweiterungen

Sammlung von Vorschlägen für nützliche oder interessante Ergänzungen rund um
die Charaktererstellung. Gegliedert nach Themenbereichen; Top-Empfehlungen
sind mit ⭐ markiert.

Stand: 19.07.2026 (nach Würfeln, drei neuen Merkmalen und dem Charakter-
Export/Import).

## Terminsache

- **`gpt-image-1` wird am 23.10.2026 eingestellt.** Bis dahin muss ein
  Nachfolger gewählt sein. Die Umstellung selbst ist nur eine Auswahl in den
  Einstellungen, aber der Bildlook ändert sich dabei – das will in Ruhe
  verglichen werden, nicht unter Zeitdruck. `gpt-image-1.5` und `gpt-image-2`
  stehen bereits zur Auswahl. **Achtung:** `gpt-image-2` unterstützt keine
  Referenzbilder.

## Top-3-Empfehlungen

Wenn nur drei umgesetzt würden, mit dem größten Nutzen. Alle drei stehen
unverändert seit dem letzten Stand – dazwischen ist anderes passiert:

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
  **Der Weg ist inzwischen erprobt:** „Interessen und Hobbies", „Wohnort" und
  „Beruf" kamen so dazu – Feld in `characterTraitsSchema` mit `.describe()`,
  Eintrag in `TRAIT_LABELS`, fertig. Tabelle und PDF ziehen automatisch mit,
  und weil `traits` ein JSON-String ist, braucht es **keine Migration**.
  **Vorher lesen:** Neue Merkmale fehlen allen Bestandsdaten;
  `normalizeTraits` fängt das ab, die DB sollte trotzdem nachgezogen werden
  (s. Fallstricke in `CLAUDE.md`). Ein neues Merkmal wirkt außerdem **nicht**
  von selbst aufs Bild – `buildImagePrompt` zählt die Merkmale einzeln auf.
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

- **Charakter duplizieren** – als Ausgangspunkt für Varianten. Geht seit dem
  Charakter-Export **auf Umwegen** schon: exportieren und wieder importieren
  ergibt eine vollständige Kopie mit eigener Id. Ein Knopf in der Detailansicht
  wäre nur noch Bequemlichkeit (und könnte „(Kopie)" an den Namen hängen).
- **Beziehungen zwischen Charakteren** – innerhalb eines Projekts verknüpfen
  (Familie, Rivale, Verbündeter), evtl. als kleine Beziehungsübersicht.
  **Entwurf liegt vor:** `RELATIONS.md` – Datenmodell (eine Zeile je Beziehung,
  Umkehrung über eine Typtabelle), Kreis-Layout als SVG ohne Bibliothek,
  Vorschlag in zwei Schritten. Noch nicht umgesetzt.
- **Projekt-/Gruppen-Kontext** – pro Gruppe ein gemeinsames Setting/Welt-
  beschreibung, das alle Charaktere dieses Projekts beeinflusst.
- **Route `/gallery` → `/characters`** – die Seite heißt inzwischen
  „Charaktere", die Adresse noch nicht. Kosmetik; bricht bestehende
  Lesezeichen.

## Export & Teilen

- **Export als Markdown** – JSON und PDF stehen; ein lesbares Textformat für
  Notiz-Programme fehlt noch.
- **Ganze Gruppe exportieren** – z. B. alle Figuren eines Projekts als
  Sammel-PDF oder als mehrere Charakter-Dateien auf einmal. Das Dateiformat in
  `lib/characterFile.ts` ist auf **einen** Charakter je Datei ausgelegt; für
  eine Sammeldatei bräuchte es eine Version 2 (oder ein ZIP).

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
  `.bak`-Datei neben `dev.db` ab, die niemand löscht. Dazu kommen von Hand
  angelegte Kopien vor größeren Datenänderungen. **Stand 19.07.2026: fünf
  Dateien, zusammen rund 200 MB** – deutlich mehr als die Datenbank selbst
  (58 MB), weil jede Kopie sämtliche Bilder mitschleppt. Sie sind in
  `.gitignore`, liegen aber im Projektverzeichnis. Eine Aufräumhilfe in den
  Einstellungen (auflisten, einzeln löschen) oder schlicht ein Hinweis auf das
  Alter wäre schon genug.
- **Preisangaben pflegen** – `IMAGE_PRICES_USD` in `lib/schema.ts` ist eine
  Momentaufnahme mit Stand-Datum, keine lebende Quelle.

## Umgesetzt

- **Einzelne Charaktere exportieren/importieren** – eine JSON-Datei je
  Charakter (Texte, Merkmale, Vorgaben, alle Bilder im Original). Der Import
  ist **additiv** und legt immer neu an, im Gegensatz zur Datenbank-Sicherung.
  Export in der Fußzeile der Detailansicht, Import im Kopf der Galerie (mehrere
  Dateien auf einmal möglich).
- **Drei weitere Merkmale** – „Interessen und Hobbies", „Wohnort" und „Beruf",
  befüllt aus derselben Structured-Outputs-Antwort wie die übrigen. Die
  Bestandscharaktere wurden nachgetragen: aus dem Beschreibungstext, wo er den
  Wert nennt, sonst aus Wesen und Lebenslage erschlossen.
- **Vorgaben-Ansicht** – der Fußzeilen-Knopf „Vorgaben anzeigen" zeigt die
  Formular-Eingaben, aus denen der Charakter entstand. Reine Anzeige: die Werte
  protokollieren den Erstellungszeitpunkt und dürfen nicht von dem Text
  abweichen, der aus ihnen entstanden ist. Ein neues Feld war dafür nicht
  nötig – `Character.input` gibt es seit dem ersten Commit.
- **Würfel an fünf Formularfeldern** – Name, Aussehen, Persönlichkeit, Beruf
  und Hintergrund, alle **rein lokal ohne API**: der Knopf lebt davon, dass man
  ihn mehrmals drückt, und das verträgt keine Netzwerk-Wartezeit. Am Namen
  zusätzlich ein KI-Knopf für Vorgaben, für die es keine Liste gibt.
  – Namen: neun Kulturkreise à 200 (`names.ts`)
  – Berufe: 300, nach Genre markiert (`professions.ts`)
  – Aussehen: drei Listen à 100, nach Geschlecht getrennt (`inspiration.ts`)
  – Hintergründe: sechs Listen à 100, eine je Genre (`backgrounds.ts`)
- **Detailansicht umgeordnet** – breiter (`max-w-5xl`), Beschreibung und Bild
  über der Merkmalstabelle, Tabelle in kleinerer Schrift.
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
