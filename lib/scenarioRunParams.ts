import { z } from "zod";
import {
  ARC_FORMATS,
  ARC_LENGTHS,
  DEFAULT_ARC_FORMAT,
  DEFAULT_ARC_LENGTH,
  DEFAULT_KAPITEL_COUNT,
  DEFAULT_KAPITEL_LAENGE,
  DEFAULT_STORY_FORM,
  DEFAULT_STORY_TONE,
  DEFAULT_WERKFORM,
  KAPITEL_COUNTS,
  KAPITEL_LAENGEN,
  STORY_FORMS,
  STORY_TONES,
  WERKFORMEN,
} from "./schema";

/**
 * **Zuletzt gewählte Lauf-Parameter eines Szenarios** – für Handlungsentwurf und
 * Story Arc. Bewusst **pro Gerät im `localStorage`** gemerkt, nicht in der DB:
 *
 * - Es sind **Lauf-Parameter**, kein Szenario-Inhalt (die App trennt beides
 *   streng; Ton/Erzählform/Werkform … beschreiben, *wie* man das Szenario gerade
 *   befragt, nicht das Szenario selbst). Sie gehören deshalb nicht in `details`,
 *   die Varianten oder den Export.
 * - So bleibt die „Änderungen speichern"-Logik unberührt: Das Umstellen eines
 *   Reglers macht das Szenario **nicht** „ungespeichert".
 *
 * Der **Zusatzwunsch** (`zusatz`) wird bewusst **nicht** gemerkt – er beschreibt
 * einen einzelnen Lauf, nicht eine dauerhafte Vorliebe.
 *
 * Gespeichert wird je Szenario-Id. Gegen kaputte/veraltete `localStorage`-Werte
 * fällt jedes Feld über `.catch(...)` einzeln auf seinen Default zurück.
 */

/** Zieht die `value`-Liste einer `{ value }[]`-Konstante als Enum-Tupel. */
function werte<T extends string>(
  arr: ReadonlyArray<{ value: T }>,
): [T, ...T[]] {
  return arr.map((a) => a.value) as [T, ...T[]];
}

const handlungDefault = {
  form: DEFAULT_STORY_FORM,
  ton: DEFAULT_STORY_TONE,
};

const arcDefault = {
  werkform: DEFAULT_WERKFORM,
  laenge: DEFAULT_ARC_LENGTH,
  format: DEFAULT_ARC_FORMAT,
  kapitelAnzahl: DEFAULT_KAPITEL_COUNT,
  kapitelLaenge: DEFAULT_KAPITEL_LAENGE,
  ton: DEFAULT_STORY_TONE,
  form: DEFAULT_STORY_FORM,
  kreativ: false,
  weiterspinnen: false,
};

export const scenarioRunParamsSchema = z
  .object({
    handlung: z
      .object({
        form: z.enum(werte(STORY_FORMS)).catch(DEFAULT_STORY_FORM),
        ton: z.enum(werte(STORY_TONES)).catch(DEFAULT_STORY_TONE),
      })
      .catch(handlungDefault),
    arc: z
      .object({
        werkform: z.enum(werte(WERKFORMEN)).catch(DEFAULT_WERKFORM),
        laenge: z.enum(werte(ARC_LENGTHS)).catch(DEFAULT_ARC_LENGTH),
        format: z.enum(werte(ARC_FORMATS)).catch(DEFAULT_ARC_FORMAT),
        kapitelAnzahl: z
          .enum(werte(KAPITEL_COUNTS))
          .catch(DEFAULT_KAPITEL_COUNT),
        kapitelLaenge: z
          .enum(werte(KAPITEL_LAENGEN))
          .catch(DEFAULT_KAPITEL_LAENGE),
        ton: z.enum(werte(STORY_TONES)).catch(DEFAULT_STORY_TONE),
        form: z.enum(werte(STORY_FORMS)).catch(DEFAULT_STORY_FORM),
        kreativ: z.boolean().catch(false),
        weiterspinnen: z.boolean().catch(false),
      })
      .catch(arcDefault),
  })
  .catch({ handlung: handlungDefault, arc: arcDefault });

export type ScenarioRunParams = z.infer<typeof scenarioRunParamsSchema>;

/** Die Vorgabewerte (frisch, damit niemand die geteilte Referenz mutiert). */
export function defaultRunParams(): ScenarioRunParams {
  return { handlung: { ...handlungDefault }, arc: { ...arcDefault } };
}

const schluessel = (id: string) => `cc:scenarioRunParams:${id}`;

/**
 * Lädt die gemerkten Lauf-Parameter eines Szenarios. Kein Eintrag, kaputtes JSON
 * oder ein veralteter Wert → Defaults (feldweise über das Schema).
 */
export function ladeRunParams(id: string): ScenarioRunParams {
  if (typeof window === "undefined") return defaultRunParams();
  try {
    const roh = window.localStorage.getItem(schluessel(id));
    if (!roh) return defaultRunParams();
    return scenarioRunParamsSchema.parse(JSON.parse(roh));
  } catch {
    return defaultRunParams();
  }
}

/** Merkt die Lauf-Parameter eines Szenarios (fehlertolerant – z. B. bei vollem Speicher). */
export function speichereRunParams(id: string, werte: ScenarioRunParams): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(schluessel(id), JSON.stringify(werte));
  } catch {
    // localStorage voll/deaktiviert – das Merken ist Komfort, kein Muss.
  }
}
