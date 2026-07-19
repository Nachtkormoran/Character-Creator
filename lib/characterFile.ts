/**
 * Dateiformat für den Export/Import **einzelner** Charaktere.
 *
 * Abgrenzung zur Datenbank-Sicherung (`backup.ts`): die sichert die ganze
 * SQLite-Datei und **ersetzt** beim Einspielen den gesamten Bestand. Dieses
 * Format ist das Gegenteil – eine Datei ist genau ein Charakter, und der Import
 * legt ihn **zusätzlich** an. Damit lassen sich Figuren zwischen Installationen
 * bewegen oder einzeln archivieren, ohne alles andere zu verlieren.
 *
 * Geteilt zwischen Browser (schreibt die Datei) und Route (liest sie).
 */

import { z } from "zod";
import { characterInputSchema } from "./schema";

/** Erkennungsmerkmal im Dateikopf – schützt davor, irgendein JSON einzulesen. */
export const CHARACTER_FILE_KIND = "charakter-creator/character";

/** Version des Formats. Erhöhen, sobald sich die Struktur bricht. */
export const CHARACTER_FILE_VERSION = 1;

/**
 * Die Merkmale werden **bewusst lose** validiert und beim Import durch
 * `normalizeTraits` geschickt, statt sie gegen `characterTraitsSchema` zu
 * prüfen. Sonst ließe sich eine heute geschriebene Datei nicht mehr einlesen,
 * sobald ein neues Merkmal dazukommt – genau der Fall, der in `CLAUDE.md` unter
 * „Altbestände und neue Merkmale" beschrieben ist. Eine Exportdatei ist ein
 * Altbestand, der nur außerhalb der Datenbank liegt.
 */
export const characterFileSchema = z.object({
  kind: z.literal(CHARACTER_FILE_KIND),
  version: z.number(),
  /** Nur informativ, damit die Datei beim Draufschauen etwas sagt. */
  exportedAt: z.string().optional(),
  input: characterInputSchema,
  character: z.object({
    name: z.string(),
    kurzbeschreibung: z.string().default(""),
    beschreibung: z.string().default(""),
    merkmale: z.record(z.string(), z.unknown()).default({}),
    /**
     * Optional und **ohne** Versionssprung ergänzt: ältere Dateien haben das
     * Feld nicht (`default("")` fängt das ab), und ältere Stände dieser
     * Anwendung überlesen es in neuen Dateien. Beide Richtungen bleiben also
     * lesbar – eine Formatversion hätte hier nichts geschützt, nur den Import
     * älterer Dateien abgelehnt.
     */
    storyHooks: z.string().default(""),
  }),
  /**
   * Bilder als Data-URLs, jeweils Original **und** Vorschau. Das Thumbnail
   * entsteht sonst nur clientseitig über Canvas – der Server könnte es beim
   * Import nicht nachbauen, und der Charakter käme ohne Vorschaubild an.
   */
  images: z
    .array(
      z.object({
        imageData: z.string(),
        thumbnail: z.string().nullable().optional(),
        isPrimary: z.boolean().optional(),
      }),
    )
    .default([]),
});

export type CharacterFile = z.infer<typeof characterFileSchema>;

/**
 * Was bewusst **nicht** in der Datei steht:
 *
 * - `id` – der Import legt immer neu an. Eine mitgeführte Id lüde dazu ein,
 *   beim Wiedereinspielen einen bestehenden Charakter zu überschreiben; genau
 *   das soll additiv gerade nicht passieren.
 * - `groupId` – eine Gruppen-Id aus einer fremden Datenbank bedeutet hier
 *   nichts. Importierte Charaktere landen ohne Gruppe und werden zugeordnet.
 * - `createdAt` – maßgeblich ist, wann der Charakter in *diese* Datenbank kam.
 *   Sonst sortierte er sich unter „Neueste zuerst" in die Vergangenheit ein,
 *   also genau dorthin, wo man ihn nach dem Import nicht sucht.
 */

/** Dateiname für den Export, z. B. `Ella_Sundstroem.charakter.json`. */
export function characterFileName(safeName: string): string {
  return `${safeName}.charakter.json`;
}
