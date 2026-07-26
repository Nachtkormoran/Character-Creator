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
 * Anbieter für die **Text**-Erzeugung. `openai` ist der Standard (kostenpflichtig,
 * sehr zuverlässig auch bei Structured Outputs), `gemini` die kostenlose
 * Alternative über Google AI Studio. Beide laufen über denselben OpenAI-SDK-Client
 * – Gemini über seinen OpenAI-kompatiblen Endpunkt (`baseURL`). Die **Bilder**
 * bleiben davon unberührt und laufen weiter über OpenAI (`gpt-image-*`).
 */
export const TEXT_PROVIDERS = [
  {
    value: "openai",
    label: "OpenAI (gpt-4o)",
    hint: "Bisheriges Modell. Kostenpflichtig, sehr zuverlässig – auch bei strukturierten Ausgaben (Charakter- und Szenario-Erzeugung).",
  },
  {
    value: "gemini",
    label: "Google Gemini",
    hint: "Kostenloses Kontingent über Google AI Studio. Braucht GEMINI_API_KEY in .env.local. Bei strukturierten Ausgaben (Charakter erzeugen, Szenario ableiten) noch nicht garantiert – im Zweifel wieder auf OpenAI stellen.",
  },
] as const;

export type TextProvider = (typeof TEXT_PROVIDERS)[number]["value"];

/** Default bleibt OpenAI, damit sich ohne Zutun nichts am Verhalten ändert. */
export const DEFAULT_TEXT_PROVIDER: TextProvider = "openai";

export const textProviderSchema = z.enum(
  TEXT_PROVIDERS.map((p) => p.value) as [TextProvider, ...TextProvider[]],
);

/**
 * Was der Client schicken darf – hier greift die Allowlist.
 */
export const settingsPatchSchema = z.object({
  imageModel: imageModelSchema,
  imageQuality: imageQualitySchema,
  textProvider: textProviderSchema,
});

/**
 * Was der Server zurückgibt. Bewusst `string` und nicht `ImageModel`: ein über
 * `OPENAI_IMAGE_MODEL` gesetztes Modell ist serverseitige Konfiguration und
 * wird respektiert, auch wenn es nicht in der Auswahlliste steht.
 */
export interface Settings {
  imageModel: string;
  imageQuality: ImageQuality;
  textProvider: TextProvider;
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

  /**
   * **KI-Modell, mit dem der Beschreibungstext erzeugt wurde** – ein Protokoll
   * des Erstellungszeitpunkts wie die übrigen Vorgaben, und wie sie reine
   * Anzeige. Kein Formularfeld: Welches Modell lief, weiß erst die Route
   * (`getTextClient`); der Client hängt den Wert beim Speichern an
   * (`{ ...input, imageStyle, model }`, wie schon `imageStyle`). Optional und
   * **leer bei Altbeständen und Importen** – die Vorgaben-Ansicht zeigt das dann
   * als „— nichts angegeben —". Bewusst der rohe Modellname (z. B.
   * `gemini-flash-lite-latest`), nicht der Anbieter: der Name ist eindeutig und
   * die Anzeige leitet den Anbieter daraus ab.
   */
  model: z.string().trim().max(120).optional().default(""),
});

export type CharacterInput = z.infer<typeof characterInputSchema>;

/**
 * **Zufällige Figur:** das Schema, mit dem die KI das *ganze* Erstellen-Formular
 * auf einmal füllt (Structured Output). Es enthält genau die vom Nutzer
 * ausfüllbaren Felder – **kein** `imageStyle` (eine Darstellungswahl, kein
 * Inhalt) und **kein** `model` (steht erst beim Speichern fest).
 *
 * Anders als in `characterInputSchema` ist das **Geschlecht** hier auf konkrete
 * Werte beschränkt: „egal" ist eine *Vorgabe* („überrasch mich"), keine
 * *Antwort* – die Zufallsfigur soll ein Geschlecht haben. Und **keine**
 * `.max()`-Grenzen: Structured Outputs verträgt `maxLength` nicht überall
 * zuverlässig, und die Route deckelt die Antwort ohnehin auf die
 * `characterInputSchema`-Grenzen (dieselbe Überlegung wie bei `.int()`, s.
 * Fallstricke in CLAUDE.md).
 */
export const randomInputSchema = z.object({
  genre: z
    .enum(GENRE_TEMPLATES.map((g) => g.id) as [string, ...string[]])
    .describe("Passendes Genre aus der vorgegebenen Liste"),
  name: z.string().describe("Vollständiger Name (Vor- und Nachname)"),
  gender: z
    .enum(["weiblich", "männlich", "divers"])
    .describe("Konkretes Geschlecht – nie 'egal'"),
  age: z.string().describe("Alter, z. B. 'Mitte 30' oder '19'"),
  ethnicity: z.string().describe("Herkunft / Ethnie"),
  appearance: z.string().describe("Aussehen: Haare, Augen, Statur, Kleidung"),
  setting: z.string().describe("Setting in wenigen Worten (Welt, Epoche)"),
  occupation: z.string().describe("Beruf / Rolle"),
  background: z.string().describe("Hintergrund: Herkunft, prägende Ereignisse"),
  personality: z.string().describe("Persönlichkeit: einige Wesenszüge"),
  notes: z.string().describe("Weitere prägende Eigenheit für die Figur"),
});

export type RandomInput = z.infer<typeof randomInputSchema>;

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
  model: "Erzeugt mit",
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
  // Der rohe Modellname ist eindeutig; für die Anzeige den Anbieter davorsetzen.
  // Unbekannte Namen (eigenes `OPENAI_TEXT_MODEL` o. Ä.) bleiben roh stehen.
  if (key === "model") {
    if (raw.startsWith("gemini")) return `Google Gemini · ${raw}`;
    if (raw.startsWith("gpt")) return `OpenAI · ${raw}`;
    return raw;
  }
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
  figuren: 3000,
  handlung: 4000,
  handlungselemente: 3000,
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
  figuren: z
    .string()
    .trim()
    .max(SCENARIO_MAXLENGTHS.figuren)
    .optional()
    .default(""),
  handlung: z
    .string()
    .trim()
    .max(SCENARIO_MAXLENGTHS.handlung)
    .optional()
    .default(""),
  // Handlungselemente – eine Liste (je Zeile eines, inaktive mit `⊘ `-Präfix wie
  // die Figuren, s. `lib/figuren.ts`). Vorgaben für die Handlungsentwurf-
  // Erzeugung; die **aktiven** fließen in `scenario-plot` (leer = Prompt wie vorher).
  handlungselemente: z
    .string()
    .trim()
    .max(SCENARIO_MAXLENGTHS.handlungselemente)
    .optional()
    .default(""),
});

/**
 * **Zufälliges Szenario:** das Schema, mit dem die KI das Anlege-Formular auf
 * einmal füllt (Structured Output) – das Gegenstück zu `randomInputSchema` beim
 * Charakter.
 *
 * Enthält **Name** (eine echte Spalte, kein Teil der Festlegungen) plus die
 * **Welt**-Felder. **Kein `handlung`**: Der Handlungsentwurf ist im Projekt aus
 * den zugeordneten Figuren abgeleitet, und ein frisches Szenario hat keine – er
 * hat auf der Anlege-Seite deshalb auch keinen Erzeugen-Knopf. Wie beim
 * Charakter ist das **Genre** ein Enum (die Route erzwingt den Wert zusätzlich)
 * und es gibt **keine** `.max()`-Grenzen (die Route deckelt auf
 * `SCENARIO_MAXLENGTHS`).
 */
export const randomScenarioSchema = z.object({
  name: z.string().describe("Kurzer, treffender Name des Szenarios"),
  genre: z
    .enum(GENRE_TEMPLATES.map((g) => g.id) as [string, ...string[]])
    .describe("Passendes Genre aus der vorgegebenen Liste"),
  ort: z
    .string()
    .describe("Ort als Gebiet: ein Rahmen plus zwei bis drei Schauplätze darin"),
  zeit: z
    .string()
    .describe("Zeit als Zeitraum: ein Rahmen plus eine Spanne"),
  regeln: z
    .string()
    .describe(
      "Regeln/Technikstand der Welt als vollständige Sätze, ohne Eigennamen und Zahlen",
    ),
  beschreibung: z
    .string()
    .describe("Zwei bis drei Absätze über die Welt: Atmosphäre, Alltag, Stimmung"),
  figuren: z
    .string()
    .describe(
      "Zwei bis vier wichtige Personen, um die es gehen könnte – je Zeile Name und ein bis zwei Sätze zu Rolle, Wesen und einem Riss (Wunsch, Geheimnis, Konflikt). Noch keine ausgearbeiteten Charaktere, sondern Anhaltspunkte für einen späteren Handlungsentwurf.",
    ),
  handlungselemente: z
    .string()
    .describe(
      "Ein bis drei knappe Handlungselemente, je Zeile eines – ein Konflikt, ein Ereignis, ein Geheimnis, ein Ziel oder eine Wendung, die eine Geschichte in dieser Welt tragen könnte. Stecken in der Vorgabe des Nutzers Ansätze zur Handlung, halte genau diese fest; sonst schlage passende vor. Noch kein ausgearbeiteter Handlungsentwurf, sondern Bausteine dafür.",
    ),
});

export type RandomScenario = z.infer<typeof randomScenarioSchema>;

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
  // Die **Besetzung** – die dritte Säule neben Welt (Ort/Zeit/Regeln/
  // Beschreibung) und Handlung. Notizen zu wichtigen Personen, noch keine
  // ausgearbeiteten Charaktere. Steht **vor** dem Handlungsentwurf, weil dieser
  // sie mitverwendet.
  figuren: "Figuren",
  handlung: "Handlungsentwurf",
  // Handlungselemente – eine Liste von Vorgaben (Konflikte, Ereignisse,
  // Wendungen), die in den Handlungsentwurf einfließen. Steht **hinter** dem
  // Entwurf: sie speisen ihn, sind aber nicht der Entwurf selbst.
  handlungselemente: "Handlungselemente",
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
    "Fließtext über die Welt des Szenarios. Lässt sich aus den Festlegungen weiter unten erzeugen und danach frei bearbeiten.",
  figuren:
    "Wichtige Personen, um die es gehen soll – Notizen, noch keine ausgearbeiteten Charaktere. Fließt in den Handlungsentwurf und den Story Arc ein. Ein zufällig erzeugtes Szenario füllt das Feld mit.",
  handlung:
    "Wer gerät hier mit wem worüber aneinander? Lässt sich aus den Festlegungen und den zugeordneten Charakteren erzeugen – dafür muss das Szenario gespeichert sein und Figuren enthalten.",
  handlungselemente:
    "Bausteine für die Handlung – ein Konflikt, ein Ereignis, ein Geheimnis, eine Wendung. Die aktiven fließen als Vorgaben in den Handlungsentwurf. Ein zufällig erzeugtes Szenario füllt das Feld mit.",
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
  // Die Figuren entstehen aus der ganzen Welt – Beschreibung eingeschlossen.
  // Sie stehen erzeugungslogisch **hinter** ihr (wie die Handlung), fließen aber
  // nicht in sie zurück; ein Kreis entstünde also nicht.
  figuren: ["genre", "ort", "zeit", "regeln", "beschreibung"],
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
  "figuren",
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
 * **Mehrere Handlungsentwürfe je Szenario.**
 *
 * Ein Szenario kann mehrere Handlungsentwürfe halten, zwischen denen die
 * Oberfläche umschaltet; genau **einer** ist aktiv (`aktiv` als Index in
 * `items`). Die aktive Variante ist zugleich `details.handlung` – dort lesen
 * Export und Personensuche sie unverändert, ohne von den übrigen zu wissen.
 *
 * Bewusst eine **eigene** Struktur (und eigene Spalte `Scenario.plotVariants`)
 * neben `ScenarioDetails`, nicht ein weiteres Feld darin: Wie `storyHooks` am
 * Charakter ist das eine Liste, die die Oberfläche führt und die erst später
 * auf Knopfdruck entsteht – kein Bestandteil der Festlegungen, die den Rahmen
 * der Welt beschreiben.
 */
export const MAX_PLOT_VARIANTS = 20;

/**
 * Wie viele **neue benannte Personen** ein Handlungsentwurf auf Wunsch zusätzlich
 * einführen darf (Lauf-Parameter, nicht gespeichert). 0 = keine – dann gilt die
 * harte Regel „keine neuen Hauptfiguren" wie bisher. Die Obergrenze hält den
 * Entwurf beisammen: zu viele frische Namen zersprengen die Handlung.
 */
export const MAX_NEUE_PLOT_PERSONEN = 5;

/**
 * **Anzeige-Metadaten je Variante** (Handlungsentwurf **oder** Story Arc): ein
 * kurzer, per KI erzeugter Titel und die Erzählform/der Ton, mit denen die
 * Variante erzeugt wurde. Damit tragen die Reiter einen wiedererkennbaren Namen
 * und ein „Erzählform · Ton"-Badge, statt nur „Entwurf 1/2/3".
 *
 * Bewusst **parallel** zur `items`-Liste gehalten (`meta[i]` gehört zu
 * `items[i]`), nicht in die Einträge eingebettet: So bleiben `plotVariants.items`
 * ein `string[]` und `storyArcVariants.items` ein `StoryArc[]` – Altbestände und
 * **alte Exportdateien** (die kein `meta` kennen) bleiben gültig, das Feld ist
 * `.optional()`. `normalizeMetaList` füllt es beim Lesen auf `items.length` auf.
 * Erzählform/Ton sind sonst reine Lauf-Parameter (nicht gespeichert) – hier
 * werden sie **zum Erzeugungszeitpunkt** an der Variante festgehalten.
 */
export interface VariantMeta {
  /** Kurzer KI-Titel (leer bei Altbeständen, leeren oder von Hand angelegten). */
  titel: string;
  /** `STORY_FORMS`-Wert der Erzeugung (leer = unbekannt/Altbestand). */
  form: string;
  /** `STORY_TONES`-Wert der Erzeugung (leer = unbekannt/Altbestand). */
  ton: string;
  /**
   * Als **Favorit** markiert (per Stern am Reiter). Rein zur Kennzeichnung, ohne
   * Funktion darüber hinaus (keine Sortierung/Filterung). Default `false`.
   */
  favorit: boolean;
}

export const variantMetaSchema = z.object({
  titel: z.string().trim().max(120).optional().default(""),
  form: z.string().trim().max(40).optional().default(""),
  ton: z.string().trim().max(40).optional().default(""),
  favorit: z.boolean().optional().default(false),
});

/**
 * Bringt eine (womöglich fehlende oder zu kurze/lange) Metadaten-Liste auf genau
 * `laenge` Einträge – fehlende Positionen werden leer aufgefüllt, überzählige
 * fallen weg. Hält `meta` mit `items` in Deckung, egal was gespeichert war.
 */
export function normalizeMetaList(raw: unknown, laenge: number): VariantMeta[] {
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: laenge }, (_, i) => {
    const o = (arr[i] ?? {}) as Record<string, unknown>;
    return {
      titel: typeof o.titel === "string" ? o.titel : "",
      form: typeof o.form === "string" ? o.form : "",
      ton: typeof o.ton === "string" ? o.ton : "",
      favorit: typeof o.favorit === "boolean" ? o.favorit : false,
    };
  });
}

export interface PlotVariants {
  items: string[];
  aktiv: number;
  /** Anzeige-Metadaten, index-gleich zu `items` (s. `VariantMeta`). */
  meta: VariantMeta[];
}

export const plotVariantsSchema = z
  .object({
    items: z
      .array(z.string().trim().max(SCENARIO_MAXLENGTHS.handlung))
      .max(MAX_PLOT_VARIANTS),
    aktiv: z.number().int().nonnegative(),
    // Optional: alte Stände und Exportdateien kennen es nicht (`normalizeMetaList`
    // füllt beim Lesen auf `items.length` auf).
    meta: z.array(variantMetaSchema).optional(),
  })
  .refine((v) => (v.items.length === 0 ? v.aktiv === 0 : v.aktiv < v.items.length), {
    message: "Die aktive Variante liegt außerhalb der Liste.",
  });

/**
 * Bringt einen gespeicherten (oder fehlenden) Variantensatz in Form und hält
 * ihn mit `details.handlung` konsistent:
 *
 * - Fehlen gespeicherte Varianten (Altbestand, Import), wird die vorhandene
 *   `handlung` – sofern nicht leer – zur ersten und einzigen Variante. So hat
 *   jedes Szenario mit einem Handlungsentwurf genau eine Variante, ohne dass
 *   irgendwo ein Sonderfall „keine Varianten" nötig wäre.
 * - Ein `aktiv` außerhalb des gültigen Bereichs fällt auf 0 zurück.
 */
export function normalizePlotVariants(
  raw: unknown,
  handlung: string,
): PlotVariants {
  const src = (raw ?? {}) as {
    items?: unknown;
    aktiv?: unknown;
    meta?: unknown;
  };
  let items = Array.isArray(src.items)
    ? src.items.filter((x): x is string => typeof x === "string")
    : [];
  if (items.length === 0) items = handlung.trim() ? [handlung] : [];
  let aktiv = typeof src.aktiv === "number" ? src.aktiv : 0;
  if (!Number.isInteger(aktiv) || aktiv < 0 || aktiv >= items.length) aktiv = 0;
  return { items, aktiv, meta: normalizeMetaList(src.meta, items.length) };
}

// ---------------------------------------------------------------------------
// Story Arc – die dramaturgische Zerlegung des Handlungsentwurfs
// ---------------------------------------------------------------------------

/**
 * Die fünf Stufen der klassischen (deutschen) Dramaturgie nach Freytag –
 * bewusst der Fünfakter und nicht die Drehbuch-Beat-Sheets, weil das Ziel
 * „Buch/Spiel" ist. Die Reihenfolge **ist** die Dramaturgie: Sie steigt zum
 * Höhepunkt und fällt zur Auflösung. Deshalb encodiert die Oberfläche sie über
 * eine Farbfolge (echte Struktur, keine Deko), und der Prompt verlangt genau
 * diese Abfolge.
 */
export const ARC_PHASES = [
  { value: "exposition", label: "Exposition" },
  { value: "steigerung", label: "Steigerung" },
  { value: "hoehepunkt", label: "Höhepunkt" },
  { value: "fall", label: "Fall" },
  { value: "aufloesung", label: "Auflösung" },
] as const;

export type ArcPhase = (typeof ARC_PHASES)[number]["value"];

const ARC_PHASE_VALUES = ARC_PHASES.map((p) => p.value) as [
  ArcPhase,
  ...ArcPhase[],
];

/** Ein Label je Phase, für die Anzeige (Chip in der Zeitleiste). */
export const ARC_PHASE_LABELS = Object.fromEntries(
  ARC_PHASES.map((p) => [p.value, p.label]),
) as Record<ArcPhase, string>;

/**
 * Die Obergrenze der Stationen. Erzeugt werden je nach Länge 3, 5 oder 8; die
 * Grenze liegt darüber, damit von Hand hinzugefügte Stufen Platz haben.
 */
export const MAX_ARC_STUFEN = 20;

/** Wie viele Kapitel eine Stufe höchstens trägt (der größten Wahl entsprechend). */
export const MAX_KAPITEL_PRO_STUFE = 8;

/**
 * **Wie viele Kapitel ein „Kapitel ableiten" erzeugt** – als Spanne, aus der das
 * Modell wählt. Wie die Arc-Länge ein Lauf-Parameter (nicht gespeichert). Die
 * größte `max` bleibt ≤ `MAX_KAPITEL_PRO_STUFE`, damit die Wahl nie über die
 * Speichergrenze hinausläuft.
 */
export const KAPITEL_COUNTS = [
  { value: "wenig", label: "2–3", min: 2, max: 3 },
  { value: "mittel", label: "4–5", min: 4, max: 5 },
  { value: "viel", label: "6–8", min: 6, max: 8 },
] as const;

export type KapitelCount = (typeof KAPITEL_COUNTS)[number]["value"];
export const DEFAULT_KAPITEL_COUNT: KapitelCount = "wenig";

/** Spanne (min/max) zu einer Kapitelzahl-Wahl (Fallback: 2–3). */
export function kapitelSpanne(value: string): { min: number; max: number } {
  const e = KAPITEL_COUNTS.find((k) => k.value === value);
  return e ? { min: e.min, max: e.max } : { min: 2, max: 3 };
}

/**
 * **Kapitellänge** – wie viel **Prosa** ein „Story generieren" je Kapitel
 * schreibt. Bewusst **entkoppelt vom „kreativ"-Haken**: Länge und
 * Impulse/Temperatur sind zwei Dinge. `mittel` ist die frühere Vorgabe (der
 * „kreativ aus"-Fall), `lang` die frühere „kreativ an"-Länge – so bleibt das
 * Standardverhalten (mittel) zeichengleich. `sehr_lang` ist neu für
 * Roman-Kapitel. Ein Lauf-Parameter, nicht gespeichert. `hint` ist die
 * Längen-Anweisung im Prosa-Prompt, `maxTokens` das Ausgabe-Budget der Route.
 */
export const KAPITEL_LAENGEN = [
  {
    value: "kurz",
    label: "Kurz",
    hint: "Zwei bis vier Absätze (insgesamt ca. 1000–1800 Zeichen).",
    maxTokens: 1400,
  },
  {
    value: "mittel",
    label: "Mittel",
    hint: "Drei bis fünf Absätze (insgesamt ca. 1800–3200 Zeichen).",
    maxTokens: 1800,
  },
  {
    value: "lang",
    label: "Lang",
    hint: "Fünf bis acht Absätze (insgesamt ca. 3000–5000 Zeichen).",
    maxTokens: 2600,
  },
  {
    value: "sehr_lang",
    label: "Sehr lang",
    hint: "Acht bis zwölf Absätze (insgesamt ca. 5000–8000 Zeichen).",
    maxTokens: 3600,
  },
] as const;

export type KapitelLaenge = (typeof KAPITEL_LAENGEN)[number]["value"];
export const DEFAULT_KAPITEL_LAENGE: KapitelLaenge = "mittel";

/** Die Längen-Anweisung zu einer Kapitellänge (Fallback: mittel). */
export function kapitelLaengeHint(value: string): string {
  return (
    KAPITEL_LAENGEN.find((k) => k.value === value)?.hint ??
    KAPITEL_LAENGEN[1].hint
  );
}

/** Das Token-Budget zu einer Kapitellänge (Fallback: mittel). */
export function kapitelLaengeMaxTokens(value: string): number {
  return (
    KAPITEL_LAENGEN.find((k) => k.value === value)?.maxTokens ??
    KAPITEL_LAENGEN[1].maxTokens
  );
}

/**
 * **Ton und Sprache** der Erzeugung – geteilt von Handlungsentwurf, Story Arc
 * und Kapiteln, damit derselbe Ton die spätere Geschichte durchzieht. Ein
 * Lauf-Parameter (nicht gespeichert).
 *
 * `neutral` trägt bewusst **keinen** `hint`: dann kommt kein Ton-Block in den
 * Prompt und der Text entsteht wie bisher. Der `hint` ist die Anweisung an das
 * Modell, **wie** geschrieben wird (nicht **was**) – Wortwahl, Rhythmus,
 * Stimmung. Er beschreibt nie den Inhalt, sodass derselbe Ton in jeder Welt
 * funktioniert.
 */
export const STORY_TONES = [
  { value: "neutral", label: "Neutral", hint: "" },
  {
    value: "leidenschaftlich",
    label: "Leidenschaftlich",
    hint: "Schreibe leidenschaftlich und intensiv: große Gefühle, Nähe und Dringlichkeit. Kraftvolle Verben, ein drängender Rhythmus, hoher emotionaler Einsatz – der Text soll brennen.",
  },
  {
    value: "romantisch",
    label: "Romantisch",
    hint: "Schreibe romantisch und gefühlvoll: Sehnsucht, zarte Nähe, Blicke und Berührungen. Warme, sinnliche Bilder und ein weicher Rhythmus, das Herz im Vordergrund.",
  },
  {
    value: "derb",
    label: "Derb / vulgär",
    hint: "Schreibe derb und ungeschliffen: direkte, drastische Sprache, Kraftausdrücke und Körperlichkeit, kein Blatt vor dem Mund. Roh und ehrlich statt gefällig – so, wie an rauen Orten wirklich gesprochen und geflucht wird.",
  },
  {
    value: "cool",
    label: "Cool",
    hint: "Schreibe cool und unterkühlt: lakonisch, kontrolliert, mit Understatement. Kurze, trockene Sätze und beiläufige Distanz – nichts wird beschworen, alles bleibt lässig.",
  },
  {
    value: "humorvoll",
    label: "Humorvoll",
    hint: "Schreibe humorvoll und mit Augenzwinkern: Wortwitz, Situationskomik und ironische Beobachtungen. Leichtfüßig und pointiert, ohne die Figuren bloßzustellen.",
  },
  {
    value: "explizit",
    label: "Explizit",
    hint: "Schildere intime und sexuelle Momente ausdrücklich und detailliert, statt sie auszublenden oder anzudeuten – körperlich, sinnlich und konkret. Genau in diesen Momenten wird die Sprache direkter und etwas vulgär: deftige, körperliche Wörter statt Umschreibungen. Außerhalb solcher Szenen bleibt der Ton normal erzählend. Alle daran Beteiligten sind erwachsen und handeln einvernehmlich.",
  },
] as const;

export type StoryTone = (typeof STORY_TONES)[number]["value"];
export const DEFAULT_STORY_TONE: StoryTone = "neutral";

/** Die Ton-Anweisung zu einer Wahl (leer bei `neutral` oder unbekannt). */
export function toneHint(value: string): string {
  return STORY_TONES.find((t) => t.value === value)?.hint ?? "";
}

/**
 * **Erzählform** – die *Art* der Geschichte (Kriminalgeschichte,
 * Liebesgeschichte …). Eine **dritte Achse** neben Genre (der Welt) und Ton (dem
 * Wie): Anders als das Genre ist sie **nicht exklusiv zur Welt** – ein Krimi
 * spielt in jeder Welt, eine Liebesgeschichte auch. Sie steuert **Konflikt,
 * Aufbau und Schwerpunkt** der Handlung, nicht die Welt und nicht die Wortwahl.
 * Geteilt von Handlungsentwurf, Story Arc und Kapiteln; ein Lauf-Parameter
 * (nicht gespeichert), genau nach dem Muster von `STORY_TONES`.
 *
 * `allround` trägt bewusst **keinen** `hint`: dann kommt kein Erzählform-Block in
 * den Prompt und der Entwurf entsteht wie bisher (gemischt/offen). Der `hint`
 * beschreibt nie die Welt, damit dieselbe Form in jedem Genre funktioniert.
 */
export const STORY_FORMS = [
  // `value` bleibt "allround" (Bestandsdaten, `DEFAULT_STORY_FORM`); nur das
  // Label heißt jetzt „Allgemein". Der `hint` bleibt leer – kein Erzählform-Block.
  { value: "allround", label: "Allgemein", hint: "" },
  {
    value: "liebe",
    label: "Liebesgeschichte",
    hint: "Erzähle eine Liebesgeschichte: Ins Zentrum gehört eine sich entwickelnde Beziehung zwischen zwei (oder mehr) Figuren – Anziehung und Nähe, das, was sie trennt oder auf die Probe stellt, ein Bruch oder eine Prüfung und am Ende eine Entscheidung über die Bindung. Die zentrale Frage ist eine des Herzens: Finden sie zueinander, halten sie zusammen? Konflikte entspringen Gefühlen, Missverständnissen und widerstreitenden Loyalitäten.",
  },
  {
    value: "abenteuer",
    label: "Abenteuergeschichte",
    hint: "Erzähle ein Abenteuer: Ins Zentrum gehört ein Aufbruch mit einem greifbaren Ziel – eine Reise, ein Wagnis, eine Suche –, das gegen Hindernisse, fremde Orte und Gefahren errungen wird. Mut, Findigkeit und Zusammenhalt treiben die Handlung; die Spannung kommt aus äußeren Prüfungen und dem Vorwärtsdrang, nicht aus Grübeln. Jede Station bringt ein neues Hindernis oder eine neue Etappe.",
  },
  {
    value: "krimi",
    label: "Kriminalgeschichte",
    hint: "Erzähle eine Kriminalgeschichte: Ins Zentrum gehören eine Tat (ein Verbrechen, ein Vergehen) und die Suche nach der Wahrheit – Spuren, Verdächtige, falsche Fährten und am Ende eine Aufklärung, wer es war und warum. Die Spannung entsteht aus der Kluft zwischen Schein und Wahrheit; die Handlung schreitet als Ermittlung voran, in der nach und nach etwas ans Licht kommt.",
  },
  {
    value: "drama",
    label: "Drama",
    hint: "Erzähle ein Drama: Ins Zentrum gehören ein innerer und zwischenmenschlicher Konflikt – Beziehungen, moralische Zwickmühlen, Schuld, Verlust. Der Einsatz ist emotional und ethisch, nicht äußerlich; die Wendepunkte sind Entscheidungen und ihre Folgen. Es braucht kein großes Spektakel – die Geschichte lebt von den Figuren, ihren Widersprüchen und dem, was zwischen ihnen zerbricht oder heilt.",
  },
  {
    value: "thriller",
    label: "Thriller",
    hint: "Erzähle einen Thriller: Ins Zentrum gehören eine akute Bedrohung und wachsender Druck – Gefahr, eine tickende Uhr, Verfolgung, hoher Einsatz. Die Figuren müssen handeln, um ein Unheil abzuwenden; die Spannung kommt aus Unmittelbarkeit und der Ungewissheit über Gelingen oder Überleben. Jede Station verschärft die Lage und zieht die Schlinge enger.",
  },
  {
    value: "komoedie",
    label: "Komödie",
    hint: "Erzähle eine Komödie: Ins Zentrum gehören Verwicklungen, Missverständnisse und schiefe Lagen, die sich zuspitzen, bis sie sich – oft überraschend – auflösen. Die Figuren geraten durch Fehltritte, Verwechslungen und widerstreitende Absichten in immer verzwicktere Situationen; die Spannung kommt aus dem Auseinanderklaffen von Absicht und Wirkung, nicht aus Gefahr. Es steuert auf ein glückliches oder versöhnliches Ende zu, in dem sich die Knoten lösen. Jede Station verschärft die Verwicklung oder bringt eine neue Wendung.",
  },
  {
    value: "tragoedie",
    label: "Tragödie",
    hint: "Erzähle eine Tragödie: Ins Zentrum gehört der Fall einer Figur – durch einen eigenen Fehler, eine Schuld, eine Verblendung oder ein unabwendbares Schicksal. Was sie stark oder besonders macht, wird ihr zum Verhängnis; ihre Entscheidungen ziehen unaufhaltsam Unheil nach sich. Die Spannung entsteht aus der Ahnung des Kommenden und der Ohnmacht, es abzuwenden. Es endet in Verlust, Untergang oder Katastrophe – folgerichtig aus dem, was die Figur ist und tut. Jede Station treibt den Fall weiter und verschließt einen Ausweg.",
  },
  {
    value: "mystery",
    label: "Rätselgeschichte",
    hint: "Erzähle eine Rätselgeschichte: Ins Zentrum gehört ein Geheimnis – ein Verschwinden, ein unerklärliches Ereignis, eine verborgene Wahrheit –, das nach und nach durchdrungen wird. Anders als bei der Kriminalgeschichte muss kein Verbrechen dahinterstehen; es geht um das Enträtseln selbst. Die Spannung entsteht aus dem Sog des Ungeklärten: Hinweise, falsche Fährten und Teilantworten, die neue Fragen aufwerfen. Die Handlung schreitet als Aufdeckung voran, bis das Rätsel sich klärt – ganz oder in einem bewusst offenen Rest. Jede Station legt ein Stück frei und vertieft das Geheimnis.",
  },
  {
    value: "reifung",
    label: "Reifungsgeschichte",
    hint: "Erzähle eine Reifungsgeschichte: Ins Zentrum gehört eine Figur, die an ihren Erfahrungen wächst – vom Aufbruch aus einem unfertigen oder behüteten Zustand über Prüfungen, Irrtümer und Verluste bis zu einem gereiften, veränderten Selbst. Der eigentliche Schauplatz ist die innere Entwicklung; die äußeren Ereignisse sind die Anlässe, an denen sie sich vollzieht. Die Spannung kommt aus dem, was die Figur lernen, loslassen oder überwinden muss. Jede Station stellt sie vor eine Erfahrung, die sie verändert.",
  },
  {
    value: "intrige",
    label: "Intrige",
    hint: "Erzähle eine Intrige: Ins Zentrum gehören Machtkämpfe, Ränke und verdeckte Absichten – mehrere Parteien, die einander täuschen, benutzen und hintergehen, um Einfluss, Vorteil oder Herrschaft. Die Spannung entsteht aus verborgenen Plänen, wechselnden Bündnissen und dem Verrat, der jederzeit möglich ist; nichts ist, wie es scheint. Die Handlung schreitet als Zug und Gegenzug voran, bis sich die Fäden entwirren oder jemand triumphiert. Jede Station verschiebt das Kräfteverhältnis oder deckt eine verborgene Absicht auf.",
  },
  {
    value: "rache",
    label: "Rachegeschichte",
    hint: "Erzähle eine Rachegeschichte: Ins Zentrum gehören ein erlittenes Unrecht und der Wille zur Vergeltung – die ganze Handlung ist um dieses eine Ziel gebaut. Eine Figur verfolgt, wer ihr Leid zugefügt hat; der Weg dorthin fordert seinen Preis und wirft die Frage auf, ob die Rache befreit oder verzehrt. Die Spannung kommt aus der Annäherung an das Ziel und dem, was sie kostet. Es steuert auf die Vergeltung zu – vollzogen, verweigert oder ins Leere laufend. Jede Station bringt die Figur näher an den, der ihr Unrecht tat, oder stellt ihren Entschluss auf die Probe.",
  },
  {
    value: "survival",
    label: "Überlebensgeschichte",
    hint: "Erzähle eine Überlebensgeschichte: Ins Zentrum gehört das nackte Bestehen gegen eine übermächtige Bedrohung – Natur, Katastrophe, Not oder Isolation. Es geht um Hunger, Kälte, Erschöpfung, Gefahr und die Entscheidungen, die das Überleben verlangt, auch die harten. Die Spannung kommt aus der ständigen Bedrängnis und der Ungewissheit, ob und wer durchkommt. Die Handlung schreitet von Prüfung zu Prüfung voran, jede zehrt an Kräften und Mitteln. Jede Station verschärft die Lage oder fordert einen neuen Preis.",
  },
  {
    value: "satire",
    label: "Satire",
    hint: "Erzähle eine Satire: Ins Zentrum gehört die überzeichnete Kritik an Verhältnissen, Mächtigen oder menschlichen Torheiten – die Handlung führt Missstände durch Zuspitzung, Ironie und Bloßstellung vor. Figuren und Ereignisse sind bewusst übertrieben, um dahinter das Wahre kenntlich zu machen; der Witz hat eine Spitze. Die Spannung kommt aus dem Aufdecken und Vorführen, nicht aus Gefahr. Es steuert auf die Entlarvung zu. Jede Station treibt die Übertreibung weiter und legt eine Torheit oder ein Unrecht offen.",
  },
] as const;

export type StoryForm = (typeof STORY_FORMS)[number]["value"];
export const DEFAULT_STORY_FORM: StoryForm = "allround";

/** Die Erzählform-Anweisung zu einer Wahl (leer bei `allround` oder unbekannt). */
export function formHint(value: string): string {
  return STORY_FORMS.find((f) => f.value === value)?.hint ?? "";
}

/** Anzeige-Label einer Erzählform (roher Wert als Rückfall). */
export function formLabel(value: string): string {
  return STORY_FORMS.find((f) => f.value === value)?.label ?? value;
}

/** Anzeige-Label eines Tons (roher Wert als Rückfall). */
export function toneLabel(value: string): string {
  return STORY_TONES.find((t) => t.value === value)?.label ?? value;
}

/**
 * Das **„Erzählform · Ton"-Badge** einer Variante für die Reiter-Leiste –
 * **Erzählform zuerst**, dann Ton.
 *
 * Beide werden gezeigt, sobald sie gesetzt sind – **auch die Vorgaben**
 * (`allround` = „Allround", `neutral` = „Neutral"): Die Erzählform gehört sonst
 * bei den häufigen Standard-Läufen unter den Tisch. Nur **leere** Werte
 * (Altbestände, von Hand angelegte Varianten) fallen weg; bleibt nichts übrig,
 * ist das Ergebnis `""` (der Reiter zeigt dann nur den Titel).
 */
export function variantBadge(meta: { form: string; ton: string }): string {
  const teile: string[] = [];
  if (meta.form) teile.push(formLabel(meta.form));
  if (meta.ton) teile.push(toneLabel(meta.ton));
  return teile.join(" · ");
}

/**
 * **Länge des Arcs** – steuert, in wie viele Stationen der Handlungsentwurf
 * zerlegt wird. Die Zahl bestimmt die Dramaturgie: 3 = Kurzbogen (Anfang,
 * Wende, Ende), 5 = klassischer Fünfakter, 8 = Roman/Kampagne. Beschreibt einen
 * Lauf, nicht den Arc – wird nicht gespeichert.
 */
export const ARC_LENGTHS = [
  { value: "kurz", label: "Kurz · 3", stationen: 3 },
  { value: "mittel", label: "Mittel · 5", stationen: 5 },
  { value: "lang", label: "Lang · 8", stationen: 8 },
  { value: "sehr_lang", label: "Sehr lang · 10", stationen: 10 },
] as const;

export type ArcLength = (typeof ARC_LENGTHS)[number]["value"];
export const DEFAULT_ARC_LENGTH: ArcLength = "mittel";

/** Stationenzahl zu einer Länge (Fallback: Fünfakter). */
export function arcStationen(laenge: string): number {
  return ARC_LENGTHS.find((l) => l.value === laenge)?.stationen ?? 5;
}

/**
 * **Format des Arcs** – nur eine Tonlage im Prompt: `buch` liefert
 * Erzählabschnitte, `spiel` liefert spielbare Szenen (etwas, das eine Gruppe
 * *tut*). Passt zum Doppelzweck der App. Wird nicht gespeichert.
 */
export const ARC_FORMATS = [
  { value: "buch", label: "Buch · Erzählabschnitte" },
  { value: "spiel", label: "Spiel · Szenen" },
] as const;

export type ArcFormat = (typeof ARC_FORMATS)[number]["value"];
export const DEFAULT_ARC_FORMAT: ArcFormat = "buch";

/**
 * **Werkform** – die *führende* Einstellung für den ausgeschriebenen Text:
 * Kurzgeschichte, Novelle oder Roman (plus `frei` als Default = keine Vorgabe,
 * Verhalten wie bisher). Sie tut **zwei** Dinge:
 *
 * 1. **Belegt die Zahlen-Regler vor** (`presets`): Arc-Länge (Stationen),
 *    Kapitel je Station und Kapitellänge. Das ist reine UI-Vorbelegung – die drei
 *    bleiben danach frei justierbar (die Werkform bleibt trotzdem gewählt).
 * 2. **Prägt den Prosastil** (`stil`) – live bei jedem „Story generieren":
 *    verdichtet (Kurzgeschichte) bis ausladend (Roman). Das kann keine Zahl
 *    ausdrücken, deshalb wirkt die Werkform **zusätzlich** zur Kapitellänge.
 *
 * `frei` trägt **keinen** Stil (leerer Block) und **keine** Presets – dann bleibt
 * der Prosa-Prompt zeichengleich mit dem von vorher. Ein Lauf-Parameter, nicht
 * gespeichert. Die Presets sind bewusst moderat gewählt (ein „Roman" hier ist ein
 * kurzer Roman/Novelle-Plus); wer mehr will, dreht die Zahlen hoch.
 */
export const WERKFORMEN = [
  { value: "frei", label: "— frei —", stil: "" },
  {
    value: "kurzgeschichte",
    label: "Kurzgeschichte",
    stil: "Schreib **verdichtet wie in einer Kurzgeschichte**: ein enger Fokus, wenige Figuren, jeder Satz trägt. Kein Ausschweifen, keine Nebenstränge – die Szene läuft zielstrebig auf ihren Kern zu.",
    presets: { laenge: "kurz", kapitelAnzahl: "wenig", kapitelLaenge: "kurz" },
  },
  {
    value: "novelle",
    label: "Novelle",
    stil: "Schreib **wie in einer Novelle**: konzentriert auf einen zentralen Konflikt, mit etwas mehr Raum zur Entfaltung als in einer Kurzgeschichte, aber ohne die Breite eines Romans.",
    presets: { laenge: "mittel", kapitelAnzahl: "mittel", kapitelLaenge: "mittel" },
  },
  {
    value: "roman",
    label: "Roman",
    stil: "Schreib **ausladend wie in einem Roman**: Nimm dir Zeit für Innensicht, Atmosphäre und Nebenbeobachtungen, entwickle die Szene in Ruhe und gönn den Figuren Gedanken und Zwischentöne.",
    presets: { laenge: "lang", kapitelAnzahl: "viel", kapitelLaenge: "lang" },
  },
] as const;

export type Werkform = (typeof WERKFORMEN)[number]["value"];
export const DEFAULT_WERKFORM: Werkform = "frei";

/** Der Prosastil-Hinweis einer Werkform (leer bei `frei`/unbekannt). */
export function werkformStil(value: string): string {
  return WERKFORMEN.find((w) => w.value === value)?.stil ?? "";
}

/**
 * Die Vorbelegung (Arc-Länge, Kapitel je Station, Kapitellänge) einer Werkform –
 * `null` bei `frei`/unbekannt (dann nichts vorbelegen). Die Werte sind
 * `as const`-Literale und typkompatibel zu den jeweiligen Achsen.
 */
export function werkformPresets(value: string): {
  laenge: ArcLength;
  kapitelAnzahl: KapitelCount;
  kapitelLaenge: KapitelLaenge;
} | null {
  const w = WERKFORMEN.find((x) => x.value === value);
  return w && "presets" in w ? w.presets : null;
}

/**
 * **Die Structured-Output-Fassungen** (gehen an OpenAI). Alle Felder sind
 * Pflicht, tragen ihre Anweisung im `.describe()` und – wie überall im Projekt –
 * **keine** Längen-Constraints (`.max()` erzeugt `maxLength`, das Structured
 * Outputs ebenso ablehnt wie `.int()` `minimum`/`maximum`). Die Grenzen prüft
 * erst das Speicher-Schema unten.
 *
 * Die **Kapitel entstehen getrennt** (eigene Route, auf Knopfdruck je Stufe) –
 * deshalb kennt die Stufen-Erzeugung sie nicht, und `arcStufeSchema` trägt kein
 * `kapitel`. Die Arc-Route hängt beim Zurückgeben je Stufe ein leeres
 * `kapitel`-Array an.
 */
export const arcStufeSchema = z.object({
  titel: z
    .string()
    .describe("Kurzer, prägnanter Titel dieser Station (2–5 Wörter)"),
  phase: z
    .enum(ARC_PHASE_VALUES)
    .describe(
      "Die Dramaturgie-Stufe: exposition (Ausgangslage), steigerung (der Konflikt eskaliert), hoehepunkt (die Entscheidung), fall (die Folgen), aufloesung (der neue Zustand). Die Stationen müssen in dieser Reihenfolge stehen; bei mehr als fünf Stationen dürfen tragende Phasen mehrfach vorkommen, bei weniger werden benachbarte Phasen zusammengefasst.",
    ),
  beschreibung: z
    .string()
    .describe(
      "Was in dieser Station geschieht, als Fließtext ohne Nummerierung – ein bis zwei Sätze mehr genügen. Sie verändert die Lage gegenüber der vorigen Station.",
    ),
  figuren: z
    .array(z.string())
    .describe(
      "Die Namen der Figuren aus der mitgelieferten Besetzung, die diese Station tragen – exakt so geschrieben. Keine erfundenen Namen.",
    ),
});

export const storyArcSchema = z.object({
  stufen: z.array(arcStufeSchema),
});

/** Ein Kapitel – Überschrift und zwei bis drei Sätze, was darin passiert. */
export const kapitelSchema = z.object({
  titel: z.string().describe("Kurze Überschrift des Kapitels (2–6 Wörter)"),
  inhalt: z
    .string()
    .describe("Zwei bis drei Sätze, was in diesem Kapitel passiert"),
});

/** Die Antwort der Kapitel-Route – umschließendes Objekt (Structured Output). */
export const kapitelListeSchema = z.object({
  kapitel: z.array(kapitelSchema),
});

/**
 * **Die Speicher-/PATCH-Fassung** (kommt aus dem Client, geht in die Spalte).
 * Hier sitzen die Grenzen: Stufen- und Kapitelzahl und großzügige
 * Zeichenlängen. Großzügig, weil ein zu enges Limit – die Lehre aus
 * `storyHooks` und `ort`/`zeit` – **spät** zuschlägt: erst beim Speichern, wenn
 * die Arbeit getan ist. Phase bleibt ans Enum gebunden; `kapitel` ist optional
 * (Stufen ohne abgeleitete Kapitel), fehlt es, gilt die leere Liste.
 */
export const kapitelStoredSchema = z.object({
  titel: z.string().trim().max(200),
  inhalt: z.string().trim().max(2000),
  /**
   * Der **ausformulierte Prosatext** des Kapitels (Personen + Tätigkeiten,
   * Atmosphäre des Ortes, Dialog in wörtlicher Rede) – auf Knopfdruck erzeugt,
   * eine Ebene unter `inhalt` (der bleibt die Zusammenfassung). Optional mit
   * `default("")`: Kapitel ohne erzeugten Text und alte Exportdateien bleiben
   * gültig, ganz wie `kapitel` selbst nachträglich dazukam. Großzügig bemessen –
   * eine Szene mit Dialog wird lang.
   */
  text: z.string().trim().max(20000).default(""),
});

export const arcStufeStoredSchema = z.object({
  titel: z.string().trim().max(200),
  phase: z.enum(ARC_PHASE_VALUES),
  beschreibung: z.string().trim().max(5000),
  figuren: z.array(z.string().trim().max(120)).max(30),
  kapitel: z.array(kapitelStoredSchema).max(MAX_KAPITEL_PRO_STUFE).default([]),
});

export const storyArcStoredSchema = z.object({
  stufen: z.array(arcStufeStoredSchema).max(MAX_ARC_STUFEN),
});

// Die maßgeblichen Client-/Speicher-Typen kommen aus der Stored-Fassung: sie
// trägt die Kapitel, die die Struktur führt (die Gen-Fassung kennt sie nicht).
export type Kapitel = z.infer<typeof kapitelStoredSchema>;
export type ArcStufe = z.infer<typeof arcStufeStoredSchema>;
export type StoryArc = z.infer<typeof storyArcStoredSchema>;

/**
 * **Mehrere Story Arcs je Szenario.** Genau wie bei den Handlungsentwürfen
 * (`plotVariants`): Ein Szenario kann mehrere Arcs halten, zwischen denen die
 * Oberfläche umschaltet; genau **einer** ist aktiv (`aktiv` als Index in
 * `items`). Der aktive Arc steht zugleich in der Spalte `Scenario.storyArc` –
 * dort liest der Export ihn unverändert, ohne von den übrigen zu wissen.
 *
 * Eigene Spalte `Scenario.storyArcVariants` neben `storyArc`, dieselbe
 * Überlegung wie `plotVariants` neben `details.handlung`: eine Liste, die die
 * Oberfläche führt und die erst auf Knopfdruck wächst.
 */
export const MAX_STORY_ARCS = 20;

export interface StoryArcVariants {
  items: StoryArc[];
  aktiv: number;
  /** Anzeige-Metadaten, index-gleich zu `items` (Titel, Erzählform, Ton). */
  meta: VariantMeta[];
}

export const storyArcVariantsSchema = z
  .object({
    items: z.array(storyArcStoredSchema).max(MAX_STORY_ARCS),
    aktiv: z.number().int().nonnegative(),
    // Optional wie bei `plotVariantsSchema` – Altbestände/Exportdateien kennen
    // es nicht (`normalizeMetaList` füllt beim Lesen auf).
    meta: z.array(variantMetaSchema).optional(),
  })
  .refine(
    (v) => (v.items.length === 0 ? v.aktiv === 0 : v.aktiv < v.items.length),
    { message: "Der aktive Story Arc liegt außerhalb der Liste." },
  );

/**
 * Bringt einen gespeicherten (oder fehlenden) Arc in Form – für Altbestände und
 * Szenarien ohne abgeleiteten Arc `{ stufen: [] }`. Dieselbe Idee wie
 * `normalizePlotVariants`: kein Sonderfall „kein Arc" nötig, die leere Liste
 * ist der ruhende Zustand. Unbekannte Phasen fallen auf `exposition` zurück,
 * fehlende Kapitel auf die leere Liste – damit eine später ergänzte Struktur
 * (Kapitel kamen nach den Stufen dazu) Altbestände nicht ungültig macht.
 */
export function normalizeStoryArc(raw: unknown): StoryArc {
  const src = (raw ?? {}) as { stufen?: unknown };
  const stufen = Array.isArray(src.stufen)
    ? src.stufen.flatMap((s): ArcStufe[] => {
        if (!s || typeof s !== "object") return [];
        const o = s as Record<string, unknown>;
        const phase = ARC_PHASE_VALUES.includes(o.phase as ArcPhase)
          ? (o.phase as ArcPhase)
          : "exposition";
        const kapitel = Array.isArray(o.kapitel)
          ? o.kapitel.flatMap((k): Kapitel[] => {
              if (!k || typeof k !== "object") return [];
              const ko = k as Record<string, unknown>;
              return [
                {
                  titel: typeof ko.titel === "string" ? ko.titel : "",
                  inhalt: typeof ko.inhalt === "string" ? ko.inhalt : "",
                  text: typeof ko.text === "string" ? ko.text : "",
                },
              ];
            })
          : [];
        return [
          {
            titel: typeof o.titel === "string" ? o.titel : "",
            phase,
            beschreibung:
              typeof o.beschreibung === "string" ? o.beschreibung : "",
            figuren: Array.isArray(o.figuren)
              ? o.figuren.filter((x): x is string => typeof x === "string")
              : [],
            kapitel,
          },
        ];
      })
    : [];
  return { stufen };
}

/**
 * Bringt einen gespeicherten (oder fehlenden) Arc-Variantensatz in Form und
 * hält ihn mit dem aktiven Arc konsistent – analog zu `normalizePlotVariants`:
 *
 * - Fehlen gespeicherte Varianten (Altbestand, Import ohne das Feld), wird der
 *   vorhandene aktive Arc – sofern er Stationen hat – zur ersten und einzigen
 *   Variante. So hat jedes Szenario mit einem Arc genau eine Variante, ohne
 *   dass irgendwo ein Sonderfall „keine Varianten" nötig wäre.
 * - Jede gespeicherte Variante läuft durch `normalizeStoryArc` (Altbestände,
 *   unbekannte Phasen, fehlende Kapitel).
 * - Ein `aktiv` außerhalb des gültigen Bereichs fällt auf 0 zurück.
 */
export function normalizeStoryArcVariants(
  raw: unknown,
  aktiverArc: StoryArc,
): StoryArcVariants {
  const src = (raw ?? {}) as {
    items?: unknown;
    aktiv?: unknown;
    meta?: unknown;
  };
  let items = Array.isArray(src.items)
    ? src.items.map((x) => normalizeStoryArc(x))
    : [];
  if (items.length === 0)
    items = aktiverArc.stufen.length > 0 ? [aktiverArc] : [];
  let aktiv = typeof src.aktiv === "number" ? src.aktiv : 0;
  if (!Number.isInteger(aktiv) || aktiv < 0 || aktiv >= items.length) aktiv = 0;
  return { items, aktiv, meta: normalizeMetaList(src.meta, items.length) };
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
