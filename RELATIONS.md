# Beziehungen zwischen Charakteren

Entwurf für die in `IDEAS.md` unter „Organisation & Workflow" notierte Idee
„Beziehungen zwischen Charakteren – innerhalb eines Projekts verknüpfen
(Familie, Rivale, Verbündeter), evtl. als kleine Beziehungsübersicht".

**Stand: 18.07.2026. Noch nicht umgesetzt** – dies ist ein Vorschlag, kein
Protokoll des Gebauten.

## Die eine Entscheidung, die zählt: eine Zeile pro Beziehung, nicht zwei

Der naheliegende Weg wäre, an jedem Charakter seine Beziehungen zu speichern –
„Anna: Schwester von Lydia" und bei Lydia nochmal „Schwester von Anna". Das
rächt sich sofort: zwei Wahrheiten, die auseinanderdriften. Man löscht eine
Seite, die andere bleibt als Geisterbeziehung stehen.

Stattdessen **eine gerichtete Kante, die von beiden Seiten gelesen wird**:

```prisma
model Relationship {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  fromId    String
  from      Character @relation("RelationFrom", fields: [fromId], references: [id], onDelete: Cascade)
  toId      String
  to        Character @relation("RelationTo",   fields: [toId],   references: [id], onDelete: Cascade)

  type      String   // Schlüssel aus RELATIONSHIP_TYPES
  note      String?  // „seit dem Streit 2019 kein Kontakt"

  @@unique([fromId, toId, type])
  @@index([toId])
}
```

Gespeichert wird „Maeve **ist Mentorin von** Elin". Bei Elin zeigt die Ansicht
daraus automatisch „Maeve **ist Mentorin von** ihr" bzw. „Schülerin von Maeve" –
abgeleitet, nicht gespeichert.

## Die Umkehrung gehört in eine Tabelle, nicht in die Anzeige

Genau wie `TRAIT_LABELS` und `IMAGE_STYLES` – statisch in `lib/schema.ts`:

```ts
export const RELATIONSHIP_TYPES = [
  { value: "geschwister", label: "Geschwister",    inverse: "geschwister" },
  { value: "elternteil",  label: "Elternteil von", inverse: "kind" },
  { value: "kind",        label: "Kind von",       inverse: "elternteil" },
  { value: "mentor",      label: "Mentor von",     inverse: "schueler" },
  { value: "partner",     label: "Partner",        inverse: "partner" },
  { value: "rivale",      label: "Rivale",         inverse: "rivale" },
  { value: "verbuendet",  label: "verbündet mit",  inverse: "verbuendet" },
] as const;
```

Symmetrische Typen zeigen auf sich selbst, asymmetrische auf ihr Gegenstück.
Damit ist die Richtung ein Anzeigeproblem statt eines Datenproblems, und ein
neuer Typ ist ein Listeneintrag – **keine Migration**, genau wie bei den
Genre-Vorlagen.

Zwei Regeln, die das Modell nicht erzwingt und die deshalb serverseitig hin
müssen – dieselbe Rolle, die `characterImages.ts` für „genau ein Primärbild"
spielt:

- `fromId !== toId` (kein Charakter in Beziehung zu sich selbst),
- ein Paar nicht in beide Richtungen speichern (beim Anlegen prüfen, ob die
  Gegenrichtung schon existiert).

## Die Übersicht braucht keine Bibliothek

Ein Kreis-Layout reicht und ist deterministisch: N Charaktere gleichmäßig auf
einem Kreis, Kanten als SVG-Linien dazwischen. Rund 100 Zeilen handgeschriebenes
SVG, keine Abhängigkeit, kein Bundle-Zuwachs – bei bis zu ~20 Figuren gut
lesbar. Force-directed Layouts sehen erst ab deutlich mehr Knoten besser aus und
kosten eine Physik-Bibliothek.

Als **Ansichts-Umschalter in der Galerie** („Karten | Beziehungen"), nicht als
eigene Seite: dann greift der vorhandene Gruppen-Filter kostenlos, und genau den
braucht man, damit der Graph kein Knäuel wird.

**Aus den vorhandenen Daten:** alle 18 Charaktere liegen aktuell in „Ohne
Gruppe". Ein gruppenweiser Graph zeigt also erst etwas, wenn tatsächlich
gruppiert wird – oder man lässt „Alle" zu und nimmt bei 18 Knoten ein volles
Bild in Kauf.

## Vorschlag zur Reihenfolge

In **zwei Schritten** bauen, den ersten für sich stehen lassen:

1. **Modell + Liste in der Detailansicht.** Abschnitt „Beziehungen" unter den
   Merkmalen, Hinzufügen über eine neue Ebene mit Charakter-Auswahl (dasselbe
   Muster wie `CharacterInputModal`, `z-70`). Das ist der Großteil des Nutzens.
2. **Die Kreis-Übersicht** obendrauf, sobald Schritt 1 sich im Gebrauch bewährt
   hat.

Schritt 1 ist überschaubar: Migration, zwei Routen (`POST`/`DELETE`), ein
Abschnitt, eine Ebene.

## Fallstricke, die diesmal anders sind

- Es braucht **wirklich eine Migration** (neue Tabelle, nicht nur ein Feld im
  JSON-String `traits` wie bei den zuletzt ergänzten Merkmalen). Danach den
  **Dev-Server neu starten** – s. `CLAUDE.md`.
- `lib/backup.ts` muss die neue Tabelle **mitnehmen**, sonst verlieren
  Sicherungen die Beziehungen. Dort wird tabellenweise kopiert, nicht die Datei
  getauscht.

## Bewusst noch nicht eingeplant

Beziehungen in den Text-Prompt geben („erzeuge jemanden, der Annas jüngerer
Bruder ist"). Reizvoll, aber ein eigenes Thema.

## Offene Frage

Reicht die Typenliste oben? Naheliegende Ergänzungen wären „Feind",
„Vorgesetzter" und „Freund".
