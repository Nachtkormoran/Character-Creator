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
  ArcFormat,
  ArcLength,
  CharacterInput,
  CharacterTraits,
  GeneratedCharacter,
  Kapitel,
  KapitelCount,
  PlotPerson,
  PlotVariants,
  ScenarioDetails,
  ScenarioDraft,
  Settings,
  StoryArc,
  StoryArcVariants,
  StoryHookAnchor,
} from "./schema";
import type { StoredCharacter, StoredImage, StoredScenario } from "./serialize";
import type { InputField } from "./prompts";

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
  // `model` protokolliert, welches KI-Modell den Text erzeugt hat – der Aufrufer
  // hängt es beim Speichern an `input` an (s. `characterInputSchema.model`).
  return postJson<{ character: GeneratedCharacter; model: string }>(
    "/api/generate-text",
    input,
  );
}

/**
 * Ein einzelner Namensvorschlag. `traits` gibt es nur für bereits erzeugte
 * Charaktere (Galerie) und hat im Prompt Vorrang vor den Vorgaben.
 */
export function generateName(
  input: CharacterInput,
  traits?: CharacterTraits,
  /** Ausschlussliste gegen Wiederholungen – schon vorgeschlagene Namen. */
  vorhandene: string[] = [],
) {
  return postJson<{ name: string }>("/api/generate-name", {
    input,
    traits,
    vorhandene,
  });
}

/**
 * Befüllt ein einzelnes Formularfeld per KI (Aussehen, Persönlichkeit, Beruf,
 * Hintergrund) – das schlaue Gegenstück zum Würfel: Es liest die übrigen
 * Vorgaben mit und erzeugt Stimmiges im selben Umfang wie ein Wurf.
 */
export function generateInputField(feld: InputField, input: CharacterInput) {
  return postJson<{ wert: string }>("/api/generate-input-field", {
    feld,
    input,
  });
}

/**
 * **Zufällige Figur:** füllt das ganze Erstellen-Formular auf einmal. Bereits
 * ausgefüllte Felder bleiben (das erzwingt die Route), leere werden erfunden,
 * `prompt` ist die freie Themen-Vorgabe (leer = völliger Zufall). Das Genre
 * **bleibt** standardmäßig beim aktuell gewählten; nur mit `genreWuerfeln`
 * wählt die KI es passend zur Vorgabe. Zurück kommen nur die füllbaren Felder –
 * der Aufrufer legt sie über seinen Formularzustand (`imageStyle`/`model`
 * bleiben).
 */
export function generateRandomInput(
  input: CharacterInput,
  prompt: string,
  genreWuerfeln = false,
) {
  return postJson<{ input: Partial<CharacterInput> }>("/api/random-input", {
    input,
    prompt,
    genreWuerfeln,
  });
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

/**
 * Personen aus dem **Figuren-Feld** eines Szenarios, die ihm noch nicht
 * zugeordnet sind – wie `findPlotPersons`, nur mit den Figuren-Notizen als
 * Quelle. Nimmt bewusst auch Bezeichnungen für Personen auf, nicht nur
 * Eigennamen (s. Route). `figuren` kommt aus dem – womöglich ungespeicherten –
 * Formularzustand.
 */
export function findFigurePersons(scenarioId: string, figuren: string) {
  return postJson<{ personen: PlotPerson[] }>("/api/scenario-figure-persons", {
    scenarioId,
    figuren,
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
  /**
   * **Ohne Bilder** exportieren (Default `false` = mit Bildern). Dann bleibt die
   * Bild-Liste leer und die teuren `getImage`-Aufrufe entfallen – die Datei
   * trägt nur Texte, Merkmale und Vorgaben. Beim Import kommt der Charakter ohne
   * Bild an (ein gültiger Zustand; das Schema erlaubt `images: []`).
   */
  ohneBilder = false,
): Promise<CharacterPayload> {
  const images = ohneBilder
    ? []
    : await Promise.all(
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
  /** Ohne Bilder exportieren (Default `false` = mit Bildern). */
  ohneBilder = false,
): Promise<CharacterFile> {
  return {
    kind: CHARACTER_FILE_KIND,
    version: CHARACTER_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    ...(await buildCharacterPayload(c, character, storyHooks, ohneBilder)),
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
   * Bewusst **kein** ganzes `StoredScenario`: `id`, `createdAt` und `count`
   * gehören ausdrücklich nicht in die Datei (Begründung in `scenarioFile.ts`).
   * Mit dem engeren Typ kann die aufrufende Seite den **bearbeiteten** Stand
   * übergeben (Festlegungen, Varianten, Arc), ohne die übrigen Felder erfinden
   * zu müssen. `plotVariants` und `storyArc` sind optional – ein Szenario ohne
   * Entwürfe oder Arc lässt sie weg.
   */
  scenario: {
    name: string;
    details: ScenarioDetails;
    plotVariants?: PlotVariants;
    storyArc?: StoryArc;
    storyArcVariants?: StoryArcVariants;
  },
  characters: StoredCharacter[],
  /**
   * Die Weltbilder reisen über ihre Originale, nicht die Thumbnails – wie bei
   * den Charakter-Bildern. Die aufrufende Seite übergibt die `scenarioId` und
   * die Bild-Metadaten (ohne Originale); diese Funktion holt jedes Original
   * einzeln nach (`getScenarioImage`), damit die Seite sie nicht vorhalten muss.
   */
  bild?: { scenarioId: string; images: StoredImage[] },
  /**
   * **Ohne Bilder** exportieren (Default `false` = mit Bildern): dann bleibt das
   * **Weltbild** weg **und** jeder Charakter kommt bildlos in die Datei. Die
   * Datei trägt dann nur Texte/Festlegungen – klein und schnell.
   */
  ohneBilder = false,
): Promise<ScenarioFile> {
  // Die Weltbilder nur holen, wenn es welche gibt **und** Bilder gewünscht sind.
  // Nacheinander (nicht `Promise.all`): mehrere ~2-MB-Originale gleichzeitig im
  // Speicher zu halten wäre unnötige Spitzenlast – dieselbe Überlegung wie bei
  // den Charakteren unten.
  let images:
    | { imageData: string; thumbnail?: string | null; isPrimary: boolean }[]
    | undefined;
  if (!ohneBilder && bild && bild.images.length > 0) {
    images = [];
    for (const img of bild.images) {
      images.push({
        imageData: await getScenarioImage(bild.scenarioId, img.id),
        thumbnail: img.thumbnail ?? undefined,
        isPrimary: img.isPrimary,
      });
    }
  }

  return {
    kind: SCENARIO_FILE_KIND,
    version: SCENARIO_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    scenario: {
      name: scenario.name,
      details: scenario.details,
      // Nur mitgeben, was da ist: leere Varianten/Arc bleiben weg und die
      // Datei bleibt schlank (und mit älteren Ständen lesbar).
      ...(scenario.plotVariants && scenario.plotVariants.items.length > 0
        ? { plotVariants: scenario.plotVariants }
        : {}),
      ...(scenario.storyArc && scenario.storyArc.stufen.length > 0
        ? { storyArc: scenario.storyArc }
        : {}),
      // Alle Story Arcs mitgeben, sobald mehr als der eine aktive existiert –
      // sonst genügt `storyArc` oben (der Import faltet ihn zur einen Variante).
      ...(scenario.storyArcVariants &&
      scenario.storyArcVariants.items.length > 0
        ? { storyArcVariants: scenario.storyArcVariants }
        : {}),
      ...(images && images.length > 0 ? { images } : {}),
    },
    // Nacheinander statt `Promise.all`: Jeder Charakter zieht seine
    // Bild-Originale einzeln, und mehrere Figuren gleichzeitig legten
    // Dutzende Megabyte parallel in den Speicher. Ein Export darf ein paar
    // Sekunden dauern.
    characters: await characters.reduce<Promise<CharacterPayload[]>>(
      async (bisher, c) => [
        ...(await bisher),
        await buildCharacterPayload(c, undefined, undefined, ohneBilder),
      ],
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
 * Eine Figur als Protagonist ihres Szenarios markieren (oder die Markierung
 * aufheben). Wie die Zuordnung sofort persistiert; steuert den
 * Handlungsentwurf.
 */
export async function updateCharacterProtagonist(
  id: string,
  isProtagonist: boolean,
): Promise<StoredCharacter> {
  const res = await fetch(`/api/characters/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isProtagonist }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Markierung fehlgeschlagen.");
  return data.character as StoredCharacter;
}

/**
 * Einen Charakter **klonen** und die Kopie einem Szenario zuordnen (oder
 * keinem). Legt eine eigenständige neue Figur mit eigenen Bildern an; das
 * Original bleibt unangetastet. Gedacht für „Charakter hinzufügen" aus einem
 * Szenario, wenn die gewählte Figur schon zu einem anderen gehört – ein bloßes
 * Umhängen wäre dort ein Wegnehmen.
 */
export async function cloneCharacter(
  id: string,
  scenarioId: string | null,
): Promise<StoredCharacter> {
  const res = await fetch(`/api/characters/${id}/clone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Kopie fehlgeschlagen.");
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

/**
 * Ändert **nur das Genre** eines Charakters (Teil-PATCH `{ genre }`). Anders als
 * `updateCharacterContent` reist kein Text/Merkmal mit – die Route liest die
 * gespeicherten Vorgaben, setzt darin nur das Genre und schreibt zurück. Gebaut
 * für „Genre des Szenarios auf die zugeordneten Figuren übertragen".
 */
export async function updateCharacterGenre(
  id: string,
  genre: string,
): Promise<StoredCharacter> {
  const res = await fetch(`/api/characters/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ genre }),
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
 * Das Figuren-Feld eines Szenarios **ergänzen** – ein Set von etwa drei Figuren,
 * passend zu Genre, Ort, Zeit, Regeln und Beschreibung. Das schon Vorhandene
 * geht mit und bleibt erhalten; zurück kommt das ganze Feld. Persistiert nichts.
 */
export function generateScenarioFigures(
  name: string,
  details: ScenarioDetails,
  zusatz = "",
  /** Wie viele Figuren erzeugt/ergänzt werden (Selektor am Feld). */
  anzahl = 3,
) {
  return postJson<{ wert: string }>("/api/scenario-figures", {
    name,
    details,
    zusatz,
    anzahl,
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
 * **Zufälliges Szenario:** füllt das Anlege-Formular auf einmal (Name + Welt).
 * Bereits ausgefüllte Felder bleiben (das erzwingt die Route), leere werden
 * erfunden. Das Genre **bleibt** standardmäßig beim gewählten; nur mit
 * `genreWuerfeln` wählt die KI es passend. Der **Handlungsentwurf** wird nicht
 * erzeugt (braucht Figuren) und bleibt unverändert. `prompt` = freie Vorgabe.
 */
export function generateRandomScenario(
  name: string,
  details: ScenarioDetails,
  prompt: string,
  genreWuerfeln = false,
) {
  return postJson<{ name: string; details: ScenarioDetails }>(
    "/api/random-scenario",
    { name, details, prompt, genreWuerfeln },
  );
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
  /**
   * Ein bestehender Handlungsentwurf als Grundlage (Checkbox „aktuellen
   * Handlungsentwurf verwenden"). Leer = wie bisher aus Welt und Figuren.
   */
  basis = "",
  /**
   * „Handlung weiterspinnen": eine vollständige Geschichte statt einer offenen
   * Ausgangslage. Unabhängig von `basis`.
   */
  weiterspinnen = false,
  /** Ton und Sprache (`STORY_TONES`-Wert). Leer/`neutral` = wie bisher. */
  ton = "",
  /**
   * Wie viele **neue benannte Personen** der Entwurf zusätzlich einführen soll
   * (0 = keine). Auf `MAX_NEUE_PLOT_PERSONEN` gedeckelt.
   */
  neuePersonen = 0,
  /** Optionale Namens-/Rollen-Vorgaben zu den neuen Personen (Freitext). */
  neuePersonenWunsch = "",
  /** Erzählform (`STORY_FORMS`-Wert). Leer/`allround` = gemischt wie bisher. */
  form = "",
  /**
   * Modell-Anbieter für **diesen** Aufruf (`TEXT_PROVIDERS`-Wert). Leer =
   * die Einstellung greift (Standard).
   */
  textProvider = "",
  /**
   * **Entwurf fortsetzen** statt neu erzeugen: `basis` (der vorhandene Entwurf)
   * wird fortgeführt, und die Antwort ist **nur die Fortsetzung** – der Aufrufer
   * hängt sie an den vorhandenen Text an. Braucht `basis`.
   */
  fortsetzen = false,
) {
  return postJson<{ handlung: string; characters: number; model: string }>(
    "/api/scenario-plot",
    {
      scenarioId,
      name,
      details,
      zusatz,
      basis,
      weiterspinnen,
      fortsetzen,
      ton,
      neuePersonen,
      neuePersonenWunsch,
      form,
      textProvider,
    },
  );
}

/**
 * Erzeugt einen **kurzen Titel** für einen Handlungsentwurf oder Story Arc
 * (`POST /api/story-title`) – für die Reiter-Leiste. Persistiert nichts; der
 * Aufrufer hängt den Titel an die Variante und speichert ihn über
 * `updateScenario`.
 */
export async function generateStoryTitle(
  text: string,
  art: "entwurf" | "arc" = "entwurf",
): Promise<string> {
  const res = await fetch("/api/story-title", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, art }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Titel fehlgeschlagen.");
  return (data.titel as string) ?? "";
}

/**
 * Leitet den **Story Arc** aus dem aktiven Handlungsentwurf ab. Wie
 * `generateScenarioPlot` lädt die Route die Figuren selbst über die `scenarioId`
 * (Rückbindung der Stationen); der Entwurf kommt im aktuellen, womöglich
 * ungespeicherten Stand aus dem Request. **Persistiert nichts** – gespeichert
 * wird über `updateScenario({ storyArc })`.
 */
export function generateStoryArc(
  scenarioId: string,
  handlung: string,
  options: {
    laenge?: ArcLength;
    format?: ArcFormat;
    zusatz?: string;
    kreativ?: boolean;
    weiterspinnen?: boolean;
    ton?: string;
    /** Erzählform (`STORY_FORMS`-Wert). Leer/`allround` = ohne Erzählform-Block. */
    form?: string;
    /**
     * Wichtige Figuren (`details.figuren`) – Notizen, die als zusätzliche
     * Besetzung in den Arc eingehen. Leer = wie bisher.
     */
    figuren?: string;
    /** Modell-Anbieter für diesen Aufruf (`TEXT_PROVIDERS`). Leer = Einstellung. */
    textProvider?: string;
  } = {},
) {
  return postJson<{ storyArc: StoryArc; model: string }>("/api/scenario-arc", {
    scenarioId,
    handlung,
    ...options,
  });
}

/**
 * Leitet die **Kapitel einer Story-Arc-Station** ab (zwei bis drei). Die Route
 * braucht weder `scenarioId` noch die Charaktere – die Station trägt alles in
 * sich. **Persistiert nichts**; gespeichert wird über `updateScenario`.
 */
export function generateStoryArcChapters(
  stufe: {
    titel: string;
    beschreibung: string;
    figuren: string[];
  },
  options: {
    kreativ?: boolean;
    anzahl?: KapitelCount;
    ton?: string;
    /** Erzählform (`STORY_FORMS`-Wert). Leer/`allround` = ohne Erzählform-Block. */
    form?: string;
    /** Modell-Anbieter für diesen Aufruf (`TEXT_PROVIDERS`). Leer = Einstellung. */
    textProvider?: string;
  } = {},
) {
  return postJson<{ kapitel: Kapitel[]; model: string }>("/api/story-arc-chapters", {
    stufe,
    ...options,
  });
}

/**
 * Erzeugt den **ausformulierten Prosatext eines Kapitels** (Personen +
 * Tätigkeiten, Atmosphäre, Dialog in wörtlicher Rede). Wie `scenario-plot` lädt
 * die Route die Figuren selbst über die `scenarioId`; Festlegungen und Kapitel
 * kommen im aktuellen Stand aus dem Request. **Persistiert nichts** –
 * gespeichert wird über `updateScenario`.
 */
export function generateChapterText(
  scenarioId: string,
  details: ScenarioDetails,
  stufe: { titel: string; beschreibung: string; figuren: string[] },
  /** **Alle** Kapitel der Station (in Reihenfolge) – der Prompt braucht die
   * Grenzen, damit nur das gewählte ausgeschrieben wird. */
  kapitelListe: { titel: string; inhalt: string }[],
  /** Index des auszuschreibenden Kapitels in `kapitelListe`. */
  kapitelIndex: number,
  options: {
    ton?: string;
    kreativ?: boolean;
    /** Erzählform (`STORY_FORMS`-Wert). Leer/`allround` = ohne Erzählform-Block. */
    form?: string;
    /** Kapitellänge (`KAPITEL_LAENGEN`-Wert) – steuert die Prosalänge. */
    kapitelLaenge?: string;
    /** Werkform (`WERKFORMEN`-Wert) – prägt den Prosastil. */
    werkform?: string;
    /** Modell-Anbieter für diesen Aufruf (`TEXT_PROVIDERS`). Leer = Einstellung. */
    textProvider?: string;
  } = {},
) {
  return postJson<{ text: string; model: string }>("/api/story-chapter-text", {
    scenarioId,
    details,
    stufe,
    kapitelListe,
    kapitelIndex,
    ...options,
  });
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
  patch: {
    name?: string;
    details?: ScenarioDetails;
    plotVariants?: PlotVariants;
    storyArc?: StoryArc;
    storyArcVariants?: StoryArcVariants;
  },
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

/**
 * Erzeugt einen **Namen für ein Szenario** aus seinen Welt-Feldern
 * (Beschreibung, Ort, Zeit, Regeln) – Freitext wie `generateStoryTitle`.
 * **Persistiert nichts**; der Aufrufer setzt den Namen ins Feld und speichert
 * ihn über „Änderungen speichern". Die Festlegungen gehen im aktuellen,
 * womöglich ungespeicherten Stand mit.
 */
export async function generateScenarioName(
  details: ScenarioDetails,
): Promise<string> {
  const res = await fetch("/api/scenario-name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ details }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Name fehlgeschlagen.");
  return (data.name as string) ?? "";
}

// --- Szenario-Bild --------------------------------------------------------

/**
 * Erzeugt ein Weltbild eines Szenarios (ohne Figuren) und liefert es als
 * Data-URL. **Persistiert nichts** – gespeichert wird erst über
 * `addScenarioImage`. Die Festlegungen gehen im aktuellen, womöglich
 * ungespeicherten Stand mit.
 */
export function generateScenarioImage(
  details: ScenarioDetails,
  imageStyle: string,
  options: {
    extraPrompt?: string;
    referenceImages?: string[];
    /** Bild ohne Figuren (Default an). Aus = „keine Personen" fällt weg. */
    ohneMenschen?: boolean;
  } = {},
) {
  return postJson<{ imageData: string }>("/api/scenario-image", {
    details,
    imageStyle,
    ...options,
  });
}

/**
 * Hängt ein weiteres Weltbild an das Szenario. Es wird dabei zum Primärbild –
 * genau wie beim Charakter (`addCharacterImage`). Das Thumbnail entsteht hier im
 * Client (`safeThumbnail`), damit keine Aufrufstelle es vergessen kann.
 */
export async function addScenarioImage(
  id: string,
  imageData: string,
): Promise<StoredScenario> {
  const res = await fetch(`/api/scenarios/${id}/images`, {
    method: "POST",
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

export async function setPrimaryScenarioImage(
  id: string,
  imageId: string,
): Promise<StoredScenario> {
  const res = await fetch(`/api/scenarios/${id}/images/${imageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isPrimary: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Auswahl fehlgeschlagen.");
  return data.scenario as StoredScenario;
}

export async function deleteScenarioImage(
  id: string,
  imageId: string,
): Promise<StoredScenario> {
  const res = await fetch(`/api/scenarios/${id}/images/${imageId}`, {
    method: "DELETE",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Löschen fehlgeschlagen.");
  return data.scenario as StoredScenario;
}

/**
 * Holt das Original eines Weltbilds (~2 MB) – der einzige Weg daran, wie
 * `getImage` beim Charakter. Für Vollbild und Export.
 */
export async function getScenarioImage(
  id: string,
  imageId: string,
): Promise<string> {
  const res = await fetch(`/api/scenarios/${id}/images/${imageId}`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Bild laden fehlgeschlagen.");
  return data.imageData as string;
}
