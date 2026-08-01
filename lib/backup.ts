import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/app/generated/prisma/client";
import { prisma } from "./prisma";

/**
 * Sicherung und Wiederherstellung der SQLite-Datenbank.
 *
 * Nur serverseitig verwenden (Node-Runtime, Dateisystemzugriff).
 */

/**
 * Tabellen, die eine gültige Sicherung enthalten muss.
 *
 * `Scenario` fehlt hier bewusst: die Tabelle hieß bis zur Umbenennung `Group`,
 * und beide Namen sind gültig. Welcher vorliegt, entscheidet sich beim Lesen.
 */
const REQUIRED_TABLES = ["Character", "Setting"] as const;

/** SQLite-Dateien beginnen mit dieser Signatur. */
const SQLITE_MAGIC = Buffer.from("SQLite format 3\0", "utf8");

/** Pfad der aktiven Datenbank aus DATABASE_URL (z. B. "file:./dev.db"). */
export function databasePath(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const relative = url.replace(/^file:/, "");
  return path.resolve(process.cwd(), relative);
}

export interface ExportOptions {
  /**
   * Ob die **Bild-Originale** (`imageData`, je ~2 MB) mitgesichert werden. Die
   * **Thumbnails** sind davon unberührt und immer dabei – nur sie zeigt die App
   * in Listen, Karten und der Detailvorschau. Default `true` (Vollsicherung).
   */
  includeOriginals?: boolean;
}

/**
 * Streift in einer **Kopie** der Datenbank die Bild-Originale ab: `imageData`
 * wird geleert (die `thumbnail`-Spalte bleibt), danach `VACUUM`, damit die Datei
 * auch tatsächlich schrumpft. Läuft über einen zweiten Client auf die Kopie –
 * die aktive Datenbank bleibt unangetastet.
 */
async function stripOriginals(dbPath: string): Promise<void> {
  const client = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${dbPath}` }),
  });
  try {
    await client.$executeRawUnsafe(`UPDATE CharacterImage SET imageData = ''`);
    await client.$executeRawUnsafe(`UPDATE ScenarioImage SET imageData = ''`);
    // Ohne VACUUM bliebe die Datei so groß wie mit Originalen (SQLite gibt den
    // Platz sonst nicht frei).
    await client.$executeRawUnsafe(`VACUUM`);
  } finally {
    await client.$disconnect();
  }
}

/**
 * Erzeugt einen **konsistenten** Snapshot der Datenbank.
 *
 * Bewusst `VACUUM INTO` statt die Datei zu kopieren: ein simples Kopieren
 * während laufender Schreibzugriffe kann eine unvollständige Datei liefern.
 *
 * Mit `includeOriginals: false` werden die großen Bild-Originale aus der Kopie
 * entfernt (Thumbnails bleiben) – eine deutlich kleinere Sicherung, die weiter
 * alle Texte, Merkmale, Szenarien und die Vorschaubilder trägt.
 */
export async function exportDatabase(
  options: ExportOptions = {},
): Promise<Buffer> {
  const includeOriginals = options.includeOriginals !== false;
  const dir = await mkdtemp(path.join(tmpdir(), "cc-backup-"));
  const target = path.join(dir, `backup-${randomUUID()}.db`);
  try {
    // Kein Prisma-Modell im Spiel – daher als Raw-Statement. Der Pfad kommt
    // aus randomUUID/tmpdir, nicht aus Nutzereingaben.
    await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    if (!includeOriginals) await stripOriginals(target);
    return await readFile(target);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export interface ImportResult {
  characters: number;
  images: number;
  scenarios: number;
  settings: number;
  /** Pfad der Sicherheitskopie, die vor dem Überschreiben angelegt wurde. */
  safetyCopy: string;
}

/**
 * Ersetzt den **gesamten** Inhalt der Datenbank durch den der hochgeladenen
 * Datei. Vorher wird eine Sicherheitskopie des aktuellen Standes abgelegt.
 *
 * Bewusst inhaltlich (Zeilen kopieren) statt die Datei auszutauschen: Prisma
 * hält eine offene Verbindung, ein Dateitausch im laufenden Betrieb würde sie
 * ins Leere laufen lassen. So bleibt der Server benutzbar.
 */
export async function importDatabase(file: Buffer): Promise<ImportResult> {
  if (!file.subarray(0, SQLITE_MAGIC.length).equals(SQLITE_MAGIC)) {
    throw new Error(
      "Das ist keine SQLite-Datenbank. Bitte eine zuvor exportierte .db-Datei wählen.",
    );
  }

  const dir = await mkdtemp(path.join(tmpdir(), "cc-import-"));
  const uploadPath = path.join(dir, "upload.db");

  try {
    await writeFile(uploadPath, file);

    // Zweiter Client auf die hochgeladene Datei. Gelesen wird per Raw-Query
    // (`SELECT *`), damit auch Sicherungen aus einer älteren Schema-Version
    // funktionieren, denen einzelne Spalten fehlen.
    const source = new PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: `file:${uploadPath}` }),
    });
    let characters: Array<Record<string, unknown>>;
    let scenarios: Array<Record<string, unknown>>;
    let settings: Array<Record<string, unknown>>;
    let images: Array<Record<string, unknown>>;
    let scenarioImages: Array<Record<string, unknown>>;
    try {
      const tableRows = await source.$queryRawUnsafe<Array<{ name: string }>>(
        "SELECT name FROM sqlite_master WHERE type='table'",
      );
      const tables = new Set(tableRows.map((r) => r.name));
      const missing = REQUIRED_TABLES.filter((t) => !tables.has(t));
      if (missing.length > 0) {
        throw new Error(
          `Der Datei fehlen erwartete Tabellen: ${missing.join(", ")}. Stammt sie aus dieser App?`,
        );
      }

      characters = await source.$queryRawUnsafe("SELECT * FROM Character");
      settings = await source.$queryRawUnsafe("SELECT * FROM Setting");

      // Die Tabelle hieß bis zur Umbenennung `Group` (und die Spalte am
      // Charakter `groupId`). Sicherungen von davor tragen die alten Namen –
      // dieselbe Lage wie bei `CharacterImage` weiter unten, und dieselbe
      // Antwort: lesen, was da ist, statt die Datei abzulehnen. Eine
      // Sicherung ist ein Altbestand; sie kann nicht nachträglich mitwandern.
      const scenarioTable = tables.has("Scenario")
        ? "Scenario"
        : tables.has("Group")
          ? "Group"
          : null;
      if (!scenarioTable) {
        throw new Error(
          'Der Datei fehlt die Tabelle "Scenario" (früher "Group"). Stammt sie aus dieser App?',
        );
      }
      scenarios = await source.$queryRawUnsafe(
        `SELECT * FROM "${scenarioTable}"`,
      );

      // Sicherungen von vor der Mehrbild-Umstellung haben keine
      // `CharacterImage`-Tabelle: dort steckt das Portrait noch in
      // `Character.imageData`. Daraus wird hier je ein Primärbild gebaut,
      // damit ältere Sicherungen ihre Bilder behalten.
      images = tables.has("CharacterImage")
        ? await source.$queryRawUnsafe("SELECT * FROM CharacterImage")
        : characters
            .filter((c) => c.imageData)
            .map((c) => ({
              id: randomUUID(),
              createdAt: c.createdAt,
              characterId: c.id,
              imageData: c.imageData,
              thumbnail: c.thumbnail ?? null,
              isPrimary: true,
            }));

      // Weltbilder analog: Neue Sicherungen tragen die Tabelle `ScenarioImage`;
      // ältere (vor der Mehrbild-Umstellung) hatten das eine Weltbild noch als
      // Spalten `Scenario.imageData`/`thumbnail` – daraus wird je ein
      // Primärbild gebaut, damit auch ältere Sicherungen ihre Weltbilder behalten.
      scenarioImages = tables.has("ScenarioImage")
        ? await source.$queryRawUnsafe("SELECT * FROM ScenarioImage")
        : scenarios
            .filter((s) => s.imageData)
            .map((s) => ({
              id: randomUUID(),
              createdAt: s.createdAt,
              scenarioId: s.id,
              imageData: s.imageData,
              thumbnail: s.thumbnail ?? null,
              isPrimary: true,
            }));
    } finally {
      await source.$disconnect();
    }

    // Sicherheitskopie des aktuellen Standes, bevor irgendetwas gelöscht wird.
    const current = await exportDatabase();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safetyCopy = path.join(
      path.dirname(databasePath()),
      `dev.db.vor-import-${stamp}.bak`,
    );
    await writeFile(safetyCopy, current);

    // Alles-oder-nichts: bricht etwas ab, bleibt der alte Stand erhalten.
    await prisma.$transaction([
      prisma.character.deleteMany(),
      prisma.scenario.deleteMany(),
      prisma.setting.deleteMany(),
      // Szenarien zuerst – Charaktere verweisen per scenarioId darauf.
      ...scenarios.map((g) =>
        prisma.scenario.create({
          data: {
            id: g.id as string,
            createdAt: new Date(g.createdAt as string | number),
            name: g.name as string,
          },
        }),
      ),
      ...characters.map((c) =>
        prisma.character.create({
          data: {
            id: c.id as string,
            createdAt: new Date(c.createdAt as string | number),
            updatedAt: new Date(c.updatedAt as string | number),
            name: (c.name as string | null) ?? null,
            // Alte Sicherungen tragen die Zuordnung noch als `groupId`.
            scenarioId:
              ((c.scenarioId ?? c.groupId) as string | null) ?? null,
            input: c.input as string,
            shortDescription: (c.shortDescription as string | null) ?? null,
            description: c.description as string,
            traits: c.traits as string,
            // Sicherungen von vor den Ansatzpunkten haben die Spalte nicht.
            storyHooks: (c.storyHooks as string | null) ?? null,
          },
        }),
      ),
      // Bilder nach den Charakteren – sie verweisen per characterId darauf.
      ...images.map((i) =>
        prisma.characterImage.create({
          data: {
            id: i.id as string,
            createdAt: new Date(i.createdAt as string | number),
            characterId: i.characterId as string,
            imageData: i.imageData as string,
            thumbnail: (i.thumbnail as string | null) ?? null,
            isPrimary: Boolean(i.isPrimary),
          },
        }),
      ),
      // Weltbilder nach den Szenarien – sie verweisen per scenarioId darauf.
      ...scenarioImages.map((i) =>
        prisma.scenarioImage.create({
          data: {
            id: i.id as string,
            createdAt: new Date(i.createdAt as string | number),
            scenarioId: i.scenarioId as string,
            imageData: i.imageData as string,
            thumbnail: (i.thumbnail as string | null) ?? null,
            isPrimary: Boolean(i.isPrimary),
          },
        }),
      ),
      ...settings.map((s) =>
        prisma.setting.create({
          data: {
            key: s.key as string,
            value: s.value as string,
            updatedAt: new Date(s.updatedAt as string | number),
          },
        }),
      ),
    ]);

    return {
      characters: characters.length,
      // Alle Bilder zusammen – Charakter- und Weltbilder.
      images: images.length + scenarioImages.length,
      scenarios: scenarios.length,
      settings: settings.length,
      safetyCopy: path.basename(safetyCopy),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
