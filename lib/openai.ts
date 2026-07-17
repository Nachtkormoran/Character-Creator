import OpenAI from "openai";

/**
 * Zentraler OpenAI-Client. Wird ausschließlich serverseitig (in API-Routen)
 * verwendet, damit der API-Key niemals im Browser landet.
 */

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY ist nicht gesetzt. Bitte in .env.local eintragen.",
    );
  }
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-4o-2024-08-06";
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
