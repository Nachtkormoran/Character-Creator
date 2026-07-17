import type { Character } from "@/app/generated/prisma/client";
import type {
  CharacterInput,
  CharacterTraits,
  GeneratedCharacter,
} from "./schema";

/** Client-Repräsentation eines gespeicherten Charakters. */
export interface StoredCharacter {
  id: string;
  createdAt: string;
  input: CharacterInput;
  character: GeneratedCharacter;
  imageData: string | null;
}

/** Wandelt eine DB-Zeile in die vom Frontend genutzte Struktur um. */
export function serializeCharacter(row: Character): StoredCharacter {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    input: JSON.parse(row.input) as CharacterInput,
    character: {
      name: row.name ?? "",
      kurzbeschreibung: row.shortDescription ?? "",
      beschreibung: row.description,
      merkmale: JSON.parse(row.traits) as CharacterTraits,
    },
    imageData: row.imageData,
  };
}
