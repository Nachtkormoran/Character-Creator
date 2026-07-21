import { prisma } from "./prisma";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_QUALITY,
  DEFAULT_TEXT_PROVIDER,
  imageModelSchema,
  imageQualitySchema,
  textProviderSchema,
  type ImageModel,
  type ImageQuality,
  type Settings,
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

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany({
    where: {
      key: { in: [IMAGE_MODEL_KEY, IMAGE_QUALITY_KEY, TEXT_PROVIDER_KEY] },
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

  return { imageModel, imageQuality, textProvider };
}

/** Speichert einzelne Einstellungen und liefert den neuen Gesamtstand. */
export async function updateSettings(patch: {
  imageModel?: ImageModel;
  imageQuality?: ImageQuality;
  textProvider?: TextProvider;
}): Promise<Settings> {
  const writes: Array<[string, string]> = [];
  if (patch.imageModel) writes.push([IMAGE_MODEL_KEY, patch.imageModel]);
  if (patch.imageQuality) writes.push([IMAGE_QUALITY_KEY, patch.imageQuality]);
  if (patch.textProvider)
    writes.push([TEXT_PROVIDER_KEY, patch.textProvider]);

  for (const [key, value] of writes) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  return getSettings();
}
