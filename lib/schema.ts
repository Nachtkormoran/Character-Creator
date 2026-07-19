import { z } from "zod";

/**
 * Zentrale Schemas & Typen für den Charakter Creator.
 *
 * - `characterInputSchema`  → die Formular-Eingaben des Nutzers (Vorgaben)
 * - `characterTraitsSchema` → die strukturierten Körper-/Charaktermerkmale,
 *                             die das LLM zurückliefert (für die Tabelle)
 * - `generatedCharacterSchema` → das komplette Ergebnis des LLM
 */

// ---------------------------------------------------------------------------
// Eingaben (Formular)
// ---------------------------------------------------------------------------

export const GENDERS = ["weiblich", "männlich", "divers", "egal"] as const;

// Reihenfolge bestimmt die Anzeige; der erste Eintrag ist der Default.
export const IMAGE_STYLES = [
  { value: "illustration", label: "Illustration" },
  { value: "malerisch", label: "Malerisch" },
  { value: "fotorealistisch", label: "Fotorealistisch" },
  { value: "skizze", label: "Skizze" },
] as const;

export const DEFAULT_IMAGE_STYLE = "illustration";

// ---------------------------------------------------------------------------
// Bildmodelle (Einstellungen)
// ---------------------------------------------------------------------------

/**
 * Auswählbare Bildmodelle. Bewusst eine Allowlist: die Auswahl kommt aus dem
 * Browser und darf nicht zu einem beliebigen Modellnamen führen.
 */
export const IMAGE_MODELS = [
  {
    value: "gpt-image-1",
    label: "gpt-image-1",
    hint: "Bisheriges Modell – erzeugt den gewohnten Look. Wird am 23.10.2026 eingestellt.",
  },
  {
    value: "gpt-image-1-mini",
    label: "gpt-image-1-mini",
    hint: "Abgespeckte Variante desselben Modells – deutlich günstiger.",
  },
  {
    value: "gpt-image-1.5",
    label: "gpt-image-1.5",
    hint: "Nachfolger von gpt-image-1, anderes Bildergebnis.",
  },
  {
    value: "gpt-image-2",
    label: "gpt-image-2",
    hint: "Neueste Generation, in der niedrigen Stufe sehr günstig.",
  },
] as const;

export type ImageModel = (typeof IMAGE_MODELS)[number]["value"];

/** Default bleibt gpt-image-1, damit sich am gewohnten Ergebnis nichts ändert. */
export const DEFAULT_IMAGE_MODEL: ImageModel = "gpt-image-1";

export const imageModelSchema = z.enum(
  IMAGE_MODELS.map((m) => m.value) as [ImageModel, ...ImageModel[]],
);

/** Qualitätsstufen, die die OpenAI-Bild-API kennt. */
export const IMAGE_QUALITIES = [
  { value: "low", label: "Niedrig" },
  { value: "medium", label: "Mittel" },
  { value: "high", label: "Hoch" },
] as const;

export type ImageQuality = (typeof IMAGE_QUALITIES)[number]["value"];

/** Default bleibt `medium` – die bisher fest verdrahtete Stufe. */
export const DEFAULT_IMAGE_QUALITY: ImageQuality = "medium";

export const imageQualitySchema = z.enum(
  IMAGE_QUALITIES.map((q) => q.value) as [ImageQuality, ...ImageQuality[]],
);

/**
 * Ungefähre Kosten pro Bild in USD bei 1024×1024.
 *
 * Stand 18.07.2026, aus öffentlichen Preisvergleichen – **ohne Gewähr**.
 * `null` = kein belastbarer Wert gefunden; die Quellen widersprechen sich vor
 * allem in der `high`-Stufe. Nur zur Einordnung, nicht zur Abrechnung.
 */
export const IMAGE_PRICES_USD: Record<
  ImageModel,
  Record<ImageQuality, number | null>
> = {
  "gpt-image-1": { low: 0.011, medium: 0.042, high: 0.167 },
  "gpt-image-1-mini": { low: 0.005, medium: 0.011, high: 0.036 },
  "gpt-image-1.5": { low: 0.009, medium: 0.034, high: 0.2 },
  "gpt-image-2": { low: 0.006, medium: 0.053, high: 0.211 },
};

export const IMAGE_PRICES_AS_OF = "18.07.2026";

/**
 * Was der Client schicken darf – hier greift die Allowlist.
 */
export const settingsPatchSchema = z.object({
  imageModel: imageModelSchema,
  imageQuality: imageQualitySchema,
});

/**
 * Was der Server zurückgibt. Bewusst `string` und nicht `ImageModel`: ein über
 * `OPENAI_IMAGE_MODEL` gesetztes Modell ist serverseitige Konfiguration und
 * wird respektiert, auch wenn es nicht in der Auswahlliste steht.
 */
export interface Settings {
  imageModel: string;
  imageQuality: ImageQuality;
}

/** Steht das Modell in der Auswahlliste (oder kommt es aus der Env)? */
export function isKnownImageModel(value: string): value is ImageModel {
  return IMAGE_MODELS.some((m) => m.value === value);
}

export const characterInputSchema = z.object({
  // Grundlegende Vorgaben
  /**
   * Wunschname, optional. Ein einzelnes Wort wird als Vorname verstanden und
   * vom Modell um einen Nachnamen ergänzt (s. `buildTextPrompt`).
   */
  name: z.string().trim().max(120).optional().default(""),
  gender: z.enum(GENDERS).default("egal"),
  age: z.string().trim().max(60).optional().default(""),
  ethnicity: z.string().trim().max(120).optional().default(""),

  // Aussehen
  appearance: z.string().trim().max(1500).optional().default(""),

  // Hintergrund / Kontext
  setting: z.string().trim().max(200).optional().default(""),
  occupation: z.string().trim().max(200).optional().default(""),
  background: z.string().trim().max(2000).optional().default(""),
  personality: z.string().trim().max(1000).optional().default(""),

  // Freitext für alles Weitere
  notes: z.string().trim().max(2000).optional().default(""),

  // Bild-Stil
  imageStyle: z
    .enum(IMAGE_STYLES.map((s) => s.value) as [string, ...string[]])
    .default(DEFAULT_IMAGE_STYLE),
});

export type CharacterInput = z.infer<typeof characterInputSchema>;

// ---------------------------------------------------------------------------
// Merkmale (LLM-Ausgabe, strukturiert → Tabelle)
// ---------------------------------------------------------------------------

export const characterTraitsSchema = z.object({
  alter: z.number().describe("Alter in Jahren (ganze Zahl)"),
  geschlecht: z.string().describe("Geschlecht des Charakters"),
  groesse: z.string().describe("Körpergröße inkl. Einheit, z. B. '178 cm'"),
  gewicht: z.string().describe("Gewicht inkl. Einheit, z. B. '72 kg'"),
  koerperbau: z.string().describe("Körperbau, z. B. 'athletisch', 'schlank'"),
  haarfarbe: z.string().describe("Haarfarbe"),
  frisur: z.string().describe("Frisur / Haarlänge"),
  augenfarbe: z.string().describe("Augenfarbe"),
  hautton: z.string().describe("Hautton / Teint"),
  herkunft: z.string().describe("Herkunft / Ethnie"),
  wohnort: z
    .string()
    .describe(
      "Aktueller Wohnort – Stadt bzw. Ort, ggf. mit Land, z. B. 'Lissabon' oder 'kleines Dorf in Nordnorwegen'",
    ),
  beruf: z
    .string()
    .describe(
      "Ausgeübter Beruf oder Rolle, z. B. 'Bibliothekarin', 'Bootsbauer', 'Studentin der Philosophie'",
    ),
  besondereMerkmale: z
    .string()
    .describe("Auffällige/besondere Merkmale, z. B. Narben, Tattoos, Brille"),
  persoenlichkeit: z
    .string()
    .describe(
      "3–5 zentrale Persönlichkeitsmerkmale / Charaktereigenschaften, kommagetrennt, z. B. 'warmherzig, neugierig, durchsetzungsstark'",
    ),
  interessen: z
    .string()
    .describe(
      "2–5 Interessen, Hobbys oder Freizeitbeschäftigungen, kommagetrennt, passend zu Beruf, Herkunft und Wesen des Charakters, z. B. 'Bergwandern, Schallplatten sammeln, Schach'",
    ),
});

export type CharacterTraits = z.infer<typeof characterTraitsSchema>;

/**
 * Ergänzt fehlende Merkmale mit leeren Werten.
 *
 * Ältere Charaktere wurden gespeichert, bevor einzelne Merkmale (z. B.
 * `persoenlichkeit`) eingeführt wurden. Ohne diese Auffüllung scheitert jede
 * spätere Validierung gegen `characterTraitsSchema` – Bildgenerierung und
 * Bearbeiten wären für solche Datensätze blockiert.
 */
export function normalizeTraits(raw: unknown): CharacterTraits {
  const source = (raw ?? {}) as Record<string, unknown>;
  const result = {} as Record<string, unknown>;

  for (const key of Object.keys(TRAIT_LABELS) as Array<keyof CharacterTraits>) {
    const value = source[key];
    if (key === "alter") {
      const n = typeof value === "number" ? value : parseInt(String(value), 10);
      result[key] = Number.isFinite(n) ? n : 0;
    } else {
      result[key] = typeof value === "string" ? value : "";
    }
  }
  return result as CharacterTraits;
}

/**
 * Wendet eine (String-)Änderung auf ein Merkmal an und liefert ein neues
 * Merkmals-Objekt. `alter` wird dabei in eine Zahl konvertiert.
 */
export function withTrait(
  merkmale: CharacterTraits,
  key: keyof CharacterTraits,
  value: string,
): CharacterTraits {
  if (key === "alter") {
    const n = parseInt(value, 10);
    return { ...merkmale, alter: Number.isNaN(n) ? 0 : n };
  }
  return { ...merkmale, [key]: value } as CharacterTraits;
}

/** Reihenfolge & Anzeigenamen für die Merkmals-Tabelle. */
export const TRAIT_LABELS: Record<keyof CharacterTraits, string> = {
  alter: "Alter",
  geschlecht: "Geschlecht",
  groesse: "Größe",
  gewicht: "Gewicht",
  koerperbau: "Körperbau",
  haarfarbe: "Haarfarbe",
  frisur: "Frisur",
  augenfarbe: "Augenfarbe",
  hautton: "Hautton",
  herkunft: "Herkunft",
  wohnort: "Wohnort",
  beruf: "Beruf",
  besondereMerkmale: "Besondere Merkmale",
  persoenlichkeit: "Persönlichkeit",
  interessen: "Interessen und Hobbies",
};

/**
 * Reihenfolge & Anzeigenamen der **Formular-Vorgaben** (`CharacterInput`) für
 * die Vorgaben-Ansicht in der Galerie. Reihenfolge wie im Erstellen-Formular,
 * damit die Ansicht sich liest wie das ausgefüllte Formular.
 *
 * Diese Karte ist zugleich die Feldliste der Anzeige: Charaktere aus älteren
 * Ständen haben nicht alle Schlüssel im gespeicherten JSON. Über die Labels zu
 * laufen statt über die Schlüssel des Objekts zeigt solche Felder als leer an,
 * statt sie stillschweigend zu unterschlagen.
 */
export const INPUT_LABELS: Record<keyof CharacterInput, string> = {
  name: "Wunschname",
  gender: "Geschlecht",
  age: "Alter",
  ethnicity: "Herkunft / Ethnie",
  appearance: "Aussehen",
  personality: "Persönlichkeit",
  setting: "Setting / Genre",
  occupation: "Beruf / Rolle",
  background: "Hintergrund",
  notes: "Weitere Wünsche",
  imageStyle: "Bild-Stil",
};

/**
 * Anzeigewert einer einzelnen Vorgabe. `imageStyle` wird auf sein Label
 * abgebildet („illustration" → „Illustration"), alles andere bleibt Freitext.
 * Leer bleibt leer – die Anzeige entscheidet, wie sie das darstellt.
 */
export function inputDisplayValue(
  key: keyof CharacterInput,
  input: Partial<CharacterInput>,
): string {
  const raw = input[key];
  if (typeof raw !== "string" || raw.trim() === "") return "";
  if (key === "imageStyle") {
    return IMAGE_STYLES.find((s) => s.value === raw)?.label ?? raw;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Ansatzpunkte für eine Geschichte
// ---------------------------------------------------------------------------

/**
 * Wie fest die Ansatzpunkte am Charakter hängen sollen.
 *
 * Ohne diese Wahl driftet das Modell verlässlich ins Allgemeine: ein
 * Zufallsfund, ein anonymer Hinweis, ein Netz von Intrigen – Aufhänger, die an
 * jede beliebige Figur passen und deshalb an keiner etwas erzählen. Die Stufe
 * steuert genau eine Frage: **darf Neues erfunden werden, und wie viel?**
 *
 * Default ist `eng`, nicht die Mitte. Wer die Ansatzpunkte gerade erst hat
 * ableiten lassen, will sehen, was in der Figur schon drinsteckt; auf Effekt
 * spielen kann man danach immer noch.
 */
export const STORY_HOOK_ANCHORS = [
  {
    value: "eng",
    label: "Eng am Charakter",
    hint: "Nur aus dem, was schon dasteht. Keine neuen Personen, Orte oder Ereignisse.",
  },
  {
    value: "mittel",
    label: "Etwas Spielraum",
    hint: "Je Ansatzpunkt ein neues Element, das aus etwas Vorhandenem folgt.",
  },
  {
    value: "frei",
    label: "Freie Hand",
    hint: "Der Charakter ist Ausgangspunkt; die Handlung darf weit ausgreifen.",
  },
] as const;

export type StoryHookAnchor = (typeof STORY_HOOK_ANCHORS)[number]["value"];

export const DEFAULT_STORY_HOOK_ANCHOR: StoryHookAnchor = "eng";

export const storyHookAnchorSchema = z.enum(
  STORY_HOOK_ANCHORS.map((a) => a.value) as [
    StoryHookAnchor,
    ...StoryHookAnchor[],
  ],
);

// ---------------------------------------------------------------------------
// Vollständiges generiertes Ergebnis
// ---------------------------------------------------------------------------

export const generatedCharacterSchema = z.object({
  name: z.string().describe("Vollständiger, zum Charakter passender Name"),
  kurzbeschreibung: z
    .string()
    .describe("Ein bis zwei Sätze, die den Charakter auf den Punkt bringen"),
  beschreibung: z
    .string()
    .describe(
      "Ausführlicher Fließtext (mehrere Absätze) über Aussehen, Persönlichkeit und Hintergrund des Charakters",
    ),
  merkmale: characterTraitsSchema,
});

export type GeneratedCharacter = z.infer<typeof generatedCharacterSchema>;
