/**
 * Dateiformat für den Export **eines Szenarios** – wahlweise mitsamt den ihm
 * zugeordneten Charakteren.
 *
 * Einordnung zwischen den beiden vorhandenen Formaten:
 * - `backup.ts` sichert die **ganze** Datenbank und ersetzt beim Einspielen
 *   alles.
 * - `characterFile.ts` ist **eine** Figur, additiv.
 * - Dieses hier liegt dazwischen: eine Welt und, wenn gewünscht, ihre
 *   Besetzung. Genau das, was man weitergibt, wenn jemand anders in derselben
 *   Welt weiterspielen soll.
 *
 * Die Charaktere stecken als `characterPayloadSchema` darin – dieselbe Form wie
 * in einer Einzeldatei, nur ohne deren Kopf. Ein Charakter aus einer
 * Szenario-Datei und einer aus seiner eigenen Datei sind damit identisch
 * aufgebaut, und ein später ergänztes Feld erreicht beide Formate zugleich.
 */

import { z } from "zod";
import { characterPayloadSchema } from "./characterFile";
import {
  plotVariantsSchema,
  scenarioDetailsSchema,
  storyArcStoredSchema,
  storyArcVariantsSchema,
} from "./schema";

/** Erkennungsmerkmal im Dateikopf – schützt davor, irgendein JSON einzulesen. */
export const SCENARIO_FILE_KIND = "charakter-creator/scenario";

/**
 * Version des Formats. **Ohne Sprung** um `images` erweitert: Das Feld ist
 * optional, alte Dateien (mit `imageData`/`thumbnail`) lesen unverändert, und
 * ältere Programmstände überlesen `images` in neuen Dateien. Ein Sprung hätte
 * hier nur ältere Dateien abgelehnt – dieselbe Überlegung wie bei `storyHooks`.
 */
export const SCENARIO_FILE_VERSION = 1;

/**
 * Ein einzelnes Weltbild in der Datei – dieselbe Form wie ein Charakter-Bild:
 * Original als Data-URL, optionale Vorschau, Primärmarkierung. Ohne Markierung
 * gewinnt beim Import das erste Bild.
 */
const scenarioImagePayloadSchema = z.object({
  imageData: z.string(),
  thumbnail: z.string().nullable().optional(),
  isPrimary: z.boolean().optional().default(false),
});

export const scenarioFileSchema = z.object({
  kind: z.literal(SCENARIO_FILE_KIND),
  version: z.number(),
  /** Nur informativ, damit die Datei beim Draufschauen etwas sagt. */
  exportedAt: z.string().optional(),
  scenario: z.object({
    name: z.string(),
    /**
     * Über `scenarioDetailsSchema` und nicht lose wie die Merkmale in
     * `characterFile.ts`: Die Festlegungen sind alle optional mit
     * `default("")`, ein später ergänztes Feld fehlt in alten Dateien also
     * folgenlos. Genau die Eigenschaft, die den Merkmalen fehlt und dort die
     * lose Prüfung nötig macht.
     */
    details: scenarioDetailsSchema,
    /**
     * Die übrigen Bestandteile eines Szenarios – **alle optional**, damit alte
     * Dateien (die sie nicht kennen) unverändert lesen und **ohne
     * Versionssprung**: dieselbe Überlegung wie bei `storyHooks` in
     * `characterFile.ts`. Fehlen sie, füllt der Import bzw. `serializeScenario`
     * sie auf (leere Liste, leerer Arc, kein Bild).
     *
     * - `plotVariants`: **alle** Handlungsentwürfe samt aktivem Index. Ohne sie
     *   überlebte nur der aktive über `details.handlung` – die übrigen Entwürfe
     *   gingen beim Export verloren.
     * - `storyArc`: der **aktive** Story Arc samt Kapiteln.
     * - `storyArcVariants`: **alle** Story Arcs samt aktivem Index – dieselbe
     *   Überlegung wie `plotVariants`. Ohne sie überlebte nur der aktive über
     *   `storyArc`. Fehlt das Feld (alte Dateien), faltet der Import den einen
     *   `storyArc` zur einzigen Variante.
     * - `images`: **alle Weltbilder** (Originale ~2 MB + Vorschauen), seit ein
     *   Szenario – wie ein Charakter – mehrere Bilder haben kann.
     * - `imageData`/`thumbnail`: das **einzelne** Weltbild älterer Dateien (vor
     *   der Mehrbild-Umstellung). Bleibt für die Rückwärts-Lesbarkeit erhalten;
     *   der Import faltet es zum einzigen, primären Bild. Neue Exporte schreiben
     *   stattdessen `images`.
     */
    plotVariants: plotVariantsSchema.optional(),
    storyArc: storyArcStoredSchema.optional(),
    storyArcVariants: storyArcVariantsSchema.optional(),
    images: z.array(scenarioImagePayloadSchema).optional(),
    imageData: z.string().optional(),
    thumbnail: z.string().optional(),
  }),
  /**
   * Die zugeordneten Charaktere – **leer, wenn beim Export abgewählt**.
   *
   * Ein Szenario ohne Besetzung ist eine vollständige, sinnvolle Datei: Die
   * Welt steht für sich, und wer sie weitergibt, will oft gerade nicht die
   * Figuren mitgeben. Deshalb ist die Liste kein optionales Feld mit
   * Sonderbedeutung, sondern schlicht leer.
   *
   * Sie ist zugleich der Grund, warum diese Dateien groß werden: Jedes
   * Bild-Original steckt als Base64-Data-URL darin, rund 2 MB das Stück.
   */
  characters: z.array(characterPayloadSchema).default([]),
});

export type ScenarioFile = z.infer<typeof scenarioFileSchema>;

/**
 * Was bewusst **nicht** in der Datei steht – dieselben Gründe wie bei
 * `characterFile.ts`: keine `id` (der Import legt neu an, eine mitgeführte Id
 * lüde zum Überschreiben ein), keine `scenarioId` an den Charakteren (die
 * ergibt sich beim Einspielen aus dem Szenario selbst) und kein `createdAt`
 * (maßgeblich ist, wann etwas in *diese* Datenbank kam).
 */

/** Dateiname für den Export, z. B. `Das_Silber_von_Vigo.szenario.json`. */
export function scenarioFileName(safeName: string): string {
  return `${safeName}.szenario.json`;
}
