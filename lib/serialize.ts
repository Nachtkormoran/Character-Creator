import type { Character, Scenario } from "@/app/generated/prisma/client";
import {
  normalizeInputGenre,
  normalizePlotVariants,
  normalizeScenarioDetails,
  normalizeStoryArc,
  normalizeStoryArcVariants,
  normalizeTraits,
} from "./schema";
import type {
  CharacterInput,
  GeneratedCharacter,
  PlotVariants,
  ScenarioDetails,
  StoryArc,
  StoryArcVariants,
} from "./schema";

/** Client-Repräsentation eines einzelnen Bildes. */
export interface StoredImage {
  id: string;
  createdAt: string;
  /**
   * Das Original. `null`, wenn die Route es aus Größengründen nicht mitliefert
   * (~2 MB pro Bild); dann per `getImage` einzeln nachladen.
   */
  imageData: string | null;
  thumbnail: string | null;
  isPrimary: boolean;
}

/**
 * Bild-Zeile, bei der `imageData` fehlen darf. Bewusst **strukturell** (nicht an
 * `CharacterImage` gebunden): dieselbe Form haben `CharacterImage` und
 * `ScenarioImage`, und `serializeImage` liest ohnehin nur diese Felder. So teilen
 * sich beide denselben Serialisierer.
 */
type ImageRow = {
  id: string;
  createdAt: Date;
  imageData?: string | null;
  thumbnail: string | null;
  isPrimary: boolean;
};

export function serializeImage(row: ImageRow): StoredImage {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    imageData: row.imageData ?? null,
    thumbnail: row.thumbnail,
    isPrimary: row.isPrimary,
  };
}

/** Client-Repräsentation eines gespeicherten Charakters. */
export interface StoredCharacter {
  id: string;
  createdAt: string;
  input: CharacterInput;
  character: GeneratedCharacter;
  scenarioId: string | null;
  /**
   * Drei Ansatzpunkte für eine Geschichte, als Freitext. Leerer String, solange
   * keine erzeugt wurden – bewusst nicht `null`, damit die Anzeige und das
   * Textfeld keinen Sonderfall brauchen.
   */
  storyHooks: string;
  /**
   * Protagonist des zugeordneten Szenarios? Steuert den Handlungsentwurf (s.
   * `buildScenarioPlotPrompt`). Nur innerhalb eines Szenarios sinnvoll.
   */
  isProtagonist: boolean;
  /**
   * Alle Bilder, neueste zuerst – **ohne** `imageData`. Die Originale sind je
   * ~2 MB; das Original holt sich die Anzeige bei Bedarf einzeln über
   * `GET /api/characters/[id]/images/[imageId]`.
   */
  images: StoredImage[];
}

/**
 * Das anzuzeigende Bild eines Charakters.
 *
 * Bewusst hier abgeleitet statt als eigenes Feld mitzuschicken: sonst läge das
 * Thumbnail des Primärbilds doppelt in jeder Antwort (einmal separat, einmal
 * in `images`) und die Listen-Antwort wäre doppelt so groß.
 *
 * Dass genau ein Bild `isPrimary` trägt, stellt die API sicher. Sollte die
 * Markierung doch einmal fehlen (importierte Sicherung), fällt die Wahl auf das
 * neueste Bild, damit nie eine leere Anzeige entsteht.
 */
export function primaryImage(c: {
  images: StoredImage[];
}): StoredImage | null {
  return c.images.find((i) => i.isPrimary) ?? c.images[0] ?? null;
}

/**
 * Wandelt eine DB-Zeile in die vom Frontend genutzte Struktur um.
 *
 * Die Bilder müssen mitgeladen sein (`include: { images: … }`); fehlen sie,
 * bleibt die Liste leer.
 */
export function serializeCharacter(
  row: Character & { images?: ImageRow[] },
): StoredCharacter {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    // Vor der Genre-Spalte gespeicherte Charaktere haben keines – auffüllen,
    // sonst liefe die Szenario-Ableitung in ein `undefined`.
    input: normalizeInputGenre(JSON.parse(row.input)),
    character: {
      name: row.name ?? "",
      kurzbeschreibung: row.shortDescription ?? "",
      beschreibung: row.description,
      // Altbestände können einzelne Merkmale nicht enthalten – auffüllen,
      // sonst scheitert später jede Validierung gegen das Schema.
      merkmale: normalizeTraits(JSON.parse(row.traits)),
    },
    scenarioId: row.scenarioId,
    storyHooks: row.storyHooks ?? "",
    isProtagonist: row.isProtagonist,
    images: (row.images ?? []).map(serializeImage),
  };
}

/** Client-Repräsentation eines Szenarios (inkl. Anzahl zugeordneter Charaktere). */
export interface StoredScenario {
  id: string;
  createdAt: string;
  name: string;
  /**
   * Die Festlegungen. Immer vollständig – fehlende Felder füllt
   * `normalizeScenarioDetails` auf, damit die Anzeige keinen Sonderfall
   * braucht und ein später ergänztes Feld Altbestände nicht bricht.
   */
  details: ScenarioDetails;
  /**
   * Alle Handlungsentwürfe und welcher aktiv ist. Die aktive Variante ist
   * zugleich `details.handlung` (dort lesen Export und Personensuche sie) –
   * `serializeScenario` hält beide konsistent. Immer mindestens gefüllt, wenn
   * ein Handlungsentwurf existiert; sonst `items: []`.
   */
  plotVariants: PlotVariants;
  /**
   * Der **aktive** Story Arc – die dramaturgische Zerlegung des aktiven
   * Handlungsentwurfs. `stufen: []`, solange keiner abgeleitet wurde
   * (Altbestand, oder verworfen); bewusst kein `null`, damit Anzeige und
   * Bearbeitung keinen Sonderfall brauchen – dieselbe Idee wie bei
   * `plotVariants`. Zugleich `storyArcVariants.items[aktiv]`.
   */
  storyArc: StoryArc;
  /**
   * Alle Story Arcs und welcher aktiv ist – wie `plotVariants` bei den
   * Handlungsentwürfen. Der aktive ist zugleich `storyArc` (oben);
   * `serializeScenario` hält beide konsistent. `items: []`, solange keiner
   * abgeleitet wurde.
   */
  storyArcVariants: StoryArcVariants;
  /**
   * Alle Weltbilder, neueste zuerst – **ohne** `imageData`. Genau wie bei den
   * Charakteren: die Originale sind je ~2 MB, das Original holt die Anzeige bei
   * Bedarf einzeln über `GET /api/scenarios/[id]/images/[imageId]`. Das
   * anzuzeigende (Primär-)Bild leitet `primaryImage(scenario)` ab.
   */
  images: StoredImage[];
  count: number;
}

/** Szenario-Zeile mit optional mitgeladenen Bild-Metadaten (ohne `imageData`). */
type ScenarioRow = Scenario & {
  images?: ImageRow[];
  _count?: { characters: number };
};

export function serializeScenario(row: ScenarioRow): StoredScenario {
  const details = normalizeScenarioDetails(
    row.details ? JSON.parse(row.details) : {},
  );
  const plotVariants = normalizePlotVariants(
    row.plotVariants ? JSON.parse(row.plotVariants) : null,
    details.handlung,
  );
  // Die aktive Variante ist die maßgebliche Handlung – so bekommt der Client die
  // beiden nie widersprüchlich (etwa nach einem Import, der nur `details` setzt).
  details.handlung = plotVariants.items[plotVariants.aktiv] ?? details.handlung;
  const gespeicherterArc = normalizeStoryArc(
    row.storyArc ? JSON.parse(row.storyArc) : null,
  );
  const storyArcVariants = normalizeStoryArcVariants(
    row.storyArcVariants ? JSON.parse(row.storyArcVariants) : null,
    gespeicherterArc,
  );
  // Der aktive Arc ist der maßgebliche – so bekommt der Client die beiden nie
  // widersprüchlich (etwa nach einem Import, der nur `storyArc` setzt).
  const storyArc =
    storyArcVariants.items[storyArcVariants.aktiv] ?? gespeicherterArc;
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    name: row.name,
    details,
    plotVariants,
    storyArc,
    storyArcVariants,
    images: (row.images ?? []).map(serializeImage),
    count: row._count?.characters ?? 0,
  };
}
