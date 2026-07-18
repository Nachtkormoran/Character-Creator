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
  const wunschname = (input.name || "").trim();
  /**
   * Ein einzelnes Wort verstehen wir als Vornamen, der um einen passenden
   * Nachnamen ergänzt wird; ab zwei Wörtern gilt der Name als vollständig und
   * wird unverändert übernommen. „Anna-Maria" zählt dabei als ein Wort – ein
   * Doppelvorname ist immer noch ein Vorname.
   */
  const nurVorname = wunschname !== "" && !/\s/.test(wunschname);

  const vorgaben =
    line(nurVorname ? "Vorname" : "Name", wunschname) +
    line("Geschlecht", input.gender === "egal" ? "" : input.gender) +
    line("Alter", input.age) +
    line("Herkunft/Ethnie", input.ethnicity) +
    line("Aussehen", input.appearance) +
    line("Setting/Genre", input.setting) +
    line("Beruf/Rolle", input.occupation) +
    line("Hintergrund", input.background) +
    line("Persönlichkeit", input.personality) +
    line("Weitere Wünsche", input.notes);

  // Die Namens-Anforderung ersetzt die freie Namenswahl, sobald etwas
  // vorgegeben ist – sonst stünden beide widersprüchlich nebeneinander.
  const nameAnforderung = !wunschname
    ? "- Ein vollständiger, zum Setting passender Name."
    : nurVorname
      ? `- Der Vorname lautet exakt „${wunschname}". Übernimm ihn unverändert (auch Schreibweise) und ergänze einen dazu passenden Nachnamen, stimmig zu Herkunft und Setting. Das Feld für den Namen enthält beides zusammen.`
      : `- Der Name lautet exakt „${wunschname}". Übernimm ihn unverändert und ergänze nichts.`;

  return `Erstelle einen glaubwürdigen, vielschichtigen menschlichen Charakter, der z. B. in einem Buch oder Spiel verwendet werden kann.

Halte dich an die folgenden Vorgaben. Für alle nicht angegebenen Aspekte triffst du selbst stimmige, kreative und in sich konsistente Entscheidungen.

Vorgaben:
${vorgaben || "- (keine spezifischen Vorgaben – gestalte den Charakter frei)\n"}
Anforderungen an das Ergebnis:
${nameAnforderung}
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
    skizze:
      "Soft painted character study, like a digital sketch in gouache or matte oil. Muted, warm earthy palette (ochre, cream, olive, soft browns) with gentle, diffuse light and no dramatic contrast or color grading. Visible dry brush strokes and loose, sketchy edges — the painting fades out towards the borders and looks slightly unfinished, on a subtly textured paper-like surface. Calm, quiet, intimate mood. Clearly a hand-painted study, NOT a photograph and NOT polished concept art.",
  };
  const stil = stilBeschreibung[imageStyle] || stilBeschreibung.illustration;

  // Bildaufbau je Stil. „Skizze" ist bewusst ohne Umgebung – das ist der Kern
  // dieses Looks und würde sonst von der Standard-Vorgabe überschrieben.
  const framingBeschreibung: Record<string, string> = {
    skizze:
      "Framing: head-and-shoulders bust portrait, centered, the character calmly facing the viewer. Plain, unadorned warm paper-toned background with soft painterly texture — NO scenery, NO room, NO environment and no depth of field. Only one person in the image, no text, no watermark.",
  };
  const framing =
    framingBeschreibung[imageStyle] ||
    "Framing: half-body / upper-body composition with a natural, candid pose (the character may look slightly off-camera). The fitting modern environment is visible behind them with depth of field. Only one person in the image, no text, no watermark.";

  // Ohne Umgebung (Skizze) darf der Kontext nur Kleidung und Ausstrahlung
  // steuern – sonst zieht er doch wieder einen Schauplatz ins Bild.
  const kontext = character.kurzbeschreibung
    ? imageStyle === "skizze"
      ? `\nCharacter context (use it for clothing, expression and mood only, not for any background): ${character.kurzbeschreibung}\n`
      : `\nScene context (use it to choose a fitting modern environment and outfit): ${character.kurzbeschreibung}\n`
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

${framing}`;
}
