import { getOpenAI, TEXT_MODEL } from "./openai";

/**
 * Zieht aus dem ausführlichen Charaktertext nur die *bildrelevanten* visuellen
 * Details (Kleidung, Accessoires, Umgebung, Requisiten, Stimmung) und gibt sie
 * als kompakte, kommagetrennte Liste zurück. So kann der lange Fließtext ins
 * Bild einfließen, ohne den Bild-Prompt zu überladen und die Merkmale zu
 * "verwässern".
 *
 * Rückgabe auf Englisch, da der Bild-Prompt englisch ist.
 */
export async function extractVisualDetails(
  beschreibung: string,
): Promise<string> {
  const text = beschreibung.trim();
  if (!text) return "";

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "Du extrahierst aus einer Charakterbeschreibung ausschließlich die visuell darstellbaren Details für ein Portrait-Bild.",
      },
      {
        role: "user",
        content: `Lies die folgende Beschreibung und gib eine sehr kompakte, kommagetrennte Liste (maximal ca. 40 Wörter) der bildrelevanten visuellen Details zurück: Kleidung, Accessoires, Umgebung/Schauplatz, Requisiten, Stimmung/Atmosphäre, sichtbare Besonderheiten. Keine Charaktereigenschaften, keine Hintergrundgeschichte – nur, was man tatsächlich sehen kann. Antworte auf Englisch und ohne einleitenden Satz.\n\nBeschreibung:\n${text}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 120,
  });

  return completion.choices[0]?.message.content?.trim() ?? "";
}
