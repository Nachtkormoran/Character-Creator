import { makeThumbnail } from "./image";
import type { CharacterInput, GeneratedCharacter, Settings } from "./schema";
import type { StoredCharacter, StoredGroup } from "./serialize";

/**
 * Erzeugt das Vorschaubild. Schlägt das fehl (etwa weil Canvas das Bild nicht
 * lesen kann), wird ohne Thumbnail gespeichert – die Anzeige fällt dann auf
 * das Original zurück. Ein kaputtes Vorschaubild darf niemals das Speichern
 * des Charakters verhindern.
 */
async function safeThumbnail(imageData: string): Promise<string | null> {
  try {
    return await makeThumbnail(imageData);
  } catch (err) {
    console.warn("Thumbnail konnte nicht erzeugt werden:", err);
    return null;
  }
}

/** Kleiner Wrapper um fetch, der Fehlermeldungen des Backends durchreicht. */
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Anfrage fehlgeschlagen (${res.status}).`);
  }
  return data as T;
}

export function generateText(input: CharacterInput) {
  return postJson<{ character: GeneratedCharacter }>(
    "/api/generate-text",
    input,
  );
}

export function generateImage(
  character: GeneratedCharacter,
  imageStyle: string,
  options: {
    includeTraits: boolean;
    includeTextDetails: boolean;
    extraPrompt?: string;
  },
) {
  return postJson<{ imageData: string }>("/api/generate-image", {
    character,
    imageStyle,
    ...options,
  });
}

export async function getSettings(): Promise<Settings> {
  const res = await fetch("/api/settings", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Laden fehlgeschlagen.");
  return data.settings as Settings;
}

export async function updateSettings(
  patch: Partial<Settings>,
): Promise<Settings> {
  const res = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Speichern fehlgeschlagen.");
  return data.settings as Settings;
}

export async function saveCharacter(
  input: CharacterInput,
  character: GeneratedCharacter,
  imageData: string | null,
  groupId: string | null = null,
) {
  return postJson<{ character: StoredCharacter }>("/api/characters", {
    input,
    character,
    imageData,
    thumbnail: imageData ? await safeThumbnail(imageData) : null,
    groupId,
  });
}

export async function listCharacters(): Promise<StoredCharacter[]> {
  const res = await fetch("/api/characters", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Laden fehlgeschlagen.");
  return data.characters as StoredCharacter[];
}

/**
 * Lädt einen einzelnen Charakter **inklusive** Originalbild. Die Listen-Route
 * liefert nur das Thumbnail, deshalb wird das Original hier bei Bedarf
 * nachgeholt (Vollbild-Ansicht, PDF-Export).
 */
export async function getCharacter(id: string): Promise<StoredCharacter> {
  const res = await fetch(`/api/characters/${id}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Laden fehlgeschlagen.");
  return data.character as StoredCharacter;
}

export async function updateCharacterName(
  id: string,
  name: string,
): Promise<StoredCharacter> {
  const res = await fetch(`/api/characters/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Umbenennen fehlgeschlagen.");
  return data.character as StoredCharacter;
}

export async function updateCharacterImage(
  id: string,
  imageData: string,
): Promise<StoredCharacter> {
  const res = await fetch(`/api/characters/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    // Thumbnail immer mitschreiben, sonst zeigt die Galerie nach einem
    // Bildwechsel weiter die alte Vorschau.
    body: JSON.stringify({
      imageData,
      thumbnail: await safeThumbnail(imageData),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Bild speichern fehlgeschlagen.");
  return data.character as StoredCharacter;
}

export async function updateCharacterGroup(
  id: string,
  groupId: string | null,
): Promise<StoredCharacter> {
  const res = await fetch(`/api/characters/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Zuordnung fehlgeschlagen.");
  return data.character as StoredCharacter;
}

export async function updateCharacterContent(
  id: string,
  character: GeneratedCharacter,
): Promise<StoredCharacter> {
  const res = await fetch(`/api/characters/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: character.name,
      shortDescription: character.kurzbeschreibung,
      description: character.beschreibung,
      traits: character.merkmale,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Speichern fehlgeschlagen.");
  return data.character as StoredCharacter;
}

export async function deleteCharacter(id: string): Promise<void> {
  const res = await fetch(`/api/characters/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Löschen fehlgeschlagen.");
  }
}

// --- Gruppen -------------------------------------------------------------

export interface ImportResult {
  characters: number;
  groups: number;
  settings: number;
  safetyCopy: string;
}

/** Lädt die komplette Datenbank als Datei herunter. */
export async function exportDatabase(): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch("/api/backup", { cache: "no-store" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Export fehlgeschlagen.");
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  return {
    blob: await res.blob(),
    filename: match?.[1] ?? "charakter-creator.db",
  };
}

/** **Ersetzt** den gesamten Datenbestand durch den der Datei. */
export async function importDatabase(file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/backup", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Import fehlgeschlagen.");
  return data.result as ImportResult;
}

export async function listGroups(): Promise<StoredGroup[]> {
  const res = await fetch("/api/groups", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Gruppen laden fehlgeschlagen.");
  return data.groups as StoredGroup[];
}

export async function createGroup(name: string): Promise<StoredGroup> {
  const res = await fetch("/api/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Gruppe anlegen fehlgeschlagen.");
  return data.group as StoredGroup;
}

export async function deleteGroup(id: string): Promise<void> {
  const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Gruppe löschen fehlgeschlagen.");
  }
}
