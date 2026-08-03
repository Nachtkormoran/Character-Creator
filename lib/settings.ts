import { prisma } from "./prisma";
import {
  DEFAULT_GEMINI_TEXT_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_QUALITY,
  DEFAULT_TEXT_PROVIDER,
  geminiTextModelSchema,
  imageModelSchema,
  imageQualitySchema,
  STORY_GENERATIONS,
  textProviderSchema,
  type GeminiTextModel,
  type ImageModel,
  type ImageQuality,
  type Settings,
  type StoryGeneration,
  type StoryModels,
  type TextProvider,
} from "./schema";

/**
 * Serverseitiger Zugriff auf die App-Einstellungen (Tabelle `Setting`,
 * Key-Value). Nur in API-Routen verwenden – greift auf die Datenbank zu.
 *
 * Vorrang: gespeicherter Wert → Env → Default. Die Env wirkt damit als
 * Vorbelegung, solange nichts in der UI gewählt wurde, und bleibt für
 * Deployments ohne UI-Zugriff nutzbar.
 */

const IMAGE_MODEL_KEY = "imageModel";
const IMAGE_QUALITY_KEY = "imageQuality";
const TEXT_PROVIDER_KEY = "textProvider";
const GEMINI_TEXT_MODEL_KEY = "geminiTextModel";
const SHOW_MODEL_KEY = "showModel";
const USE_MODEL_OVERRIDES_KEY = "useModelOverrides";

/** `Setting`-Key für den Anbieter einer Story-Erzeugung, z. B. `storyModel.plot`. */
function storyModelKey(generation: StoryGeneration): string {
  return `storyModel.${generation}`;
}

/** Env-Vorbelegung je Story-Erzeugung, z. B. `STORY_MODEL_PLOT`. */
function storyModelEnv(generation: StoryGeneration): string | undefined {
  return process.env[`STORY_MODEL_${generation.toUpperCase()}`];
}

/** Boolean aus dem Key-Value-Store ("true"/"false"); null bei Unbekanntem. */
function parseBool(value: string | undefined | null): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

/** Prüft einen Wert gegen die Allowlist; liefert null, wenn er nicht passt. */
function parseImageModel(value: string | undefined | null): ImageModel | null {
  const result = imageModelSchema.safeParse(value);
  return result.success ? result.data : null;
}

function parseImageQuality(
  value: string | undefined | null,
): ImageQuality | null {
  const result = imageQualitySchema.safeParse(value);
  return result.success ? result.data : null;
}

function parseTextProvider(
  value: string | undefined | null,
): TextProvider | null {
  const result = textProviderSchema.safeParse(value);
  return result.success ? result.data : null;
}

function parseGeminiTextModel(
  value: string | undefined | null,
): GeminiTextModel | null {
  const result = geminiTextModelSchema.safeParse(value);
  return result.success ? result.data : null;
}

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          IMAGE_MODEL_KEY,
          IMAGE_QUALITY_KEY,
          TEXT_PROVIDER_KEY,
          GEMINI_TEXT_MODEL_KEY,
          SHOW_MODEL_KEY,
          USE_MODEL_OVERRIDES_KEY,
          ...STORY_GENERATIONS.map((g) => storyModelKey(g.value)),
        ],
      },
    },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  // Gespeicherte Werte stammen aus dem Browser → gegen die Allowlist prüfen.
  // Der Env-Wert ist serverseitige Konfiguration und wird unverändert
  // übernommen, auch wenn er nicht in der Auswahlliste steht.
  const imageModel =
    parseImageModel(byKey.get(IMAGE_MODEL_KEY)) ??
    process.env.OPENAI_IMAGE_MODEL?.trim() ??
    DEFAULT_IMAGE_MODEL;

  // Bei der Qualität gibt es keinen Env-Escape-Hatch: die API kennt nur diese
  // drei Stufen, ein freier Wert würde nur zur Laufzeit scheitern.
  const imageQuality =
    parseImageQuality(byKey.get(IMAGE_QUALITY_KEY)) ??
    parseImageQuality(process.env.OPENAI_IMAGE_QUALITY) ??
    DEFAULT_IMAGE_QUALITY;

  // Wie beim Bildmodell: gespeicherter Wert → Env (`TEXT_PROVIDER`) → Default.
  const textProvider =
    parseTextProvider(byKey.get(TEXT_PROVIDER_KEY)) ??
    parseTextProvider(process.env.TEXT_PROVIDER) ??
    DEFAULT_TEXT_PROVIDER;

  // Gemini-Modell wie das Bildmodell: gespeicherter Wert (Allowlist) → Env
  // (`GEMINI_TEXT_MODEL`, ungeprüfter Escape-Hatch für nicht gelistete Modelle)
  // → Default. Wirkt nur, wenn der Anbieter Gemini ist.
  const geminiTextModel =
    parseGeminiTextModel(byKey.get(GEMINI_TEXT_MODEL_KEY)) ??
    process.env.GEMINI_TEXT_MODEL?.trim() ??
    DEFAULT_GEMINI_TEXT_MODEL;

  // Reine Anzeige-Einstellung, Default aus. Wie oben: gespeichert → Env → Default.
  const showModel =
    parseBool(byKey.get(SHOW_MODEL_KEY)) ??
    parseBool(process.env.SHOW_MODEL) ??
    false;

  // Ob die Detaileinstellungen (Modell je Story-Erzeugung) greifen. Default aus,
  // damit sich ohne Zutun nichts am Verhalten ändert. Gespeichert → Env → Default.
  const useModelOverrides =
    parseBool(byKey.get(USE_MODEL_OVERRIDES_KEY)) ??
    parseBool(process.env.USE_MODEL_OVERRIDES) ??
    false;

  // Anbieter je Story-Erzeugung – vollständige Karte. Ein fehlender Eintrag
  // fällt auf den globalen `textProvider` zurück, damit das Einschalten der
  // Detaileinstellungen ohne weitere Wahl exakt dem globalen Modell entspricht
  // (keine Überraschung). Gespeichert → Env (`STORY_MODEL_<GEN>`) → textProvider.
  const storyModels = Object.fromEntries(
    STORY_GENERATIONS.map((g) => [
      g.value,
      parseTextProvider(byKey.get(storyModelKey(g.value))) ??
        parseTextProvider(storyModelEnv(g.value)) ??
        textProvider,
    ]),
  ) as StoryModels;

  return {
    imageModel,
    imageQuality,
    textProvider,
    geminiTextModel,
    showModel,
    useModelOverrides,
    storyModels,
  };
}

/** Speichert einzelne Einstellungen und liefert den neuen Gesamtstand. */
export async function updateSettings(patch: {
  imageModel?: ImageModel;
  imageQuality?: ImageQuality;
  textProvider?: TextProvider;
  geminiTextModel?: GeminiTextModel;
  showModel?: boolean;
  useModelOverrides?: boolean;
  storyModels?: Partial<StoryModels>;
}): Promise<Settings> {
  const writes: Array<[string, string]> = [];
  if (patch.imageModel) writes.push([IMAGE_MODEL_KEY, patch.imageModel]);
  if (patch.imageQuality) writes.push([IMAGE_QUALITY_KEY, patch.imageQuality]);
  if (patch.textProvider)
    writes.push([TEXT_PROVIDER_KEY, patch.textProvider]);
  if (patch.geminiTextModel)
    writes.push([GEMINI_TEXT_MODEL_KEY, patch.geminiTextModel]);
  // Boolean: explizit auf undefined prüfen, sonst würde `false` verschluckt.
  if (patch.showModel !== undefined)
    writes.push([SHOW_MODEL_KEY, String(patch.showModel)]);
  if (patch.useModelOverrides !== undefined)
    writes.push([USE_MODEL_OVERRIDES_KEY, String(patch.useModelOverrides)]);
  // Nur die mitgeschickten Story-Erzeugungen schreiben (Teil-Update).
  if (patch.storyModels) {
    for (const g of STORY_GENERATIONS) {
      const value = patch.storyModels[g.value];
      if (value) writes.push([storyModelKey(g.value), value]);
    }
  }

  for (const [key, value] of writes) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  return getSettings();
}
