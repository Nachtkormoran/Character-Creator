-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT,
    "scenarioId" TEXT,
    "isProtagonist" BOOLEAN NOT NULL DEFAULT false,
    "input" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT NOT NULL,
    "traits" TEXT NOT NULL,
    "storyHooks" TEXT,
    CONSTRAINT "Character_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Character" ("createdAt", "description", "id", "input", "name", "scenarioId", "shortDescription", "storyHooks", "traits", "updatedAt") SELECT "createdAt", "description", "id", "input", "name", "scenarioId", "shortDescription", "storyHooks", "traits", "updatedAt" FROM "Character";
DROP TABLE "Character";
ALTER TABLE "new_Character" RENAME TO "Character";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
