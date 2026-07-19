import type {
  Character,
  CharacterImage,
  Scenario,
} from "@/app/generated/prisma/client";
import { normalizeScenarioDetails, normalizeTraits } from "./schema";
import type {
  CharacterInput,
  GeneratedCharacter,
  ScenarioDetails,
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
    input: JSON.parse(row.input) as CharacterInput,
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
  count: number;
}

export function serializeScenario(
  row: Scenario & { _count?: { characters: number } },
): StoredScenario {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    name: row.name,
    details: normalizeScenarioDetails(
      row.details ? JSON.parse(row.details) : {},
    ),
    count: row._count?.characters ?? 0,
  };
}
