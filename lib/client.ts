import {
  CHARACTER_FILE_KIND,
  CHARACTER_FILE_VERSION,
  type CharacterFile,
  type CharacterPayload,
} from "./characterFile";
import {
  SCENARIO_FILE_KIND,
  SCENARIO_FILE_VERSION,
  type ScenarioFile,
} from "./scenarioFile";
import { makeThumbnail } from "./image";
import { DEFAULT_GENRE } from "./templates";
import type {
  CharacterInput,
  CharacterTraits,
  GeneratedCharacter,
  PlotPerson,
  ScenarioDetails,
  ScenarioDraft,
  Settings,
  StoryHookAnchor,
} from "./schema";
import type { StoredCharacter, StoredScenario } from "./serialize";

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

/**
 * Ein einzelner Namensvorschlag. `traits` gibt es nur für bereits erzeugte
 * Charaktere (Galerie) und hat im Prompt Vorrang vor den Vorgaben.
 */
export function generateName(input: CharacterInput, traits?: CharacterTraits) {
  return postJson<{ name: string }>("/api/generate-name", { input, traits });
}

/**
 * Erzeugt den Beschreibungstext eines bestehenden Charakters neu – aus seinen
 * ursprünglichen Vorgaben plus einem freien Zusatzwunsch. Name und Merkmale
 * bleiben unangetastet; zurück kommt nur der Text.
 */
export function regenerateDescription(
  input: CharacterInput,
  character: GeneratedCharacter,
  zusatz: string,
) {
  return postJson<{ beschreibung: string }>("/api/regenerate-text", {
    input,
    character,
    zusatz,
  });
}

/**
 * **Ein** Ansatzpunkt für eine Geschichte, als Freitext – die Galerie hängt
 * ihn an ihre Liste an. `anchor` bestimmt, wie fest er am Charakter hängt –
 * von „nur aus dem, was schon dasteht" bis „freie Hand".
 */
export function generateStoryHooks(
  character: GeneratedCharacter,
  anchor: StoryHookAnchor,
  /** Stichworte zur Richtung – wählen unter dem aus, was `anchor` zulässt. */
  richtung = "",
  /**
   * Die vorhandenen Ansatzpunkte als Ausschlussliste. Ohne sie liefert der
   * zweite Klick die erste Idee in anderen Worten.
   */
  vorhandene: string[] = [],
) {
  return postJson<{ ansatzpunkte: string }>("/api/story-hooks", {
    character,
    anchor,
    richtung,
    vorhandene,
  });
}

/**
 * Personen aus dem Handlungsentwurf, die dem Szenario noch nicht zugeordnet
 * sind. `handlung` kommt aus dem Formularzustand und nicht aus der Datenbank:
 * ein gerade bearbeiteter Entwurf ist der gemeinte.
 */
export function findPlotPersons(scenarioId: string, handlung: string) {
  return postJson<{ personen: PlotPerson[] }>("/api/scenario-plot-persons", {
    scenarioId,
    handlung,
  });
}

export function generateImage(
  character: GeneratedCharacter,
  imageStyle: string,
  options: {
    includeTraits: boolean;
    includeTextDetails: boolean;
    extraPrompt?: string;
    referenceImages?: string[];
    /**
     * Genre-Id des Charakters – steuert Kleidung und Umgebung im Bild.
     * Optional, weil eine fehlende Id serverseitig auf Gegenwart fällt; das
     * ist genau der Prompt, den es vor dem genre-abhängigen Bild-Prompt gab.
     */
    genre?: string;
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
  scenarioId: string | null = null,
) {
  return postJson<{ character: StoredCharacter }>("/api/characters", {
    input,
    character,
    imageData,
    thumbnail: imageData ? await safeThumbnail(imageData) : null,
    scenarioId,
  });
}

export async function listCharacters(): Promise<StoredCharacter[]> {
  const res = await fetch("/api/characters", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Laden fehlgeschlagen.");
  return data.characters as StoredCharacter[];
}

/**
 * Lädt einen einzelnen Charakter neu (samt Bild-Metadaten, aber **ohne** die
 * Originale – die holt `getImage` einzeln).
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

// --- Bilder ---------------------------------------------------------------

/**
 * Hängt ein weiteres Bild an den Charakter. Es wird dabei zum Primärbild –
 * ein gerade erzeugtes oder hochgeladenes Bild ist fast immer das gewünschte.
 */
export async function addCharacterImage(
  id: string,
  imageData: string,
): Promise<StoredCharacter> {
  const res = await fetch(`/api/characters/${id}/images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Thumbnail immer mitschreiben, sonst hätte das neue Bild keine Vorschau.
    body: JSON.stringify({
      imageData,
      thumbnail: await safeThumbnail(imageData),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Bild speichern fehlgeschlagen.");
  return data.character as StoredCharacter;
}

export async function setPrimaryImage(
  id: string,
  imageId: string,
): Promise<StoredCharacter> {
  const res = await fetch(`/api/characters/${id}/images/${imageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isPrimary: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Auswahl fehlgeschlagen.");
  return data.character as StoredCharacter;
}

export async function deleteCharacterImage(
  id: string,
  imageId: string,
): Promise<StoredCharacter> {
  const res = await fetch(`/api/characters/${id}/images/${imageId}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Löschen fehlgeschlagen.");
  return data.character as StoredCharacter;
}

/**
 * Holt das Original eines Bildes (~2 MB). Keine der Listen-Routen liefert es
 * mit; Vollbild, Bild-Export und PDF laden es hierüber nach.
 */
export async function getImage(id: string, imageId: string): Promise<string> {
  const res = await fetch(`/api/characters/${id}/images/${imageId}`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Bild laden fehlgeschlagen.");
  return data.imageData as string;
}

// --- Einzelne Charaktere exportieren / importieren -------------------------

/**
 * Baut die Exportdatei eines Charakters zusammen.
 *
 * Braucht **keine** eigene Route: Texte und Merkmale liegen bereits im Client,
 * nur die Bild-Originale fehlen (die Listen-Antworten führen sie aus
 * Größengründen nicht mit) und werden einzeln über `getImage` nachgeholt.
 *
 * Exportiert wird das **Original**, nicht das Thumbnail – eine Exportdatei mit
 * 640-px-Vorschauen wäre beim Wiedereinspielen ein stiller Qualitätsverlust.
 * Das Thumbnail geht zusätzlich mit, weil der Server es nicht erzeugen kann
 * (Canvas gibt es nur im Browser).
 */
export async function buildCharacterPayload(
  c: StoredCharacter,
  character: GeneratedCharacter = c.character,
  storyHooks: string = c.storyHooks,
): Promise<CharacterPayload> {
  const images = await Promise.all(
    c.images.map(async (bild) => ({
      imageData: await getImage(c.id, bild.id),
      thumbnail: bild.thumbnail,
      isPrimary: bild.isPrimary,
    })),
  );

  return {
    input: c.input,
    character: {
      name: character.name,
      kurzbeschreibung: character.kurzbeschreibung,
      beschreibung: character.beschreibung,
      merkmale: character.merkmale,
      storyHooks,
    },
    images,
  };
}

export async function buildCharacterFile(
  c: StoredCharacter,
  character: GeneratedCharacter = c.character,
  storyHooks: string = c.storyHooks,
): Promise<CharacterFile> {
  return {
    kind: CHARACTER_FILE_KIND,
    version: CHARACTER_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    ...(await buildCharacterPayload(c, character, storyHooks)),
  };
}

/**
 * Baut die Exportdatei eines **Szenarios** zusammen.
 *
 * `characters` bestimmt die Besetzung in der Datei: Wird die Checkbox im
 * Export abgewählt, kommt eine leere Liste an, und die Datei beschreibt nur die
 * Welt. Die Entscheidung fällt also in der Oberfläche und nicht hier – diese
 * Funktion exportiert genau das, was sie bekommt.
 *
 * Die Bild-Originale werden je Charakter einzeln nachgeholt (`getImage`), wie
 * beim Einzel-Export. Bei mehreren Figuren mit mehreren Bildern sind das
 * entsprechend viele Anfragen und **einige Dutzend MB** – deshalb sagt die
 * Oberfläche vorher, wie viele Figuren mitgehen.
 */
export async function buildScenarioFile(
  /**
   * Bewusst **kein** ganzes `StoredScenario`: In die Datei gehen nur Name und
   * Festlegungen, und `id`, `createdAt` und `count` gehören ausdrücklich nicht
   * hinein (Begründung in `scenarioFile.ts`). Mit dem engeren Typ kann die
   * aufrufende Seite den **bearbeiteten** Stand übergeben, ohne die übrigen
   * Felder erfinden zu müssen.
   */
  scenario: { name: string; details: ScenarioDetails },
  characters: StoredCharacter[],
): Promise<ScenarioFile> {
  return {
    kind: SCENARIO_FILE_KIND,
    version: SCENARIO_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    scenario: { name: scenario.name, details: scenario.details },
    // Nacheinander statt `Promise.all`: Jeder Charakter zieht seine
    // Bild-Originale einzeln, und mehrere Figuren gleichzeitig legten
    // Dutzende Megabyte parallel in den Speicher. Ein Export darf ein paar
    // Sekunden dauern.
    characters: await characters.reduce<Promise<CharacterPayload[]>>(
      async (bisher, c) => [...(await bisher), await buildCharacterPayload(c)],
      Promise.resolve([]),
    ),
  };
}

/** Spielt eine Exportdatei ein. Der Charakter wird **zusätzlich** angelegt. */
export async function importCharacterFile(
  file: File,
): Promise<{ character: StoredCharacter; images: number }> {
  let inhalt: unknown;
  try {
    inhalt = JSON.parse(await file.text());
  } catch {
    throw new Error(`„${file.name}" ist keine lesbare JSON-Datei.`);
  }
  return postJson<{ character: StoredCharacter; images: number }>(
    "/api/characters/import",
    inhalt,
  );
}

/**
 * Spielt eine **Szenario**-Exportdatei ein: Welt und, sofern in der Datei,
 * ihre Besetzung. Beides entsteht serverseitig in einer Transaktion, die
 * Charaktere hängen anschließend am neuen Szenario.
 *
 * Wie beim Charakter wird hier nur die Datei gelesen und weitergereicht – die
 * Prüfung macht die Route über `scenarioFileSchema`, damit sie an genau einer
 * Stelle passiert.
 */
export async function importScenarioFile(file: File): Promise<{
  scenario: StoredScenario;
  characters: number;
  images: number;
}> {
  let inhalt: unknown;
  try {
    inhalt = JSON.parse(await file.text());
  } catch {
    throw new Error(`„${file.name}" ist keine lesbare JSON-Datei.`);
  }
  return postJson<{
    scenario: StoredScenario;
    characters: number;
    images: number;
  }>("/api/scenarios/import", inhalt);
}

export async function updateCharacterScenario(
  id: string,
  scenarioId: string | null,
): Promise<StoredCharacter> {
  const res = await fetch(`/api/characters/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Zuordnung fehlgeschlagen.");
  return data.character as StoredCharacter;
}

/**
 * `storyHooks` und `genre` sind optional, weil beide außerhalb des
 * Charakter-Objekts stehen: Sie gehören zum Charakter, sind aber **kein** Teil
 * dessen, was das Modell bei der Erstgenerierung liefert
 * (`GeneratedCharacter`) – die Ansatzpunkte entstehen später auf Knopfdruck,
 * das Genre kommt aus den Vorgaben. Bleiben sie weg, rührt der Teil-PATCH die
 * gespeicherten Felder nicht an.
 */
export async function updateCharacterContent(
  id: string,
  character: GeneratedCharacter,
  storyHooks?: string,
  genre?: string,
): Promise<StoredCharacter> {
  const res = await fetch(`/api/characters/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: character.name,
      shortDescription: character.kurzbeschreibung,
      description: character.beschreibung,
      traits: character.merkmale,
      ...(storyHooks !== undefined ? { storyHooks } : {}),
      ...(genre !== undefined ? { genre } : {}),
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

// --- Szenarien -------------------------------------------------------------

export interface ImportResult {
  characters: number;
  images: number;
  scenarios: number;
  settings: number;
  safetyCopy: string;
}

/** Lädt die komplette Datenbank als Datei herunter. */
export async function exportDatabase(): Promise<{
  blob: Blob;
  filename: string;
}> {
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

export async function listScenarios(): Promise<StoredScenario[]> {
  const res = await fetch("/api/scenarios", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(data?.error || "Szenarien laden fehlgeschlagen.");
  return data.scenarios as StoredScenario[];
}

/**
 * `details` ist optional, weil es zwei Wege zum Anlegen gibt: das Feld in der
 * Galerie kennt nur den Namen (man ordnet gerade einen Charakter zu und will
 * nicht in ein Formular gedrängt werden), das Formular unter `/scenarios`
 * kennt alles.
 */
export async function createScenario(
  name: string,
  details?: ScenarioDetails,
): Promise<StoredScenario> {
  const res = await fetch("/api/scenarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, ...(details ? { details } : {}) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(data?.error || "Szenario anlegen fehlgeschlagen.");
  return data.scenario as StoredScenario;
}

/**
 * Ein Szenario aus einem Charakter ableiten – die Gegenrichtung zu
 * „Charakter für dieses Szenario anlegen".
 *
 * Bekommt den Charakter **im Request** und nicht als Id: in der Detailansicht
 * kann er ungespeichert bearbeitet sein, und gemeint ist der Stand auf dem
 * Bildschirm. Persistiert nichts – der Vorschlag geht in eine Maske und wird
 * erst über `createScenario` angelegt.
 */
export function generateScenarioFromCharacter(
  character: GeneratedCharacter,
  storyHooks = "",
  setting = "",
  /** Das Genre aus den Vorgaben – es wird übernommen, nicht neu erzeugt. */
  genre = DEFAULT_GENRE,
  /**
   * Würfel-Einträge des Genres als Formbeispiel mitschicken. Standardmäßig an;
   * die Maske bietet eine Checkbox zum Abschalten.
   */
  beispiele = true,
) {
  return postJson<{ draft: ScenarioDraft }>("/api/scenario-from-character", {
    character,
    storyHooks,
    setting,
    genre,
    beispiele,
  });
}

/**
 * Ort, Zeit oder Regeln eines Szenarios **ergänzen**.
 *
 * Anders als der Würfel kennt das Modell den Feldinhalt und die Nachbarfelder;
 * was schon dasteht, bleibt stehen. Welche Nachbarfelder es zu sehen bekommt,
 * entscheidet die Route über `SCENARIO_READS` – hier gehen bewusst die
 * **kompletten** Festlegungen raus, damit die Regel an genau einer Stelle
 * steht und nicht an jeder Aufrufstelle neu.
 */
export function generateScenarioField(
  feld: "ort" | "zeit" | "regeln",
  name: string,
  details: ScenarioDetails,
  zusatz = "",
) {
  return postJson<{ wert: string }>("/api/scenario-field", {
    feld,
    name,
    details,
    zusatz,
  });
}

/**
 * Beschreibung eines Szenarios aus seinen übrigen Festlegungen erzeugen.
 * Persistiert nichts – der Text geht ins Formularfeld.
 */
export function generateScenarioDescription(
  name: string,
  details: ScenarioDetails,
  zusatz = "",
) {
  return postJson<{ beschreibung: string }>("/api/scenario-description", {
    name,
    details,
    zusatz,
  });
}

/**
 * Handlungsentwurf für ein Szenario. Die Charaktere lädt die Route selbst über
 * die Id – der Client schickt nur die (womöglich ungespeicherten)
 * Festlegungen. Braucht ein **gespeichertes** Szenario mit mindestens einem
 * zugeordneten Charakter, sonst antwortet die Route mit einem Hinweis.
 */
export function generateScenarioPlot(
  scenarioId: string,
  name: string,
  details: ScenarioDetails,
  zusatz = "",
) {
  return postJson<{ handlung: string; characters: number }>(
    "/api/scenario-plot",
    { scenarioId, name, details, zusatz },
  );
}

/** Einzelnes Szenario samt seiner Charaktere (ohne Bild-Originale). */
export async function getScenario(
  id: string,
): Promise<{ scenario: StoredScenario; characters: StoredCharacter[] }> {
  const res = await fetch(`/api/scenarios/${id}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Laden fehlgeschlagen.");
  return data as { scenario: StoredScenario; characters: StoredCharacter[] };
}

export async function updateScenario(
  id: string,
  patch: { name?: string; details?: ScenarioDetails },
): Promise<StoredScenario> {
  const res = await fetch(`/api/scenarios/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Speichern fehlgeschlagen.");
  return data.scenario as StoredScenario;
}

export async function deleteScenario(id: string): Promise<void> {
  const res = await fetch(`/api/scenarios/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Szenario löschen fehlgeschlagen.");
  }
}

// --- Szenario-Bild --------------------------------------------------------

/**
 * Erzeugt das Weltbild eines Szenarios (ohne Figuren) und liefert es als
 * Data-URL. **Persistiert nichts** – gespeichert wird erst über
 * `saveScenarioImage`. Die Festlegungen gehen im aktuellen, womöglich
 * ungespeicherten Stand mit.
 */
export function generateScenarioImage(
  details: ScenarioDetails,
  imageStyle: string,
  options: { extraPrompt?: string; referenceImages?: string[] } = {},
) {
  return postJson<{ imageData: string }>("/api/scenario-image", {
    details,
    imageStyle,
    ...options,
  });
}

/**
 * Speichert (oder ersetzt) das Weltbild eines Szenarios. Das Thumbnail entsteht
 * hier im Client (`safeThumbnail`), damit keine Aufrufstelle es vergessen kann –
 * derselbe Weg wie bei `saveCharacter`/`addCharacterImage`.
 */
export async function saveScenarioImage(
  id: string,
  imageData: string,
): Promise<StoredScenario> {
  const res = await fetch(`/api/scenarios/${id}/image`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageData,
      thumbnail: await safeThumbnail(imageData),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Bild speichern fehlgeschlagen.");
  return data.scenario as StoredScenario;
}

export async function deleteScenarioImage(id: string): Promise<StoredScenario> {
  const res = await fetch(`/api/scenarios/${id}/image`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Löschen fehlgeschlagen.");
  return data.scenario as StoredScenario;
}

/**
 * Holt das Original des Weltbilds (~2 MB) – der einzige Weg daran, wie
 * `getImage` beim Charakter. Für Vollbild und Export.
 */
export async function getScenarioImage(id: string): Promise<string> {
  const res = await fetch(`/api/scenarios/${id}/image`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Bild laden fehlgeschlagen.");
  return data.imageData as string;
}
