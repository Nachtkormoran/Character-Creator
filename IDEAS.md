# Ideen & mögliche Erweiterungen

Sammlung von Vorschlägen für nützliche oder interessante Ergänzungen rund um
die Charaktererstellung. Gegliedert nach Themenbereichen; Top-Empfehlungen
sind mit ⭐ markiert.

Stand: 18.07.2026.

## Top-3-Empfehlungen

Wenn nur drei umgesetzt würden, mit dem größten Nutzen:

1. **Suche & Sortierung in der Galerie** – die Galerie lädt aktuell alle
   Charaktere samt Base64-Bildern in einem Rutsch. Mit wachsender Sammlung
   wird das sowohl unübersichtlich als auch spürbar langsam; ein Grund, das
   vor den Bild-Features anzugehen.
2. **Mehrere Bilder pro Charakter** – Upload-, Ersetzen- und Data-URL-Logik
   stehen bereits, es fehlt im Kern das Datenmodell (eigenes `Image`-Modell
   statt des einzelnen `imageData`-Feldes → Prisma-Migration).
3. **Text nachträglich anpassen / neu erzeugen** – der einzige Teil der
   KI-Ausgabe, der sich noch nicht überarbeiten lässt.

## Inhaltliche Tiefe (Text / Merkmale)

- ⭐ **Text nachträglich anpassen / neu erzeugen** – aktuell lässt sich nur das
  Bild neu erzeugen. Nützlich: Beschreibung regenerieren oder gezielt
  nachschärfen („kürzer", „länger", „düsterer", „humorvoller"). Manuelles
  Editieren geht bereits, das Nachgenerieren per KI nicht.
- **Mehr strukturierte Felder** – z. B. Motivation/Ziele, Ängste, Geheimnisse,
  Eigenheiten/Sprechweise, Fähigkeiten. Optional als eigene Abschnitte.
- **RPG-Werteblock** (für Spiele) – Attribute wie Stärke/Geschicklichkeit,
  Gesinnung, Ausrüstung/Inventar. Als eigener, abschaltbarer Bereich.
- **„Überrasch mich"** – komplett zufälliger Charakter per Klick.

## Bilder

- ⭐ **Mehrere Bilder pro Charakter** – statt nur eines Portraits eine kleine
  Bildergalerie (verschiedene Posen/Outfits/Ausdrücke), eines als Hauptbild
  markierbar. Passt gut zur bestehenden Ersetzen-/Upload-Logik; braucht ein
  eigenes `Image`-Modell in Prisma.
- **Referenzbild als Vorlage** – ein hochgeladenes Bild als Stil-/Gesichts-
  referenz für die Generierung nutzen (image-to-image).
- **Bildformat wählbar** – Hochformat / Quadrat / Ganzkörper. Aktuell ist die
  Größe in `lib/imageProvider.ts` fest auf `1024x1024` verdrahtet.

## Organisation & Workflow

- ⭐ **Suche & Sortierung in der Galerie** – nach Name/Merkmalen filtern,
  sortieren (Datum, Name). Bislang gibt es nur den Filter nach Gruppe.
- **Charakter duplizieren** – als Ausgangspunkt für Varianten.
- **Beziehungen zwischen Charakteren** – innerhalb eines Projekts verknüpfen
  (Familie, Rivale, Verbündeter), evtl. als kleine Beziehungsübersicht.
- **Projekt-/Gruppen-Kontext** – pro Gruppe ein gemeinsames Setting/Welt-
  beschreibung, das alle Charaktere dieses Projekts beeinflusst.

## Export & Teilen

- **Export als JSON / Markdown** – der PDF-Steckbrief steht, die
  maschinenlesbaren Formate fehlen noch. JSON ist zudem die Voraussetzung für
  den Import.
- **Import** – gespeicherte Charaktere (JSON) wieder einlesen.
- **Ganze Gruppe exportieren** – z. B. alle Figuren eines Projekts als
  Sammel-PDF.

## Vorlagen & Komfort

- **Kosten-/Nutzungshinweis** – grobe Anzeige, was Text- und Bildgenerierung
  ungefähr kosten.

## Umgesetzt

- **Felder editierbar machen** – Name, Kurzbeschreibung, Beschreibung und alle
  Merkmale sind in beiden Ansichten bearbeitbar.
- **Export als PDF-Steckbrief** – `app/components/CharacterPdf.tsx`
  (JSON/Markdown stehen oben weiterhin offen).
- **Genre-Vorlagen** – `lib/templates.ts`, belegen das Setting-Feld vor.
- **Light/Dark-Umschalter** – Hell/Dunkel/System im Header, Wahl wird
  gespeichert.
- **Bild neu erzeugen / ersetzen / hochladen** – inkl. Herunterskalierung
  beim Upload.
- **Gruppen / Projekte** – Zuordnung und Filterung in der Galerie.
