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

/** Tabellen, die eine gültige Sicherung enthalten muss. */
const REQUIRED_TABLES = ["Character", "Group", "Setting"] as const;

/** SQLite-Dateien beginnen mit dieser Signatur. */
const SQLITE_MAGIC = Buffer.from("SQLite format 3\0", "utf8");

/** Pfad der aktiven Datenbank aus DATABASE_URL (z. B. "file:./dev.db"). */
export function databasePath(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const relative = url.replace(/^file:/, "");
  return path.resolve(process.cwd(), relative);
}

/**
 * Erzeugt einen **konsistenten** Snapshot der Datenbank.
 *
 * Bewusst `VACUUM INTO` statt die Datei zu kopieren: ein simples Kopieren
 * während laufender Schreibzugriffe kann eine unvollständige Datei liefern.
 */
export async function exportDatabase(): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "cc-backup-"));
  const target = path.join(dir, `backup-${randomUUID()}.db`);
  try {
    // Kein Prisma-Modell im Spiel – daher als Raw-Statement. Der Pfad kommt
    // aus randomUUID/tmpdir, nicht aus Nutzereingaben.
    await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    return await readFile(target);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export interface ImportResult {
  characters: number;
  images: number;
  groups: number;
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
    let groups: Array<Record<string, unknown>>;
    let settings: Array<Record<string, unknown>>;
    let images: Array<Record<string, unknown>>;
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
      groups = await source.$queryRawUnsafe('SELECT * FROM "Group"');
      settings = await source.$queryRawUnsafe("SELECT * FROM Setting");

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
      prisma.group.deleteMany(),
      prisma.setting.deleteMany(),
      // Gruppen zuerst – Charaktere verweisen per groupId darauf.
      ...groups.map((g) =>
        prisma.group.create({
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
            groupId: (c.groupId as string | null) ?? null,
            input: c.input as string,
            shortDescription: (c.shortDescription as string | null) ?? null,
            description: c.description as string,
            traits: c.traits as string,
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
      images: images.length,
      groups: groups.length,
      settings: settings.length,
      safetyCopy: path.basename(safetyCopy),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
