import { getOpenAI, IMAGE_MODEL } from "./openai";

/**
 * Abstraktion für die Bildgenerierung.
 *
 * Aktuell gibt es nur einen OpenAI-Provider (gpt-image-1). Durch dieses
 * Interface lässt sich später ein anderer Anbieter (z. B. Flux via Replicate)
 * ergänzen, ohne den restlichen Code anzupassen.
 */
export interface ImageProvider {
  /** Erzeugt ein Portrait und liefert es als Data-URL (base64) zurück. */
  generatePortrait(prompt: string): Promise<string>;
}

class OpenAIImageProvider implements ImageProvider {
  async generatePortrait(prompt: string): Promise<string> {
    const openai = getOpenAI();

    const result = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt,
      size: "1024x1024",
      quality: "medium",
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
