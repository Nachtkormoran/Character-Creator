import type { CharacterInput, GeneratedCharacter } from "./schema";

/** Hilfsfunktion: nur ausgefüllte Vorgaben in den Prompt aufnehmen. */
function line(label: string, value?: string): string {
  const v = (value || "").trim();
  return v ? `- ${label}: ${v}\n` : "";
}

/**
 * Baut den Prompt für die Textgenerierung. Das Modell soll strukturiertes
 * JSON zurückgeben (via Structured Outputs), daher beschreibt der Prompt nur
 * Inhalt und Ton – nicht das Format.
 */
export function buildTextPrompt(input: CharacterInput): string {
  const vorgaben =
    line("Geschlecht", input.gender === "egal" ? "" : input.gender) +
    line("Alter", input.age) +
    line("Herkunft/Ethnie", input.ethnicity) +
    line("Aussehen", input.appearance) +
    line("Setting/Genre", input.setting) +
    line("Beruf/Rolle", input.occupation) +
    line("Hintergrund", input.background) +
    line("Persönlichkeit", input.personality) +
    line("Weitere Wünsche", input.notes);

  return `Erstelle einen glaubwürdigen, vielschichtigen menschlichen Charakter, der z. B. in einem Buch oder Spiel verwendet werden kann.

Halte dich an die folgenden Vorgaben. Für alle nicht angegebenen Aspekte triffst du selbst stimmige, kreative und in sich konsistente Entscheidungen.

Vorgaben:
${vorgaben || "- (keine spezifischen Vorgaben – gestalte den Charakter frei)\n"}
Anforderungen an das Ergebnis:
- Ein vollständiger, zum Setting passender Name.
- Eine kompakte Beschreibung in 2–3 kurzen Absätzen (insgesamt ca. 700–1000 Zeichen) zu Aussehen, Persönlichkeit und Hintergrund. Fasse dich prägnant, keine Ausschweifungen.
- Konkrete, konsistente Körpermerkmale (Größe und Gewicht als realistische Werte mit Einheit).
- Schreibe auf Deutsch, lebendig und plastisch, aber ohne Kitsch.
- Die Merkmale müssen zur Beschreibung passen (keine Widersprüche).`;
}

/**
 * Baut den Prompt für die Bildgenerierung aus den generierten Merkmalen.
 */
export function buildImagePrompt(
  character: GeneratedCharacter,
  imageStyle: string,
  options: {
    includeTraits?: boolean;
    visualDetails?: string;
    extraPrompt?: string;
  } = {},
): string {
  const { includeTraits = true, visualDetails, extraPrompt } = options;
  const m = character.merkmale;

  const stilBeschreibung: Record<string, string> = {
    illustration:
      "Stylized modern character concept art, in the style of high-end digital concept art / movie key art (Leonardo Kino XL look). Clearly an illustration and NOT a photograph: visible digital brushwork and painterly rendering, slightly stylized and idealized features and shapes, artistic illustrative shading rather than photoreal pores and skin texture. Still polished, detailed and with good anatomy. Contemporary, present-day clothing and styling. Cinematic lighting and rich, slightly heightened color grading. The character is set within a fitting modern real-world environment that suits their background and personality (e.g. a city street, workplace, studio or interior), rendered in the same illustrative style, with natural depth of field and atmosphere — NOT an empty studio backdrop.",
    malerisch:
      "Expressive painterly portrait, in the style of a fine-art oil / gouache painting. Clearly a hand-painted artwork with visible brush strokes, thick impasto texture, blended colors and an artistic, slightly loose rendering — NOT a photograph and not a clean digital render. Rich, harmonious color palette and warm painterly lighting. Contemporary, present-day clothing. The character is set within a fitting modern environment rendered in the same loose painterly manner, with soft atmospheric depth.",
    fotorealistisch:
      "Photorealistic portrait photograph. Shot on a full-frame camera, natural lighting, shallow depth of field, sharp focus, realistic skin texture and pores, high detail. Contemporary, present-day setting. Looks like a real photograph, not an illustration.",
  };
  const stil = stilBeschreibung[imageStyle] || stilBeschreibung.illustration;

  const kontext = character.kurzbeschreibung
    ? `\nScene context (use it to choose a fitting modern environment and outfit): ${character.kurzbeschreibung}\n`
    : "";

  const merkmaleBlock = includeTraits
    ? `
Character details:
- Name: ${character.name}
- Age: ${m.alter} years
- Gender: ${m.geschlecht}
- Height/build: ${m.groesse}, ${m.koerperbau}
- Hair: ${m.haarfarbe}, ${m.frisur}
- Eyes: ${m.augenfarbe}
- Skin tone: ${m.hautton}
- Origin: ${m.herkunft}
- Distinguishing features: ${m.besondereMerkmale}
- Personality: ${m.persoenlichkeit}
Let this personality clearly show in the character's facial expression, gaze, posture and body language.`
    : `
Character: ${character.name}.`;

  const detailsBlock = visualDetails
    ? `
Additional visual details taken from the character description (clothing, environment, props, mood): ${visualDetails}`
    : "";

  const extraBlock = extraPrompt?.trim()
    ? `
Additional instructions from the user (important – incorporate these even if they add attributes not mentioned above): ${extraPrompt.trim()}`
    : "";

  return `Portrait of a single human character. ${stil}.
${kontext}${merkmaleBlock}${detailsBlock}${extraBlock}

Framing: half-body / upper-body composition with a natural, candid pose (the character may look slightly off-camera). The fitting modern environment is visible behind them with depth of field. Only one person in the image, no text, no watermark.`;
}
