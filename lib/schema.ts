import { z } from "zod";
// Nur für die Genre-Ids in `scenarioDraftSchema`. Kein Kreis: `templates.ts`
// importiert von hier ausschließlich einen **Typ**, und der ist zur Laufzeit
// nicht da.
import { DEFAULT_GENRE, GENRE_TEMPLATES, genreLabel } from "./templates";

/**
 * Zentrale Schemas & Typen für den Charakter Creator.
 *
 * - `characterInputSchema`  → die Formular-Eingaben des Nutzers (Vorgaben)
 * - `characterTraitsSchema` → die strukturierten Körper-/Charaktermerkmale,
 *                             die das LLM zurückliefert (für die Tabelle)
 * - `generatedCharacterSchema` → das komplette Ergebnis des LLM
 */

// ---------------------------------------------------------------------------
// Eingaben (Formular)
// ---------------------------------------------------------------------------

export const GENDERS = ["weiblich", "männlich", "divers", "egal"] as const;

// Reihenfolge bestimmt die Anzeige; der erste Eintrag ist der Default.
export const IMAGE_STYLES = [
  { value: "illustration", label: "Illustration" },
  { value: "malerisch", label: "Malerisch" },
  { value: "fotorealistisch", label: "Fotorealistisch" },
  { value: "skizze", label: "Skizze" },
] as const;

export const DEFAULT_IMAGE_STYLE = "illustration";

// ---------------------------------------------------------------------------
// Bildmodelle (Einstellungen)
// ---------------------------------------------------------------------------

/**
 * Auswählbare Bildmodelle. Bewusst eine Allowlist: die Auswahl kommt aus dem
 * Browser und darf nicht zu einem beliebigen Modellnamen führen.
 */
export const IMAGE_MODELS = [
  {
    value: "gpt-image-1",
    label: "gpt-image-1",
    hint: "Bisheriges Modell – erzeugt den gewohnten Look. Wird am 23.10.2026 eingestellt.",
  },
  {
    value: "gpt-image-1-mini",
    label: "gpt-image-1-mini",
    hint: "Abgespeckte Variante desselben Modells – deutlich günstiger.",
  },
  {
    value: "gpt-image-1.5",
    label: "gpt-image-1.5",
    hint: "Nachfolger von gpt-image-1, anderes Bildergebnis.",
  },
  {
    value: "gpt-image-2",
    label: "gpt-image-2",
    hint: "Neueste Generation, in der niedrigen Stufe sehr günstig.",
  },
] as const;

export type ImageModel = (typeof IMAGE_MODELS)[number]["value"];

/** Default bleibt gpt-image-1, damit sich am gewohnten Ergebnis nichts ändert. */
export const DEFAULT_IMAGE_MODEL: ImageModel = "gpt-image-1";

export const imageModelSchema = z.enum(
  IMAGE_MODELS.map((m) => m.value) as [ImageModel, ...ImageModel[]],
);

/** Qualitätsstufen, die die OpenAI-Bild-API kennt. */
export const IMAGE_QUALITIES = [
  { value: "low", label: "Niedrig" },
  { value: "medium", label: "Mittel" },
  { value: "high", label: "Hoch" },
] as const;

export type ImageQuality = (typeof IMAGE_QUALITIES)[number]["value"];

/** Default bleibt `medium` – die bisher fest verdrahtete Stufe. */
export const DEFAULT_IMAGE_QUALITY: ImageQuality = "medium";

export const imageQualitySchema = z.enum(
  IMAGE_QUALITIES.map((q) => q.value) as [ImageQuality, ...ImageQuality[]],
);

/**
 * Ungefähre Kosten pro Bild in USD bei 1024×1024.
 *
 * Stand 18.07.2026, aus öffentlichen Preisvergleichen – **ohne Gewähr**.
 * `null` = kein belastbarer Wert gefunden; die Quellen widersprechen sich vor
 * allem in der `high`-Stufe. Nur zur Einordnung, nicht zur Abrechnung.
 */
export const IMAGE_PRICES_USD: Record<
  ImageModel,
  Record<ImageQuality, number | null>
> = {
  "gpt-image-1": { low: 0.011, medium: 0.042, high: 0.167 },
  "gpt-image-1-mini": { low: 0.005, medium: 0.011, high: 0.036 },
  "gpt-image-1.5": { low: 0.009, medium: 0.034, high: 0.2 },
  "gpt-image-2": { low: 0.006, medium: 0.053, high: 0.211 },
};

export const IMAGE_PRICES_AS_OF = "18.07.2026";

/**
 * Was der Client schicken darf – hier greift die Allowlist.
 */
export const settingsPatchSchema = z.object({
  imageModel: imageModelSchema,
  imageQuality: imageQualitySchema,
});

/**
 * Was der Server zurückgibt. Bewusst `string` und nicht `ImageModel`: ein über
 * `OPENAI_IMAGE_MODEL` gesetztes Modell ist serverseitige Konfiguration und
 * wird respektiert, auch wenn es nicht in der Auswahlliste steht.
 */
export interface Settings {
  imageModel: string;
  imageQuality: ImageQuality;
}

/** Steht das Modell in der Auswahlliste (oder kommt es aus der Env)? */
export function isKnownImageModel(value: string): value is ImageModel {
  return IMAGE_MODELS.some((m) => m.value === value);
}

export const characterInputSchema = z.object({
  /**
   * Das Genre der Figur.
   *
   * **Eine echte Vorgabe, kein Bedienzustand des Formulars.** Es war lange
   * beides: Die Genre-Auswahl belegte das Setting-Feld vor und steuerte die
   * Würfel, wurde aber nirgends gespeichert. Damit war später nicht mehr
   * feststellbar, in welche Welt eine Figur gehört – beim Ableiten eines
   * Szenarios musste das Genre aus dem Setting-Freitext erraten werden, und
   * das ging oft daneben.
   *
   * `.catch` statt bloßem `.default`: Eine Genre-Id, die es nicht (mehr) gibt,
   * darf nicht die **gesamten** Vorgaben ungültig machen – sonst stünde die
   * Figur wegen einer Kleinigkeit ohne alles da. Sie fällt auf Gegenwart
   * zurück, wie überall im Projekt.
   */
  genre: z
    .enum(GENRE_TEMPLATES.map((g) => g.id) as [string, ...string[]])
    .default(DEFAULT_GENRE)
    .catch(DEFAULT_GENRE),

  // Grundlegende Vorgaben
  /**
   * Wunschname, optional. Ein einzelnes Wort wird als Vorname verstanden und
   * vom Modell um einen Nachnamen ergänzt (s. `buildTextPrompt`).
   */
  name: z.string().trim().max(120).optional().default(""),
  gender: z.enum(GENDERS).default("egal"),
  age: z.string().trim().max(60).optional().default(""),
  ethnicity: z.string().trim().max(120).optional().default(""),

  // Aussehen
  appearance: z.string().trim().max(1500).optional().default(""),

  // Hintergrund / Kontext
  setting: z.string().trim().max(200).optional().default(""),
  occupation: z.string().trim().max(200).optional().default(""),
  background: z.string().trim().max(2000).optional().default(""),
  personality: z.string().trim().max(1000).optional().default(""),

  // Freitext für alles Weitere
  notes: z.string().trim().max(2000).optional().default(""),

  // Bild-Stil
  imageStyle: z
    .enum(IMAGE_STYLES.map((s) => s.value) as [string, ...string[]])
    .default(DEFAULT_IMAGE_STYLE),
});

export type CharacterInput = z.infer<typeof characterInputSchema>;

// ---------------------------------------------------------------------------
// Merkmale (LLM-Ausgabe, strukturiert → Tabelle)
// ---------------------------------------------------------------------------

export const characterTraitsSchema = z.object({
  alter: z.number().describe("Alter in Jahren (ganze Zahl)"),
  geschlecht: z.string().describe("Geschlecht des Charakters"),
  groesse: z.string().describe("Körpergröße inkl. Einheit, z. B. '178 cm'"),
  gewicht: z.string().describe("Gewicht inkl. Einheit, z. B. '72 kg'"),
  koerperbau: z.string().describe("Körperbau, z. B. 'athletisch', 'schlank'"),
  haarfarbe: z.string().describe("Haarfarbe"),
  frisur: z.string().describe("Frisur / Haarlänge"),
  augenfarbe: z.string().describe("Augenfarbe"),
  hautton: z.string().describe("Hautton / Teint"),
  herkunft: z.string().describe("Herkunft / Ethnie"),
  wohnort: z
    .string()
    .describe(
      "Aktueller Wohnort – Stadt bzw. Ort, ggf. mit Land, z. B. 'Lissabon' oder 'kleines Dorf in Nordnorwegen'",
    ),
  beruf: z
    .string()
    .describe(
      "Ausgeübter Beruf oder Rolle, z. B. 'Bibliothekarin', 'Bootsbauer', 'Studentin der Philosophie'",
    ),
  besondereMerkmale: z
    .string()
    .describe("Auffällige/besondere Merkmale, z. B. Narben, Tattoos, Brille"),
  persoenlichkeit: z
    .string()
    .describe(
      "3–5 zentrale Persönlichkeitsmerkmale / Charaktereigenschaften, kommagetrennt, z. B. 'warmherzig, neugierig, durchsetzungsstark'",
    ),
  interessen: z
    .string()
    .describe(
      "2–5 Interessen, Hobbys oder Freizeitbeschäftigungen, kommagetrennt, passend zu Beruf, Herkunft und Wesen des Charakters, z. B. 'Bergwandern, Schallplatten sammeln, Schach'",
    ),
});

export type CharacterTraits = z.infer<typeof characterTraitsSchema>;

/**
 * Ergänzt fehlende Merkmale mit leeren Werten.
 *
 * Ältere Charaktere wurden gespeichert, bevor einzelne Merkmale (z. B.
 * `persoenlichkeit`) eingeführt wurden. Ohne diese Auffüllung scheitert jede
 * spätere Validierung gegen `characterTraitsSchema` – Bildgenerierung und
 * Bearbeiten wären für solche Datensätze blockiert.
 */
export function normalizeTraits(raw: unknown): CharacterTraits {
  const source = (raw ?? {}) as Record<string, unknown>;
  const result = {} as Record<string, unknown>;

  for (const key of Object.keys(TRAIT_LABELS) as Array<keyof CharacterTraits>) {
    const value = source[key];
    if (key === "alter") {
      const n = typeof value === "number" ? value : parseInt(String(value), 10);
      result[key] = Number.isFinite(n) ? n : 0;
    } else {
      result[key] = typeof value === "string" ? value : "";
    }
  }
  return result as CharacterTraits;
}

/**
 * Wendet eine (String-)Änderung auf ein Merkmal an und liefert ein neues
 * Merkmals-Objekt. `alter` wird dabei in eine Zahl konvertiert.
 */
export function withTrait(
  merkmale: CharacterTraits,
  key: keyof CharacterTraits,
  value: string,
): CharacterTraits {
  if (key === "alter") {
    const n = parseInt(value, 10);
    return { ...merkmale, alter: Number.isNaN(n) ? 0 : n };
  }
  return { ...merkmale, [key]: value } as CharacterTraits;
}

/** Reihenfolge & Anzeigenamen für die Merkmals-Tabelle. */
export const TRAIT_LABELS: Record<keyof CharacterTraits, string> = {
  alter: "Alter",
  geschlecht: "Geschlecht",
  groesse: "Größe",
  gewicht: "Gewicht",
  koerperbau: "Körperbau",
  haarfarbe: "Haarfarbe",
  frisur: "Frisur",
  augenfarbe: "Augenfarbe",
  hautton: "Hautton",
  herkunft: "Herkunft",
  wohnort: "Wohnort",
  beruf: "Beruf",
  besondereMerkmale: "Besondere Merkmale",
  persoenlichkeit: "Persönlichkeit",
  interessen: "Interessen und Hobbies",
};

/**
 * Reihenfolge & Anzeigenamen der **Formular-Vorgaben** (`CharacterInput`) für
 * die Vorgaben-Ansicht in der Galerie. Reihenfolge wie im Erstellen-Formular,
 * damit die Ansicht sich liest wie das ausgefüllte Formular.
 *
 * Diese Karte ist zugleich die Feldliste der Anzeige: Charaktere aus älteren
 * Ständen haben nicht alle Schlüssel im gespeicherten JSON. Über die Labels zu
 * laufen statt über die Schlüssel des Objekts zeigt solche Felder als leer an,
 * statt sie stillschweigend zu unterschlagen.
 */
export const INPUT_LABELS: Record<keyof CharacterInput, string> = {
  genre: "Genre",
  name: "Wunschname",
  gender: "Geschlecht",
  age: "Alter",
  ethnicity: "Herkunft / Ethnie",
  appearance: "Aussehen",
  personality: "Persönlichkeit",
  setting: "Setting / Genre",
  occupation: "Beruf / Rolle",
  background: "Hintergrund",
  notes: "Weitere Wünsche",
  imageStyle: "Bild-Stil",
};

/**
 * Anzeigewert einer einzelnen Vorgabe. `imageStyle` wird auf sein Label
 * abgebildet („illustration" → „Illustration"), alles andere bleibt Freitext.
 * Leer bleibt leer – die Anzeige entscheidet, wie sie das darstellt.
 */
export function inputDisplayValue(
  key: keyof CharacterInput,
  input: Partial<CharacterInput>,
): string {
  const raw = input[key];
  if (typeof raw !== "string" || raw.trim() === "") return "";
  if (key === "imageStyle") {
    return IMAGE_STYLES.find((s) => s.value === raw)?.label ?? raw;
  }
  // Gespeichert ist die Id („western"), angezeigt gehört das Label hin.
  if (key === "genre") return genreLabel(raw);
  return raw;
}

/**
 * Füllt das **Genre** in den Vorgaben eines Altbestands auf.
 *
 * Bewusst nur dieses eine Feld und nicht alle: Die übrigen Vorgaben sind reine
 * Anzeige, und dass sie einem alten Charakter fehlen, soll man in der
 * Vorgaben-Ansicht auch sehen („— nichts angegeben —"). Das Genre dagegen
 * **steuert** etwas – die Würfel und vor allem die Szenario-Ableitung – und ein
 * fehlender Wert wäre dort ein `undefined` mitten im Ablauf.
 *
 * Aus demselben Grund fällt auch eine unbekannte Id auf Gegenwart zurück und
 * bleibt nicht stehen: Sie träfe in keiner Liste zu.
 */
export function normalizeInputGenre(raw: unknown): CharacterInput {
  const input = (raw ?? {}) as CharacterInput;
  const bekannt = GENRE_TEMPLATES.some((g) => g.id === input.genre);
  return bekannt ? input : { ...input, genre: DEFAULT_GENRE };
}

// ---------------------------------------------------------------------------
// Szenario (Festlegungen, die für alle enthaltenen Charaktere gelten)
// ---------------------------------------------------------------------------

/**
 * Die Festlegungen eines Szenarios.
 *
 * Liegen in der Spalte `Scenario.details` als **JSON-String**, nicht als
 * einzelne Tabellenspalten – dasselbe Muster wie `Character.traits` und
 * `Character.input`, und aus demselben Grund: hier kommen weitere Felder dazu,
 * und jedes davon wäre sonst eine eigene Migration. So ist ein neues Feld zwei
 * Zeilen (hier und in `SCENARIO_LABELS`).
 *
 * Der **Name** bleibt dagegen eine echte Spalte: nach ihm wird sortiert, und er
 * ist die Identität des Szenarios, nicht eine seiner Eigenschaften.
 *
 * Alles ist optional und darf leer bleiben. Ein Szenario entsteht oft, bevor
 * feststeht, wo es spielt – ein Pflichtfeld würde nur zu Platzhaltern führen.
 */
/**
 * **Das Zeichenlimit je Szenario-Feld – eine Quelle für drei Verbraucher.**
 *
 * Das Schema unten zieht sein `.max(...)` von hier, das Formular zeigt die Zahl
 * unter dem Feld an und setzt `maxLength`, und die Ergänzen-Route bemisst danach
 * ihr `max_tokens` und das Budget im Prompt. Stünde die Zahl an jeder dieser
 * Stellen einzeln, liefe die KI-Erzeugung irgendwann über ein Limit, das das
 * Formular längst höher gesetzt hat – der Fehler fiele erst beim Speichern auf.
 *
 * Ort und Zeit waren einmal auf 300 bzw. 200 Zeichen bemessen, als dort ein
 * Schauplatz und ein Datum standen („Ein Fischerdorf an der Nordküste",
 * „Spätherbst 1923"). Seit die Ableitung ein **Gebiet mit mehreren Orten** und
 * einen **Zeitraum samt dem, was sich in ihm verschiebt** liefert, sind es
 * mehrere Sätze – dieselbe Lehre wie bei `storyHooks`: Ein zu enges Limit
 * schlägt nicht früh zu, sondern spät, erst beim Speichern.
 */
// Bewusst **ohne** Typ-Annotation über `keyof ScenarioDetails`: Dieser Typ wird
// aus `scenarioDetailsSchema` abgeleitet, das seinerseits die Werte hier liest –
// eine solche Annotation wäre ein Zirkelbezug. Die Vollständigkeit gegen das
// Schema wird stattdessen weiter unten geprüft (`_maxlengthsCheck`), sobald
// `ScenarioDetails` existiert.
export const SCENARIO_MAXLENGTHS = {
  genre: 60,
  ort: 2000,
  zeit: 1000,
  regeln: 4000,
  beschreibung: 4000,
  handlung: 4000,
} as const;

export const scenarioDetailsSchema = z.object({
  genre: z.string().trim().max(SCENARIO_MAXLENGTHS.genre).optional().default(""),
  ort: z.string().trim().max(SCENARIO_MAXLENGTHS.ort).optional().default(""),
  zeit: z.string().trim().max(SCENARIO_MAXLENGTHS.zeit).optional().default(""),
  regeln: z
    .string()
    .trim()
    .max(SCENARIO_MAXLENGTHS.regeln)
    .optional()
    .default(""),
  beschreibung: z
    .string()
    .trim()
    .max(SCENARIO_MAXLENGTHS.beschreibung)
    .optional()
    .default(""),
  handlung: z
    .string()
    .trim()
    .max(SCENARIO_MAXLENGTHS.handlung)
    .optional()
    .default(""),
});

export type ScenarioDetails = z.infer<typeof scenarioDetailsSchema>;

// Sichert die Vollständigkeit von `SCENARIO_MAXLENGTHS` gegen das Schema, ohne
// den Zirkelbezug, den eine Typ-Annotation an der Konstante selbst erzeugte:
// Fehlte hier ein Feld, schlüge diese Zuweisung fehl.
const _maxlengthsCheck: Record<keyof ScenarioDetails, number> =
  SCENARIO_MAXLENGTHS;
void _maxlengthsCheck;

/**
 * Reihenfolge & Anzeigenamen der Szenario-Felder. Wie bei `TRAIT_LABELS` ist
 * diese Karte zugleich die Feldliste der Anzeige: Szenarien aus älteren
 * Ständen haben nicht alle Schlüssel, und über die Labels zu laufen zeigt sie
 * als leer an, statt sie stillschweigend zu unterschlagen.
 */
export const SCENARIO_LABELS: Record<keyof ScenarioDetails, string> = {
  genre: "Genre",
  ort: "Ort",
  zeit: "Zeit",
  regeln: "Regeln",
  // Stehen **hinter** den übrigen Feldern, weil sie ihre Grundlage sind: beide
  // werden aus ihnen erzeugt, nicht umgekehrt. Der Handlungsentwurf kommt
  // zuletzt, weil er zusätzlich die Charaktere braucht – er ist das einzige
  // Feld im Projekt, das mehrere Figuren zugleich betrachtet.
  beschreibung: "Beschreibung",
  handlung: "Handlungsentwurf",
};

/**
 * Kurzer Hinweis je Feld – steht unter dem Eingabefeld im Formular. Getrennt
 * von den Labels, weil die Labels auch in der reinen Anzeige verwendet werden,
 * wo eine Ausfüllhilfe nur stören würde.
 */
export const SCENARIO_HINTS: Record<keyof ScenarioDetails, string> = {
  genre: "Bestimmt später Namen, Hintergründe und Berufe der Charaktere.",
  ort: "Wo spielt es? Gern ein Gebiet mit mehreren Schauplätzen – Region, Stadt, und die Orte darin, an denen etwas passiert.",
  zeit: "Wann spielt es, und über welchen Zeitraum? Epoche oder Jahr als Rahmen – z. B. Spätherbst 1923, über zwei Winter hinweg.",
  regeln:
    "Was in diesem Szenario gilt und für alle Figuren darin wahr ist – Technikstand, Magie, gesellschaftliche Ordnung, Tabus.",
  beschreibung:
    "Fließtext über die Welt des Szenarios. Lässt sich aus den Feldern darüber erzeugen und danach frei bearbeiten.",
  handlung:
    "Wer gerät hier mit wem worüber aneinander? Lässt sich aus den Festlegungen und den zugeordneten Charakteren erzeugen – dafür muss das Szenario gespeichert sein und Figuren enthalten.",
};

/**
 * **Welches Feld welche anderen lesen darf, wenn es per KI erzeugt wird.**
 *
 * Die Festlegungen stehen nicht gleichberechtigt nebeneinander, sie haben eine
 * Richtung:
 *
 * ```
 * Genre ──► Ort ──► Beschreibung ──► Handlung
 *       └──► Zeit ─┘                    ▲
 *       └──► Regeln ────────────────────┘
 * ```
 *
 * Erzeugt wird deshalb **nur aus dem, was oberhalb steht**. Flösse die
 * Beschreibung in die Ort-Erzeugung zurück, entstünde ein Kreis: Die
 * Beschreibung wurde aus dem alten Ort geschrieben, der neue Ort entstünde aus
 * ihr – und danach passt die Beschreibung nicht mehr zu dem Ort, aus dem sie
 * stammt. Beim Handlungsentwurf wäre es schlimmer: Er hängt an den zugeordneten
 * Figuren, und dann definierten die Ereignisse einer einzelnen Geschichte
 * rückwirkend die Welt, in der alle anderen spielen.
 *
 * Die Karte gilt **serverseitig**: Die Routen filtern danach, was in den Prompt
 * darf. Der Client schickt die ganzen Festlegungen – so kann eine neue
 * Aufrufstelle die Regel nicht versehentlich umgehen.
 *
 * `genre` kommt als **Ziel** nicht vor: Es wird nie erzeugt, sondern gewählt.
 * Als **Quelle** steht es überall, denn es bindet alles andere.
 */
export const SCENARIO_READS: Partial<
  Record<keyof ScenarioDetails, Array<keyof ScenarioDetails>>
> = {
  ort: ["genre", "zeit", "regeln"],
  zeit: ["genre", "ort", "regeln"],
  regeln: ["genre", "ort", "zeit"],
  beschreibung: ["genre", "ort", "zeit", "regeln"],
  handlung: ["genre", "ort", "zeit", "regeln", "beschreibung"],
};

/**
 * Felder, die im Formular mehrzeilig sind. Alles andere ist einzeilig.
 *
 * `zeit` kam später dazu: Solange dort ein Zeitpunkt stand („Spätherbst 1923"),
 * genügte eine Zeile. Seit die Ableitung einen **Zeitraum** samt dem, was sich
 * in ihm verschiebt, liefert, sind es zwei bis drei Sätze.
 */
export const SCENARIO_MULTILINE: ReadonlySet<keyof ScenarioDetails> = new Set([
  "ort",
  "zeit",
  "regeln",
  "beschreibung",
  "handlung",
]);

/**
 * Ergänzt fehlende Felder mit leeren Werten – dieselbe Aufgabe wie
 * `normalizeTraits`, aus demselben Grund: ein später ergänztes Feld fehlt allen
 * zuvor gespeicherten Szenarien.
 */
export function normalizeScenarioDetails(raw: unknown): ScenarioDetails {
  const source = (raw ?? {}) as Record<string, unknown>;
  const result = {} as Record<string, string>;
  for (const key of Object.keys(SCENARIO_LABELS)) {
    const value = source[key];
    result[key] = typeof value === "string" ? value : "";
  }
  return result as ScenarioDetails;
}

/**
 * Der Szenario-Vorschlag, den das Modell aus **einem Charakter** ableitet.
 *
 * Bewusst ein **eigenes** Schema und nicht `scenarioDetailsSchema`, aus zwei
 * Gründen:
 *
 * 1. Structured Outputs verlangen, dass **alle** Felder erforderlich sind.
 *    `scenarioDetailsSchema` besteht aus `.optional().default("")` – richtig
 *    für ein Formular, in dem alles leer bleiben darf, unbrauchbar hier.
 * 2. Der Zuschnitt ist ein anderer: der `name` gehört dazu (er ist sonst keine
 *    Festlegung, sondern die Identität), und `handlung` fehlt. Ein
 *    Handlungsentwurf braucht mehrere Figuren; das frisch abgeleitete Szenario
 *    hat genau eine. Er wird später in der Szenario-Detailansicht erzeugt,
 *    wenn eine Besetzung dasteht.
 *
 * Das **Genre erzeugt das Modell nicht** – es kommt aus den Vorgaben des
 * Charakters und wird von der Route in den Entwurf gesetzt. Das war einmal
 * anders: Solange Charaktere kein Genre trugen, musste das Modell es aus dem
 * Setting-Freitext erraten, und ein Enum über die Ids aus `GENRE_TEMPLATES`
 * hielt die Antwort wenigstens im Vokabular. Raten ist nicht mehr nötig, und
 * die Figur weiß es besser als der Text über sie: Wer einen Charakter als
 * Märchenfigur angelegt hat, will kein „historisch" zurückbekommen, weil
 * Mühle und Wald auch dorthin passen. Das Genre steht dem Modell trotzdem im
 * Prompt – als Vorgabe für Ort, Zeit und Regeln.
 */
export const scenarioDraftSchema = z.object({
  name: z
    .string()
    .describe("Kurzer, prägnanter Titel des Szenarios (2–5 Wörter)"),
  ort: z
    .string()
    .describe(
      "Ein Gebiet mit mehreren Orten: der Rahmen (Land, Region, Stadt) und darin zwei bis drei konkrete Schauplätze, jeder mit einem Detail, das ihn kippen lässt",
    ),
  zeit: z
    .string()
    .describe(
      "Ein Zeitraum, kein Zeitpunkt: Epoche oder Jahr als Rahmen, die Spanne (Wochen bis Jahrzehnte) und was sich in ihr verschiebt",
    ),
  regeln: z
    .string()
    .describe("Was in dieser Welt gilt und für alle Figuren wahr ist"),
  beschreibung: z.string().describe("Fließtext über die Welt des Szenarios"),
});

/**
 * Was beim Client ankommt: der Modell-Entwurf **plus** das Genre, das die
 * Route aus den Vorgaben des Charakters ergänzt. Deshalb ein Schnitt und kein
 * blankes `z.infer` – das Schema beschreibt die Modellantwort, dieser Typ die
 * fertige Antwort der Route.
 */
export type ScenarioDraft = z.infer<typeof scenarioDraftSchema> & {
  genre: string;
};

// ---------------------------------------------------------------------------
// Personen aus dem Handlungsentwurf
// ---------------------------------------------------------------------------

/**
 * Eine im Handlungsentwurf genannte Person, die dem Szenario **noch nicht**
 * zugeordnet ist.
 *
 * Der Handlungsentwurf entsteht aus den vorhandenen Figuren, erfindet dabei
 * aber regelmäßig weitere: den Vorgesetzten, die Schwester, den Mann am
 * Hafen. Bisher war das eine Sackgasse – die Person stand im Text und musste
 * von Hand ins Erstellen-Formular übertragen werden.
 *
 * **Warum das ein KI-Aufruf sein muss und kein Mustervergleich:** Im
 * Deutschen ist jedes Substantiv großgeschrieben. „Der Schmied Bengt verwehrte
 * ihr den Auftrag" enthält drei großgeschriebene Wörter und genau einen Namen.
 * Ein Abgleich auf Großschreibung würde „Schmied" und „Auftrag" als Personen
 * anbieten.
 *
 * Alle Felder sind **Pflicht und dürfen leer sein**: Structured Outputs
 * verlangt, dass jedes Feld im Schema auch geliefert wird, und ein Entwurf
 * sagt selten etwas über das Aussehen. Ein leerer String ist die ehrliche
 * Antwort – geraten werden soll hier nichts, das steht später im Formular.
 */
export const plotPersonSchema = z.object({
  name: z
    .string()
    .describe(
      "Der Name der Person, exakt so geschrieben wie im Text – er wird darin wiedergefunden",
    ),
  geschlecht: z
    .string()
    .describe(
      'Eines von: "weiblich", "männlich", "divers". Leer lassen, wenn der Text es nicht hergibt',
    ),
  alter: z
    .string()
    .describe("Alter oder Altersangabe, wenn genannt – sonst leer"),
  beruf: z.string().describe("Beruf oder Rolle in der Handlung"),
  hintergrund: z
    .string()
    .describe(
      "Was der Entwurf über ihre Vorgeschichte und ihre Verbindung zu den anderen Figuren sagt",
    ),
  persoenlichkeit: z
    .string()
    .describe("Was der Entwurf über ihr Wesen und ihr Auftreten sagt"),
  aussehen: z.string().describe("Was der Entwurf über ihr Aussehen sagt"),
});

export type PlotPerson = z.infer<typeof plotPersonSchema>;

/**
 * Die Antwort der Route. Ein umschließendes Objekt und kein blankes Array,
 * weil Structured Outputs auf oberster Ebene ein Objekt verlangt.
 */
export const plotPersonsSchema = z.object({
  personen: z.array(plotPersonSchema),
});

// ---------------------------------------------------------------------------
// Ansatzpunkte für eine Geschichte
// ---------------------------------------------------------------------------

/**
 * Wie fest die Ansatzpunkte am Charakter hängen sollen.
 *
 * Ohne diese Wahl driftet das Modell verlässlich ins Allgemeine: ein
 * Zufallsfund, ein anonymer Hinweis, ein Netz von Intrigen – Aufhänger, die an
 * jede beliebige Figur passen und deshalb an keiner etwas erzählen. Die Stufe
 * steuert genau eine Frage: **darf Neues erfunden werden, und wie viel?**
 *
 * Default ist `eng`, nicht die Mitte. Wer die Ansatzpunkte gerade erst hat
 * ableiten lassen, will sehen, was in der Figur schon drinsteckt; auf Effekt
 * spielen kann man danach immer noch.
 */
export const STORY_HOOK_ANCHORS = [
  {
    value: "eng",
    label: "Eng am Charakter",
    hint: "Nur aus dem, was schon dasteht. Keine neuen Personen, Orte oder Ereignisse.",
  },
  {
    value: "mittel",
    label: "Etwas Spielraum",
    hint: "Je Ansatzpunkt ein neues Element, das aus etwas Vorhandenem folgt.",
  },
  {
    value: "frei",
    label: "Freie Hand",
    hint: "Der Charakter ist Ausgangspunkt; die Handlung darf weit ausgreifen.",
  },
] as const;

export type StoryHookAnchor = (typeof STORY_HOOK_ANCHORS)[number]["value"];

export const DEFAULT_STORY_HOOK_ANCHOR: StoryHookAnchor = "eng";

export const storyHookAnchorSchema = z.enum(
  STORY_HOOK_ANCHORS.map((a) => a.value) as [
    StoryHookAnchor,
    ...StoryHookAnchor[],
  ],
);

// ---------------------------------------------------------------------------
// Vollständiges generiertes Ergebnis
// ---------------------------------------------------------------------------

export const generatedCharacterSchema = z.object({
  name: z.string().describe("Vollständiger, zum Charakter passender Name"),
  kurzbeschreibung: z
    .string()
    .describe("Ein bis zwei Sätze, die den Charakter auf den Punkt bringen"),
  beschreibung: z
    .string()
    .describe(
      "Ausführlicher Fließtext (mehrere Absätze) über Aussehen, Persönlichkeit und Hintergrund des Charakters",
    ),
  merkmale: characterTraitsSchema,
});

export type GeneratedCharacter = z.infer<typeof generatedCharacterSchema>;
