import { toFile } from "openai";
import { getOpenAI, IMAGE_MODEL } from "./openai";
import { DEFAULT_IMAGE_QUALITY, type ImageQuality } from "./schema";

/**
 * Abstraktion für die Bildgenerierung.
 *
 * Aktuell gibt es nur einen OpenAI-Provider (gpt-image-*). Durch dieses
 * Interface lässt sich später ein anderer Anbieter (z. B. Flux via Replicate)
 * ergänzen, ohne den restlichen Code anzupassen.
 */
export interface GenerateOptions {
  model?: string;
  quality?: ImageQuality;
  /**
   * Stil-/Motivvorlagen als Data-URLs. Sind welche gesetzt, läuft die
   * Erzeugung über `images.edit` statt `images.generate`.
   */
  referenceImages?: string[];
}

export interface ImageProvider {
  /**
   * Erzeugt ein Portrait und liefert es als Data-URL (base64) zurück.
   * Modell und Qualität kommen aus den Einstellungen (s. `lib/settings.ts`);
   * ohne Angabe gilt die Env-/Default-Vorbelegung.
   */
  generatePortrait(prompt: string, options?: GenerateOptions): Promise<string>;
}

/** Modelle, die `images.edit` (und damit Referenzbilder) nicht unterstützen. */
const MODELS_WITHOUT_EDIT = ["gpt-image-2"];

/** Wandelt eine Data-URL in eine für die OpenAI-API taugliche Datei. */
async function dataUrlToFile(dataUrl: string, index: number) {
  // [\s\S] statt dem s-Flag: das Compile-Target der App ist älter als ES2018.
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Referenzbild hat kein gültiges Format.");
  }
  const [, mime, base64] = match;
  const extension = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
  return toFile(Buffer.from(base64, "base64"), `reference-${index}.${extension}`, {
    type: mime,
  });
}

class OpenAIImageProvider implements ImageProvider {
  async generatePortrait(
    prompt: string,
    options: GenerateOptions = {},
  ): Promise<string> {
    const {
      model,
      quality = DEFAULT_IMAGE_QUALITY,
      referenceImages = [],
    } = options;
    const openai = getOpenAI();
    const usedModel = model || IMAGE_MODEL;

    if (referenceImages.length > 0 && MODELS_WITHOUT_EDIT.includes(usedModel)) {
      throw new Error(
        `${usedModel} unterstützt keine Referenzbilder. Bitte in den Einstellungen ein anderes Bildmodell wählen oder die Vorlage entfernen.`,
      );
    }

    const result =
      referenceImages.length > 0
        ? await openai.images.edit({
            model: usedModel,
            prompt,
            image: await Promise.all(referenceImages.map(dataUrlToFile)),
            size: "1024x1024",
            quality,
          })
        : await openai.images.generate({
            model: usedModel,
            prompt,
            size: "1024x1024",
            quality,
          });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("Bildgenerierung lieferte keine Bilddaten zurück.");
    }
    return `data:image/png;base64,${b64}`;
  }
}

let provider: ImageProvider | null = null;

/** Liefert den aktuell konfigurierten Bild-Provider. */
export function getImageProvider(): ImageProvider {
  if (!provider) {
    provider = new OpenAIImageProvider();
  }
  return provider;
}
