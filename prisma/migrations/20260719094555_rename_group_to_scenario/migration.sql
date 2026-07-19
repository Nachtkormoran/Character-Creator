-- Group -> Scenario.
--
-- Diese Migration ist von Hand geschrieben. Prisma erzeugt für eine
-- Modell-Umbenennung ein DROP TABLE "Group" plus CREATE TABLE "Scenario" und
-- lässt beim Umbau von Character die Spalte groupId aus dem INSERT weg – aus
-- Prismas Sicht verschwindet ein Modell und ein anderes entsteht. Angewendet
-- hätte das sämtliche Szenarien und jede Zuordnung gelöscht.
--
-- Stattdessen: umbenennen und die Zuordnung mitnehmen.

PRAGMA foreign_keys=OFF;
PRAGMA defer_foreign_keys=ON;

-- Die Tabelle selbst behält ihre Zeilen.
ALTER TABLE "Group" RENAME TO "Scenario";

-- Character: groupId -> scenarioId. SQLite kann einen Fremdschlüssel nicht an
-- Ort und Stelle ändern, deshalb doch der Umbau über eine neue Tabelle – hier
-- aber MIT Übernahme der bestehenden Zuordnung (groupId -> scenarioId).
CREATE TABLE "new_Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT,
    "scenarioId" TEXT,
    "input" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT NOT NULL,
    "traits" TEXT NOT NULL,
    "storyHooks" TEXT,
    CONSTRAINT "Character_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Character" ("id", "createdAt", "updatedAt", "name", "scenarioId", "input", "shortDescription", "description", "traits", "storyHooks")
SELECT "id", "createdAt", "updatedAt", "name", "groupId", "input", "shortDescription", "description", "traits", "storyHooks" FROM "Character";

DROP TABLE "Character";
ALTER TABLE "new_Character" RENAME TO "Character";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
