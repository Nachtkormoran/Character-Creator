import type {
  Character,
  CharacterImage,
  Scenario,
} from "@/app/generated/prisma/client";
import {
  normalizeInputGenre,
  normalizePlotVariants,
  normalizeScenarioDetails,
  normalizeStoryArc,
  normalizeTraits,
} from "./schema";
import type {
  CharacterInput,
  GeneratedCharacter,
  PlotVariants,
  ScenarioDetails,
  StoryArc,
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

/** Bild-Zeile, bei der `imageData` fehlen darf. */
type ImageRow = Omit<CharacterImage, "imageData" | "characterId"> & {
  imageData?: string | null;
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
   * Der Story Arc – die dramaturgische Zerlegung des aktiven Handlungsentwurfs.
   * `stufen: []`, solange keiner abgeleitet wurde (Altbestand, oder verworfen);
   * bewusst kein `null`, damit Anzeige und Bearbeitung keinen Sonderfall
   * brauchen – dieselbe Idee wie bei `plotVariants`.
   */
  storyArc: StoryArc;
  /**
   * Vorschau des Weltbilds (WebP, ~40 KB) oder `null`. Das Original
   * (`imageData`, ~2 MB) reist **nie** in einer Antwort mit – es wird bei
   * Bedarf einzeln über `GET /api/scenarios/[id]/image` geholt (Vollbild,
   * Export), genau wie bei den Charakter-Bildern.
   */
  thumbnail: string | null;
  count: number;
}

/**
 * `imageData` ist bewusst optional: Alle Abfragen `omit`ten es (es ist groß),
 * die Zeile trägt es dann gar nicht. `serializeScenario` liest es ohnehin nie –
 * der Typ macht nur sichtbar, dass die Spalte hier nicht erwartet wird.
 */
type ScenarioRow = Omit<Scenario, "imageData"> & {
  imageData?: string | null;
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
  const storyArc = normalizeStoryArc(
    row.storyArc ? JSON.parse(row.storyArc) : null,
  );
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    name: row.name,
    details,
    plotVariants,
    storyArc,
    thumbnail: row.thumbnail ?? null,
    count: row._count?.characters ?? 0,
  };
}
