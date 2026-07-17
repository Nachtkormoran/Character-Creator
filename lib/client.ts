import type { CharacterInput, GeneratedCharacter } from "./schema";
import type { StoredCharacter } from "./serialize";

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
  options: { includeTraits: boolean; includeTextDetails: boolean },
) {
  return postJson<{ imageData: string }>("/api/generate-image", {
    character,
    imageStyle,
    ...options,
  });
}

export function saveCharacter(
  input: CharacterInput,
  character: GeneratedCharacter,
  imageData: string | null,
) {
  return postJson<{ character: StoredCharacter }>("/api/characters", {
    input,
    character,
    imageData,
  });
}

export async function listCharacters(): Promise<StoredCharacter[]> {
  const res = await fetch("/api/characters", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Laden fehlgeschlagen.");
  return data.characters as StoredCharacter[];
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
    body: JSON.stringify({ imageData }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Bild speichern fehlgeschlagen.");
  return data.character as StoredCharacter;
}

export async function deleteCharacter(id: string): Promise<void> {
  const res = await fetch(`/api/characters/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Löschen fehlgeschlagen.");
  }
}
