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
] as const;

export const DEFAULT_IMAGE_STYLE = "illustration";

export const characterInputSchema = z.object({
  // Grundlegende Vorgaben
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
  besondereMerkmale: z
    .string()
    .describe("Auffällige/besondere Merkmale, z. B. Narben, Tattoos, Brille"),
  persoenlichkeit: z
    .string()
    .describe(
      "3–5 zentrale Persönlichkeitsmerkmale / Charaktereigenschaften, kommagetrennt, z. B. 'warmherzig, neugierig, durchsetzungsstark'",
    ),
});

export type CharacterTraits = z.infer<typeof characterTraitsSchema>;

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
  besondereMerkmale: "Besondere Merkmale",
  persoenlichkeit: "Persönlichkeit",
};

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
