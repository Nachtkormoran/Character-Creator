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
