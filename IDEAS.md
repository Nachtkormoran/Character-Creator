# Ideen & mögliche Erweiterungen

Sammlung von Vorschlägen für nützliche oder interessante Ergänzungen rund um
die Charaktererstellung. Gegliedert nach Themenbereichen; Top-Empfehlungen
sind mit ⭐ markiert.

Stand: 25.07.2026 (nach dem gesamten Szenario-Ausbau: gemeinsame Festlegungen,
Weltbild, Handlungsentwürfe mit Varianten, Story Arc mit Kapiteln und
Prosatext, Erzählform, Szenario-Export/Import – und Google Gemini als
umschaltbarer Text-Anbieter).

## Terminsache

- **`gpt-image-1` wird am 23.10.2026 eingestellt.** Bis dahin muss ein
  Nachfolger gewählt sein. Die Umstellung selbst ist nur eine Auswahl in den
  Einstellungen, aber der Bildlook ändert sich dabei – das will in Ruhe
  verglichen werden, nicht unter Zeitdruck. `gpt-image-1.5` und `gpt-image-2`
  stehen bereits zur Auswahl. **Achtung:** `gpt-image-2` unterstützt keine
  Referenzbilder (`images.edit`).

## Name der App

Die App heißt noch „Charakter Creator", macht aber längst mehr als Charaktere:
Sie hat drei Säulen – **Figuren**, **Welten** (Szenarien) und die
**Geschichten** dazwischen (Handlungsentwurf, Story Arc, Kapitel-Prosa). Ein
neuer Name sollte über allen dreien sitzen und am besten das Verbindende
betonen: das Erzählen.

**Favoriten:**

- ⭐ **Erzählwerk** – deckt Figur, Welt und Geschichte ab, klingt nach
  Werkzeug/Werkstatt („-werk"), schlank und modern.
- **Geschichtenschmiede** – warm und bildhaft: Aus Figuren und Welten wird eine
  Geschichte *geschmiedet*. Sofort verständlich.
- **Fabula** – lateinisch für „Geschichte"; kurz, brandbar, international, wenn
  es eher nach Produktname als nach Werkstatt klingen soll.

**Weitere Ideen:**

- *Bildhaft/deutsch:* Weltenweber (betont die Welt etwas mehr), Erzählatelier,
  Weltenschmiede, Fabelwerk
- *Nüchtern/beschreibend:* Figuren & Welten, Charaktere & Szenarien,
  Erzähl-Studio
- *Kurz/markig:* Narrativ, Ensemble (die „Besetzung" – lässt die Welt außen
  vor), Dramaturg (die App nennt sich in ihren Prompts schon so; trifft das
  *Strukturieren* gut, klingt aber weniger nach „erschaffen")

**Empfehlung:** **Erzählwerk**, wenn deutsch und nach Werkstatt; **Fabula** für
einen kurzen Produktnamen.

**Umfang der Umbenennung:** Der sichtbare Titel (Header, `<title>` in
`app/layout.tsx`, Seiten-Metadaten) ist schnell geändert. Ordner- und
Paketname (`charakter-creator`, Repo „Character-Creator") umzubenennen ist ein
größerer Eingriff (Git-Remote, evtl. Pfade) und sollte getrennt geschehen.

## Top-3-Empfehlungen

Wenn nur drei umgesetzt würden, mit dem größten Nutzen. Der bisherige Platz 1
(**Szenario-Kontext**) ist erledigt – an seine Stelle rückt die offene Lücke,
die er hinterlässt:

1. ⭐ **Szenario-Kontext rückwirkend** – die Festlegungen fließen nur in **neu
   erstellte** Charaktere ein. Wer einen bestehenden nachträglich einem Szenario
   zuordnet, ändert nichts an dessen Text; und „Text neu erzeugen" in der
   Galerie kennt das Szenario gar nicht. Jetzt, wo es den Weltkontext gibt, ist
   das die natürliche nächste Stufe: „Text neu erzeugen" die Festlegungen des
   zugeordneten Szenarios mitgeben.
2. ⭐ **Kosten wirklich messen statt schätzen** – kleiner Aufwand, sofort
   sichtbarer Nutzen. S. u. „Kosten & Betrieb".
3. ⭐ **Bilder vergleichen** – jetzt, wo es mehrere pro Charakter gibt: zwei
   Bilder nebeneinander statt nacheinander im Vollbild. Klein, aber genau der
   Moment, in dem man sich fürs Primärbild entscheidet.

## Inhaltliche Tiefe (Text / Merkmale)

- **Kurzbeschreibung mitziehen** – „Text neu erzeugen" schreibt nur den
  Fließtext neu; die Kurzbeschreibung darüber bleibt die alte und kann danach
  daneben liegen. Bewusst so zugeschnitten, aber einen Knopf wert.
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
- **„Überrasch mich"** – komplett zufälliger Charakter per Klick. Die Würfel
  liegen alle vor; es fehlt nur der Knopf, der sie auf einmal wirft.

## Bilder

- ⭐ **Bilder vergleichen** – s. Top-3.
- **Bilder sortieren / beschriften** – die Bilder-Ansicht zeigt sie nach Datum,
  neueste zuerst. Eine eigene Reihenfolge oder eine kurze Notiz je Bild („mit
  Narbe", „Variante Winter") würde bei mehr als einer Handvoll helfen.
- **Bild in einen anderen Charakter verschieben / kopieren** – heute hängt ein
  Bild fest an dem Charakter, für den es erzeugt wurde. (Einen **ganzen**
  Charakter samt Bildern zu klonen geht seit dem Szenario-Kopie-Knopf; ein
  einzelnes Bild umzuhängen noch nicht.)
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
- **Weltbild ins Charakter-PDF** – das Szenario hat inzwischen ein Weltbild und
  ist Teil der Szenario-Exportdatei, im Charakter-PDF fehlt es aber noch. Ein
  naheliegender Folgeschritt (in `CLAUDE.md` notiert).
- **Mehrere Bilder pro Szenario** – ein Szenario trägt heute genau **ein**
  Weltbild. Die Bild-Ansicht (`ScenarioImageModal`) ist bewusst so herausgezogen
  wie beim Charakter und wäre der Ort, an dem später eine Kachelgalerie
  entstünde – analog zu `CharacterImages`.

## Organisation & Workflow

- **Charakter duplizieren** – ein „(Kopie)"-Knopf in der Detailansicht der
  Galerie. Die Mechanik steht bereits: `POST /api/characters/[id]/clone`
  kopiert Charakter samt Bildern in einer Transaktion (gebaut für „Vorhandenen
  zu Szenario hinzufügen"). Es fehlt nur der Knopf am allgemeinen Ort.
- **Beziehungen zwischen Charakteren** – innerhalb eines Szenarios verknüpfen
  (Familie, Rivale, Verbündeter), evtl. als kleine Beziehungsübersicht.
  **Entwurf liegt vor:** `RELATIONS.md` – Datenmodell (eine Zeile je Beziehung,
  Umkehrung über eine Typtabelle), Kreis-Layout als SVG ohne Bibliothek,
  Vorschlag in zwei Schritten. Noch nicht umgesetzt. Der Handlungsentwurf
  betrachtet inzwischen mehrere Figuren zugleich – die Reibungsflächen, die er
  findet, wären das Material für solche Beziehungen.
- **Charakter mehreren Szenarien zuordnen** – das Datenmodell ist bewusst 1‑zu‑n
  (ein Charakter, höchstens ein Szenario). „Vorhandenen hinzufügen" löst das per
  **Kopie**, wenn eine Figur schon woanders liegt. Eine echte
  Mehrfachzuordnung (dieselbe Figur, geteilt) wäre eine n‑zu‑m-Umstellung mit
  Folgen für Export/Import – nur lohnend, wenn „teilen per Referenz" wirklich
  gebraucht wird.
- **Route `/gallery` → `/characters`** – die Seite heißt inzwischen
  „Charaktere", die Adresse noch nicht. Kosmetik; bricht bestehende
  Lesezeichen.

## Export & Teilen

- **Export als Markdown** – JSON und PDF stehen; ein lesbares Textformat für
  Notiz-Programme fehlt noch.
- **Sammel-PDF eines Szenarios** – die Szenario-Exportdatei bündelt inzwischen
  Welt **und** Besetzung als **JSON**. Ein lesbares Sammel-PDF (alle Figuren
  einer Welt in einem Dokument, evtl. mit Weltbild und Handlungsentwurf) fehlt
  noch – der Einzel-Steckbrief in `CharacterPdf.tsx` ist die Grundlage dafür.

## Kosten & Betrieb

- ⭐ **Kosten wirklich messen statt schätzen** – die Einstellungen zeigen nur
  hinterlegte Richtwerte. Die kostenpflichtigen Aufrufe liefern ihren
  Verbrauch (`usage`) bereits mit, er wird nur verworfen. Stufe 1: Ist-Kosten
  pro Aktion anzeigen (kein Schema nötig). Stufe 2: `UsageEvent`-Tabelle für
  Summen je Charakter/Szenario/Monat – zeigt auch, was verworfene Generierungen
  gekostet haben. (Mit den vielen neuen Szenario-Routen – Handlungsentwurf,
  Arc, Kapitel, Prosatext – lohnt das jetzt mehr als zuvor.)
- **Günstigeres Modell für die Detail-Extraktion** – `lib/visualDetails.ts`
  nutzt den Text-Client, also dasselbe Modell wie die Hauptgenerierung, für
  eine Aufgabe mit 120 Token Ausgabe. Seit **Gemini** umschaltbar ist, ließe
  sich hierfür gezielt ein günstiges/kostenloses Modell setzen.
- **Alte Sicherungskopien aufräumen** – jeder Datenbank-Import legt eine
  `.bak`-Datei neben `dev.db` ab, die niemand löscht. Dazu kommen von Hand
  angelegte Kopien vor größeren Datenänderungen. **Stand 25.07.2026: neun
  Dateien, zusammen rund 480 MB** – die Datenbank selbst ist inzwischen auf
  ~110 MB gewachsen, jede Kopie schleppt sämtliche Bilder mit. Sie sind in
  `.gitignore`, liegen aber im Projektverzeichnis. Eine Aufräumhilfe in den
  Einstellungen (auflisten, einzeln löschen) oder schlicht ein Hinweis auf das
  Alter wäre schon genug.
- **Preisangaben pflegen** – `IMAGE_PRICES_USD` in `lib/schema.ts` ist eine
  Momentaufnahme mit Stand-Datum, keine lebende Quelle.

## Umgesetzt

Neueste zuerst.

- **Szenario-Kontext (gemeinsame Festlegungen)** – der lange Top-1: pro Szenario
  Genre, Ort, Zeit, Regeln und eine Beschreibung, als JSON in `Scenario.details`
  (kein Feld = eine Migration). Ort/Zeit/Regeln haben je einen **Würfel** (nach
  Genre getrennte Listen) und lassen sich per KI **ergänzen** (nicht ersetzen);
  die Beschreibung wird aus den übrigen Feldern erzeugt. Beim „Charakter für
  dieses Szenario" fließt der Weltstand über `setting`/`notes` in die
  Generierung ein. (Rückwirkend noch offen – s. Top-3.)
- **Szenario-Weltbild** – genau **ein** Bild je Szenario: ein Establishing-Shot
  des Ortes **ohne Figuren**, aus den Festlegungen. Eigene Bild-Ansicht
  (`ScenarioImageModal`) mit Erzeugen/Hochladen/Kandidat-Übernehmen, wie die
  Bilder-Ansicht beim Charakter.
- **Handlungsentwurf mit mehreren Varianten** – aus Welt **und** zugeordneten
  Figuren (ihre Ansatzpunkte sind das Material). Jeder Lauf hängt eine neue
  Variante an (Reiter-Leiste); „weiterspinnen" macht daraus eine vollständige
  Geschichte, ein Zusatzwunsch steuert den Lauf, und auf Wunsch führt der
  Entwurf neue benannte Personen ein.
- **Story Arc mit Kapiteln und Prosatext** – dramaturgische Zerlegung des
  aktiven Entwurfs in Stationen (Fünfakter), ebenfalls in mehreren Varianten;
  je Station ableitbare Kapitel, je Kapitel ein ausformulierter Prosatext
  (Personen, Atmosphäre, Dialog). Folgekapitel schließen ohne erneute
  Einstimmung an.
- **Erzählform** – Krimi / Liebe / Abenteuer / Drama / Thriller als **dritte
  Achse** neben Genre (der Welt) und Ton (dem Wie); prägt Konflikt und Aufbau,
  nicht die Welt. Lauf-Parameter für Handlungsentwurf und Story Arc (samt
  Kapiteln), nach dem Muster von `STORY_TONES`.
- **Ton der Erzählung** – neutral bis leidenschaftlich/derb/explizit, geteilt
  von Handlungsentwurf, Arc und Kapiteln.
- **Personen aus dem Handlungsentwurf anlegen** – der Entwurf erfindet
  regelmäßig Nebenfiguren; ein Klick auf einen gefundenen Namen legt daraus
  einen Charakter an (Formular vorbelegt, dem Szenario zugeordnet).
- **Szenario aus einem Charakter ableiten** – die Gegenrichtung: aus einer
  fertigen Figur eine passende Welt vorschlagen (Structured Output in dieselbe
  `ScenarioFields`-Maske).
- **Szenario exportieren / importieren** – eine Welt samt Besetzung (wahlweise)
  als JSON-Datei; Import ist additiv und legt immer neu an. Enthält
  Festlegungen, alle Handlungsentwürfe, den Story Arc und das Weltbild.
- **Vorhandenen Charakter zu einem Szenario hinzufügen** – zeigt nur Figuren,
  die noch nicht darin sind; gehört eine schon zu einem anderen Szenario, wird
  auf Wunsch eine **Kopie** angelegt (`.../clone`, Charakter samt Bildern in
  einer Transaktion). Dazu ein Rückweg „← Zum Szenario" beim Erstellen.
- **Google Gemini als umschaltbarer Text-Anbieter** – kostenloses Kontingent
  über Google AI Studio, in den Einstellungen wählbar; das **Bild** läuft
  weiter immer über OpenAI. Derselbe OpenAI-SDK-Client, nur anderer `baseURL`.
- **Genre als gespeicherte Vorgabe** – die Genre-Wahl verfiel früher; sie wird
  jetzt in `input.genre` protokolliert, ist nachträglich änderbar und wird beim
  Szenario-Ableiten übernommen. Ebenso steht das **erzeugende Modell** in den
  Vorgaben.
- **Ansatzpunkte als Liste** – statt drei in einem Block hängt jeder Klick einen
  einzelnen an; „Bindung" (eng/mittel/frei) und „Richtung" steuern, wie nah am
  Charakter geblieben wird.
- **Suche & Sortierung** – Volltext (diakritika-tolerant, UND-verknüpft),
  Sortierung nach Datum und Name. Erst in der Charakterübersicht (über Name,
  Texte und Merkmale), inzwischen auch in der **Szenarienübersicht** (über Name
  und alle Festlegungen).
- **„Gruppe" heißt jetzt „Szenario"** – Oberfläche, Code und Datenbank
  (`Group` → `Scenario`, `groupId` → `scenarioId`). Der Name meint beides: die
  Auswahl von Personen für eine Geschichte **und** die Festlegungen, die für
  alle darin gelten.
- **Text neu erzeugen** – Knopf unter der Beschreibung in der Detailansicht,
  mit Feld für Zusatzwünsche (Stil, Perspektive, Schwerpunkt). Name und
  Merkmale bleiben unangetastet und gehen als Vorgabe in den Prompt.
- **Einzelne Charaktere exportieren/importieren** – eine JSON-Datei je
  Charakter (Texte, Merkmale, Vorgaben, alle Bilder im Original). Der Import
  ist **additiv** und legt immer neu an, im Gegensatz zur Datenbank-Sicherung.
- **Drei weitere Merkmale** – „Interessen und Hobbies", „Wohnort" und „Beruf",
  befüllt aus derselben Structured-Outputs-Antwort wie die übrigen.
- **Vorgaben-Ansicht** – der Fußzeilen-Knopf „Vorgaben anzeigen" zeigt die
  Formular-Eingaben, aus denen der Charakter entstand. Reine Anzeige: die Werte
  protokollieren den Erstellungszeitpunkt.
- **Würfel an fünf Formularfeldern** – Name, Aussehen, Persönlichkeit, Beruf
  und Hintergrund, alle **rein lokal ohne API**. Am Namen zusätzlich ein
  KI-Knopf für Vorgaben, für die es keine Liste gibt.
  – Namen: neun Kulturkreise à 200 (`names.ts`)
  – Berufe: 360, nach Genre markiert (`professions.ts`)
  – Aussehen: drei Listen à 100, nach Geschlecht getrennt (`inspiration.ts`)
  – Hintergründe: neun Listen à 100, eine je Genre (`backgrounds.ts`)
- **Detailansicht umgeordnet** – breiter (`max-w-5xl`), Beschreibung und Bild
  über der Merkmalstabelle, Tabelle in kleinerer Schrift.
- **Mehrere Bilder pro Charakter** – eigenes `CharacterImage`-Modell, eines
  davon primär. Die Bilder-Ansicht liegt als eigene Ebene über der
  Detailansicht und trägt die gesamte Bild-Bedienung.
- **Referenzbild** – Stil-/Motivvorlage pro Generierung, läuft über
  `images.edit`. Gilt nur für die Sitzung. Wahlweise eine Datei oder ein
  anderes Bild desselben Charakters.
- **Einstellungsbereich** – Bildmodell × Qualitätsstufe als Auswahlmatrix mit
  Preisangaben.
- **Datenbank-Sicherung** – Export und Import der kompletten SQLite-Datei.
- **Vollbild-Ansicht** – Klick aufs Portrait zeigt das Original (1024×1024).
- **Bild-Export** – Portrait als Datei herunterladen, immer im Original.
- **Thumbnails** – 640-px-WebP für die Anzeige; die Listen-Antwort schrumpfte
  dadurch drastisch.
- **Bildstil „Skizze"** – vierter Stil, mit stilabhängigem Bildaufbau
  (ohne Umgebung).
- **Felder editierbar machen** – Name, Kurzbeschreibung, Beschreibung und alle
  Merkmale in beiden Ansichten.
- **Export als PDF-Steckbrief** – `app/components/CharacterPdf.tsx`.
- **Genre-Vorlagen** – `lib/templates.ts`, belegen das Setting-Feld vor.
- **Light/Dark-Umschalter** – Hell/Dunkel/System im Header.
- **Bild neu erzeugen / ersetzen / hochladen** – inkl. Herunterskalierung.
- **Szenarien** – Zuordnung und Filterung.
