/**
 * **Der Dokument-Kern der Szenario-Detailseite als pure Logik.**
 *
 * Name, Festlegungen, **alle** Handlungsentwürfe **und alle** Story Arcs teilen
 * sich auf `app/scenarios/[id]/page.tsx` **eine** Speicher-Einheit: `dirty`
 * vergleicht einen JSON-Schnappschuss gegen die `saved`-Basislinie, `speichern`
 * PATCHt alle vier gemeinsam, „Verwerfen" setzt alle zurück. Dazu zwei
 * Merge-Invarianten – die **live** editierte aktive Zelle wird erst beim *Lesen*
 * in die Liste gefaltet (`details.handlung === varianten[aktiv]`,
 * `storyArc === arcVarianten[arcAktiv]`).
 *
 * Diese wenigen, aber fragilen Regeln lagen bisher als Closures im 2760-Zeilen-
 * Rumpf der Seite und waren nur manuell prüfbar. Hier stehen sie **pur und
 * testbar** an einer Stelle (s. `scenarioDocument.test.ts`), damit der weitere
 * Umbau der Seite sie nicht versehentlich brechen kann.
 *
 * **Härteste Regel: byte-genau dieselbe JSON-Form wie zuvor.** Insbesondere die
 * **Asymmetrie** zwischen `currentSnapshot` (die `meta` über `ausgerichtet(...)`
 * auf die gemergte Länge bringt) und `savedSnapshot` (das Server-Objekt
 * **unverändert** übernimmt) ist beabsichtigt und muss erhalten bleiben – sonst
 * meldet die Seite direkt nach dem Laden fälschlich „ungespeichert".
 */
import type {
  PlotVariants,
  ScenarioDetails,
  StoryArc,
  StoryArcVariants,
  VariantMeta,
} from "@/lib/schema";

/** Leere Metadaten – für neue leere/von Hand angelegte Varianten und als Rückfall. */
export const LEER_META: VariantMeta = {
  titel: "",
  form: "",
  ton: "",
  favorit: false,
  quelle: "",
  modell: "",
  werkform: "",
  cover: "",
  alsBuch: false,
};

/**
 * Bringt eine Metadaten-Liste auf genau `laenge` Einträge (fehlende leer,
 * überzählige weg) – hält `meta` mit der Variantenliste deckungsgleich, egal
 * was der Zustand gerade hält.
 */
export function ausgerichtet(meta: VariantMeta[], laenge: number): VariantMeta[] {
  return Array.from({ length: laenge }, (_, i) => meta[i] ?? LEER_META);
}

/**
 * Die volle Entwurfsliste mit der aktiven Zelle auf dem **live bearbeiteten**
 * `handlung`: dieser ist die Wahrheit über die aktive Variante, `varianten` hält
 * die übrigen. Zusammengeführt wird erst hier – so kostet das Tippen im Feld
 * keine Spiegelung in die Liste. Ohne gespeicherte Liste wird ein von Hand
 * getippter Entwurf zu Variante 1.
 */
export function mergeVarianten(
  varianten: string[],
  aktiv: number,
  handlung: string,
): string[] {
  if (varianten.length === 0) return handlung.trim() ? [handlung] : [];
  return varianten.map((v, i) => (i === aktiv ? handlung : v));
}

/**
 * Die volle Arc-Liste mit der aktiven Zelle auf dem **live bearbeiteten** Arc
 * (`storyArc`). Zwilling von {@link mergeVarianten}. Ohne gespeicherte Liste
 * wird ein von Hand aufgebauter Arc zu Arc 1.
 */
export function mergeArcs(
  arcVarianten: StoryArc[],
  arcAktiv: number,
  storyArc: StoryArc,
): StoryArc[] {
  if (arcVarianten.length === 0)
    return storyArc.stufen.length > 0 ? [storyArc] : [];
  return arcVarianten.map((v, i) => (i === arcAktiv ? storyArc : v));
}

/** Der aktuelle (live bearbeitete) Zustand der geteilten Speicher-Einheit. */
export interface DocumentState {
  name: string;
  details: ScenarioDetails;
  varianten: string[];
  aktiv: number;
  variantenMeta: VariantMeta[];
  storyArc: StoryArc;
  arcVarianten: StoryArc[];
  arcAktiv: number;
  arcMeta: VariantMeta[];
}

/**
 * Der `dirty`-Schnappschuss: die aktive Zelle in beide Listen gefaltet, `meta`
 * je auf die gemergte Länge ausgerichtet. **Exakt** die Form, die die Seite
 * bisher inline in `JSON.stringify({ name, details, plot, arc })` baute.
 */
export function currentSnapshot(s: DocumentState): string {
  const plotItems = mergeVarianten(s.varianten, s.aktiv, s.details.handlung);
  const arcItems = mergeArcs(s.arcVarianten, s.arcAktiv, s.storyArc);
  return JSON.stringify({
    name: s.name,
    details: s.details,
    plot: {
      items: plotItems,
      aktiv: s.aktiv,
      meta: ausgerichtet(s.variantenMeta, plotItems.length),
    },
    arc: {
      items: arcItems,
      aktiv: s.arcAktiv,
      meta: ausgerichtet(s.arcMeta, arcItems.length),
    },
  });
}

/**
 * Die `saved`-Basislinie: **asymmetrisch** zu {@link currentSnapshot} – hier
 * gehen die vom Server zurückgegebenen `plotVariants`/`storyArcVariants`
 * **unverändert** ein (kein erneutes `mergeVarianten`/`ausgerichtet`), genau wie
 * beim Laden und nach `speichern`. Diese Asymmetrie ist beabsichtigt und
 * byte-genau zu erhalten.
 */
export function savedSnapshot(s: {
  name: string;
  details: ScenarioDetails;
  plotVariants: PlotVariants;
  storyArcVariants: StoryArcVariants;
}): string {
  return JSON.stringify({
    name: s.name,
    details: s.details,
    plot: s.plotVariants,
    arc: s.storyArcVariants,
  });
}

/**
 * „Ungespeichert"? Wahr, sobald eine Basislinie existiert (`saved !== ""`) und
 * sich der aktuelle Schnappschuss davon unterscheidet.
 */
export function isDirty(saved: string, current: string): boolean {
  return saved !== "" && current !== saved;
}
