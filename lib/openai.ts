import OpenAI from "openai";
import { getSettings } from "./settings";
import { textProviderSchema, type StoryGeneration } from "./schema";

/**
 * Zentrale OpenAI-Clients. Werden ausschließlich serverseitig (in API-Routen)
 * verwendet, damit die API-Keys niemals im Browser landen.
 *
 * **Text und Bild sind getrennt.** Der Text-Anbieter ist über die Einstellungen
 * umschaltbar (OpenAI oder Google Gemini, s. `getTextClient`), das **Bild**
 * läuft immer über OpenAI (`gpt-image-*`). Deshalb bleibt `getOpenAI()` der
 * OpenAI-Client und wird von der Bild-Erzeugung direkt genutzt.
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

export const OPENAI_TEXT_MODEL =
  process.env.OPENAI_TEXT_MODEL || "gpt-4o-2024-08-06";
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

/**
 * Google Gemini über seinen **OpenAI-kompatiblen** Endpunkt. Denselben
 * OpenAI-SDK-Client wie oben, nur mit anderem `baseURL` und Key – so bleibt
 * der gesamte Aufruf-Code (auch Structured Outputs) unverändert.
 *
 * Modell und Endpunkt sind per Env überschreibbar; der Key kommt aus
 * `GEMINI_API_KEY` (kostenloses Kontingent über Google AI Studio).
 */
// `gemini-flash-lite-latest` folgt dem jeweils aktuellen Flash-**Lite**-Modell.
// Bewusst Lite und nicht das Voll-Flash (`gemini-flash-latest`): Letzteres löst
// sich auf `gemini-3.6-flash` auf, das im Free-Tier nur ~20 Anfragen/Tag erlaubt
// – für ein paar Charaktere zu wenig. Die Lite-Modelle haben ein deutlich
// größeres Tageskontingent. Und `gemini-2.0-flash` scheidet ganz aus: dessen
// Free-Tier ist für neue Konten `limit: 0` (gemessen 21.07.2026).
export const GEMINI_TEXT_MODEL =
  process.env.GEMINI_TEXT_MODEL || "gemini-flash-lite-latest";
export const GEMINI_BASE_URL =
  process.env.GEMINI_BASE_URL ||
  "https://generativelanguage.googleapis.com/v1beta/openai/";

let geminiClient: OpenAI | null = null;

function getGemini(): OpenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY ist nicht gesetzt. Bitte in .env.local eintragen oder in " +
        "den Einstellungen das Textmodell wieder auf OpenAI umstellen.",
    );
  }
  if (!geminiClient) {
    geminiClient = new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL });
  }
  return geminiClient;
}

/**
 * Mistral über seinen **OpenAI-kompatiblen** Endpunkt – exakt dasselbe Muster
 * wie Gemini: derselbe OpenAI-SDK-Client, nur anderer `baseURL` und Key. So
 * bleibt der gesamte Aufruf-Code unverändert.
 *
 * Modell und Endpunkt sind per Env überschreibbar; der Key kommt aus
 * `MISTRAL_API_KEY` (kostenloses Kontingent im Experiment-Tier). `mistral-small-latest`
 * ist ein solider, kostenloser Default; Mistral gilt als weniger stark gefiltert
 * und eignet sich damit für drastische/intime Prosa.
 */
export const MISTRAL_TEXT_MODEL =
  process.env.MISTRAL_TEXT_MODEL || "mistral-small-latest";
export const MISTRAL_BASE_URL =
  process.env.MISTRAL_BASE_URL || "https://api.mistral.ai/v1";

let mistralClient: OpenAI | null = null;

function getMistral(): OpenAI {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error(
      "MISTRAL_API_KEY ist nicht gesetzt. Bitte in .env.local eintragen oder in " +
        "den Einstellungen das Textmodell wieder auf OpenAI umstellen.",
    );
  }
  if (!mistralClient) {
    mistralClient = new OpenAI({ apiKey, baseURL: MISTRAL_BASE_URL });
  }
  return mistralClient;
}

/**
 * Zusätzliche Request-Parameter, die eine Text-Route unverändert in ihren
 * `chat.completions.create`/`.parse`-Aufruf spreizt (`...extraParams`). Bei
 * OpenAI leer, bei Gemini das Abschalten des „Nachdenkens" (s. u.).
 */
export type TextExtraParams = Record<string, unknown>;

/**
 * Liefert **Client, Modell und Extra-Parameter für die Text-Erzeugung** je nach
 * eingestelltem Anbieter. Jede Text-Route ruft dies statt `getOpenAI()` + festem
 * Modell, damit die Umschaltung in den Einstellungen ohne Neustart greift. Das
 * Bild bleibt bewusst außen vor – es läuft immer über OpenAI.
 *
 * **`reasoning_effort: "minimal"` nur für Gemini:** Die aktuellen Gemini-Flash-
 * Modelle „denken" per Default und verbrauchen dabei erst einmal Token, **bevor**
 * sichtbarer Text entsteht. Knapp budgetierte Routen (z. B. der Namensknopf mit
 * `max_tokens: 24`) bekamen dadurch eine **leere** Antwort (`finish_reason:
 * "length"`, `completion_tokens: 0`). „minimal" schaltet das Nachdenken praktisch
 * ab, so dass Gemini wie das bisherige `gpt-4o` direkt antwortet – das spart
 * zugleich Token (wichtig fürs Minuten-Limit im Free-Tier). Der Parameter darf
 * **nicht** an OpenAI gehen: `gpt-4o` lehnt ihn ab. Bei OpenAI bleibt das Objekt
 * daher leer.
 *
 * **Auflösung des Anbieters (in dieser Reihenfolge):**
 * 1. **`providerOverride`** – ein gültiger Anbieter aus der Allowlist erlaubt
 *    einer Route, den Anbieter **pro Aufruf** zu wählen (Pro-Lauf-Selektor beim
 *    Handlungsentwurf bzw. Story Arc). Greift er, wird `getSettings()` gar nicht
 *    erst gelesen.
 * 2. **`generation` + Detaileinstellungen** – ist kein Override gesetzt und die
 *    Einstellung `useModelOverrides` an, gilt der in `storyModels[generation]`
 *    gewählte Anbieter (Einstellungsseite, „Modell je Story-Erzeugung"). So
 *    kann jede der vier Story-Erzeugungen ein eigenes Modell nutzen.
 * 3. **Globaler `textProvider`** – sonst (kein Override, keine
 *    Detaileinstellungen oder keine `generation`) wie bisher die eine
 *    Textmodell-Einstellung. Das gilt für **alle übrigen** Text-Erzeugungen.
 */
export async function getTextClient(
  providerOverride?: string,
  generation?: StoryGeneration,
): Promise<{
  client: OpenAI;
  model: string;
  extraParams: TextExtraParams;
}> {
  const übersteuert = textProviderSchema.safeParse(providerOverride);
  let textProvider;
  if (übersteuert.success) {
    textProvider = übersteuert.data;
  } else {
    const settings = await getSettings();
    textProvider =
      generation && settings.useModelOverrides
        ? settings.storyModels[generation]
        : settings.textProvider;
  }
  if (textProvider === "gemini") {
    return {
      client: getGemini(),
      model: GEMINI_TEXT_MODEL,
      extraParams: { reasoning_effort: "minimal" },
    };
  }
  // Mistral (mistral-small) „denkt" nicht per Default, braucht also kein
  // `reasoning_effort` – `extraParams` bleibt wie bei OpenAI leer.
  if (textProvider === "mistral") {
    return { client: getMistral(), model: MISTRAL_TEXT_MODEL, extraParams: {} };
  }
  return { client: getOpenAI(), model: OPENAI_TEXT_MODEL, extraParams: {} };
}

/**
 * **Kaputte Umlaute in einer Structured-Output-Antwort erkennen.**
 *
 * Beobachtet: Das Modell kodiert Umlaute unter Structured Outputs gelegentlich
 * als `\u`-Escape und verzählt sich dabei bei den Hexziffern. Statt eines `ü`
 * steht dann ein NUL-Zeichen gefolgt von den Resten „fc" da – und es gehen
 * zusätzlich Buchstaben verloren („Nordküste" wird zu „Nordkfce"). Genau
 * deshalb lässt sich das **nicht reparieren**: die Zeichen sind weg, ein
 * Herausfiltern der NULs ergäbe nur lautlosen Kauderwelsch in der Datenbank.
 * Die richtige Antwort ist ein zweiter Versuch.
 *
 * Der Test lautet deshalb nicht „enthält NUL", sondern „enthält irgendein
 * Steuerzeichen": es ist dieselbe Ursache, und in einem erzeugten Text hat
 * keines davon je etwas zu suchen. Zeilenumbruch und Tabulator bleiben
 * ausgenommen – die sind in mehrzeiligen Feldern legitim.
 *
 * Läuft **rekursiv** durch Objekte und Arrays: Die Antwort von
 * `scenario-plot-persons` ist eine Liste von Objekten, und ein kaputter Umlaut
 * im dritten Namen ist genauso schlimm wie einer auf oberster Ebene.
 */
export function hatKaputteZeichen(wert: unknown): boolean {
  // Alle C0-Steuerzeichen außer Tabulator (\u0009), Zeilenumbruch (\u000A)
  // und Wagenrücklauf (\u000D).
  const steuerzeichen = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
  if (typeof wert === "string") return steuerzeichen.test(wert);
  if (Array.isArray(wert)) return wert.some(hatKaputteZeichen);
  if (wert && typeof wert === "object")
    return Object.values(wert).some(hatKaputteZeichen);
  return false;
}
