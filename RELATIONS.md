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

## Einsatz im Story Arc

Die Beziehungen von oben sind genau das Material, das der Story Arc (s.
[STORYARC.md](STORYARC.md)) braucht. Der Arc zerlegt einen Handlungsentwurf in
dramaturgische Stationen; **Konflikt ist sein Motor, und Beziehungen sind
vorgefertigter Konflikt.** Bis hierher betrachtet einzig `scenario-plot` mehrere
Figuren zugleich, aber nur als lose Sammlung. Eine explizite Beziehungs-Ebene
sagt dem Modell, *wie* sie zueinander stehen – und daraus schreibt sich ein
Wendepunkt fast von selbst.

### Welche Beziehungen der Arc liest

Beziehungen sind – wie oben entworfen – **projektweit** (Galerie), nicht ans
Szenario gehängt. Der Arc ist dagegen szenariogebunden. Beides passt ohne ein
`scenarioId` an der Kante zusammen: Der Arc liest schlicht alle
`Relationship`-Zeilen, deren **beide** Pole (`fromId`, `toId`) zur Besetzung des
Szenarios gehören. Eine Beziehung ist eine Tatsache über zwei Menschen; der Arc
filtert sie nur auf seine Besetzung. (Cross-Szenario-Kanten – ein Pol außerhalb
der Besetzung – bleiben draußen, still, nicht als Fehler.)

### Eine Valenz je Typ – abgeleitet, nicht gespeichert

Damit der Arc weiß, welche Beziehung Konflikt trägt, braucht jeder Typ eine
**Färbung**. Dieselbe Entscheidung wie beim `inverse`: Sie gehört in
`RELATIONSHIP_TYPES`, nicht in eine Spalte – ein neuer Wert bleibt ein
Listeneintrag, keine Migration.

```ts
export const RELATIONSHIP_TYPES = [
  { value: "geschwister", label: "Geschwister",    inverse: "geschwister", valenz: "positiv" },
  { value: "elternteil",  label: "Elternteil von", inverse: "kind",        valenz: "positiv" },
  { value: "mentor",      label: "Mentor von",     inverse: "schueler",    valenz: "positiv" },
  { value: "partner",     label: "Partner",        inverse: "partner",     valenz: "positiv" },
  { value: "freund",      label: "Freund von",     inverse: "freund",      valenz: "positiv" },
  { value: "verbuendet",  label: "verbündet mit",  inverse: "verbuendet",  valenz: "positiv" },
  { value: "vorgesetzt",  label: "Vorgesetzte(r) von", inverse: "unterstellt", valenz: "ambivalent" },
  { value: "rivale",      label: "Rivale",         inverse: "rivale",      valenz: "negativ" },
  { value: "feind",       label: "Feind von",      inverse: "feind",       valenz: "negativ" },
] as const;
```

`valenz: "positiv" | "negativ" | "ambivalent"`. Damit ist zugleich die **offene
Frage unten beantwortet**: „Feind", „Vorgesetzter" und „Freund" kommen dazu, und
gerade die konfliktträchtigen (Feind, Rivale) sind der wertvollste Input für den
Arc. Feinjustieren lässt sich der Ton je Beziehung ohne neues Feld – das
vorhandene `note` („Geschwister, aber seit dem Streit zerrüttet") liest das
Modell mit und darf die Typ-Valenz im Einzelfall kippen.

### Als Prompt-Material

`scenario-plot` und (sobald es existiert) `scenario-arc` bekommen einen
**Beziehungs-Block** – zusätzlich zu Kurzbeschreibung, Text, Merkmalen und
`storyHooks` je Figur. Gebaut aus `label`/`inverse` (lesbar aufgelöst) plus
`note`, gefiltert auf die Besetzung:

```
Beziehungen der Besetzung:
- Maeve ist Mentorin von Elin (positiv): Elin verdankt ihr alles und beginnt zu zweifeln.
- Anna und Lydia sind Geschwister (positiv), aber seit dem Streit zerrüttet.
- Elin und Rasmus sind Rivalen (negativ): …
```

### Die prüfbare Konflikt-Regel

Im Prompt als am Ergebnis prüfbare Bedingung, nicht als Bitte – dieselbe
**„Belegstelle"-Disziplin** wie bei der `eng`-Bindung der `storyHooks`:

> „Der zentrale Konflikt jeder Station muss sich auf **eine der genannten
> Beziehungen** zurückführen lassen. Erfinde keine neuen Beziehungen; braucht
> eine Station eine Zuspitzung, nimm die mit der stärksten Spannung (negativ
> oder ambivalent)."

Eine rein positive Besetzung ohne eine einzige Reibung ist ein Warnsignal – die
UI kann darauf hinweisen, dass der Arc dann flach bleibt.

### Stationen greifen Beziehungen auf

Das `ArcStufe`-Schema aus [STORYARC.md](STORYARC.md) bekommt ein Feld
`beziehungen: string[]` – welche Beziehungen eine Station **berührt oder
verschiebt** (per Id oder Kennung „Elin↔Rasmus"). So wird sichtbar, *wann* sich
eine Beziehung dreht, und die Rückbindung wird prüfbar (Namens-/Id-Abgleich wie
bei `scenario-plot-persons`).

### Der eigentliche Gewinn: der Graph bekommt eine Zeitachse

Ein Story Arc ist dann nicht nur eine Folge von Ereignissen, sondern die
**Transformation des Beziehungsgraphen über die Zeit** – aus Verbündeten werden
Verräter, aus Rivalen Partner. Die Kreis-Übersicht von oben ließe sich entlang
der Arc-Zeitleiste **umfärben** (Valenz je Station). Der Arc gibt den Beziehungen
eine Zeitachse, die Beziehungen geben dem Arc seinen Konflikt. Das ist die
lohnende Ausbaustufe, kein MVP.

### Rückkopplung

Wie `scenario-plot-persons` Personen aus dem Entwurf fischt, kann ein erzeugter
Arc **Beziehungen benennen, die es als `Relationship` noch nicht gibt** („Maeve
und Rasmus sind alte Feinde") → Vorschlag, sie anzulegen. So wächst der Graph
mit der Geschichte, statt vorab vollständig sein zu müssen.

### Reihenfolge

Das ist ein **dritter Schritt** nach den zwei oben (Modell+Liste, dann
Kreis-Graph) und setzt `scenario-arc` voraus: (a) `valenz` in
`RELATIONSHIP_TYPES`, (b) Beziehungs-Block + Konflikt-Regel in
`scenario-plot`/`scenario-arc`, (c) `ArcStufe.beziehungen`. Erst danach die
Verlaufs-Ausbaustufe.

## Bewusst noch nicht eingeplant

Beziehungen in den **Erstellungs**-Prompt geben („erzeuge jemanden, der Annas
jüngerer Bruder ist"). Das betrifft `generate-text`, nicht den Arc, und bleibt
ein eigenes Thema – der Arc-Einsatz oben ist davon unberührt.

## Offene Frage

Reicht die Typenliste oben? Naheliegende Ergänzungen wären „Feind",
„Vorgesetzter" und „Freund".

→ **Beantwortet** im Abschnitt „Einsatz im Story Arc": Die drei kommen dazu, und
mit ihnen eine `valenz` je Typ – ohne die bliebe der Arc konfliktblind.
