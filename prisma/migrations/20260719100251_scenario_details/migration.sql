-- Szenario bekommt `details` (JSON-String) und `updatedAt`.
--
-- Von Hand angepasst: Prisma lässt `updatedAt` aus dem INSERT weg, weil die
-- Spalte NOT NULL ist und keinen Default hat – auf einer nicht leeren Tabelle
-- scheitert das. Bestehende Szenarien bekommen deshalb `createdAt` als
-- `updatedAt`: sie wurden seit dem Anlegen nicht geändert, das ist der
-- richtige Wert und keine Notlüge.
--
-- `details` bleibt NULL. Ein Szenario ohne Festlegungen ist gültig;
-- `normalizeScenarioDetails` füllt beim Lesen auf.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Scenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "details" TEXT
);

INSERT INTO "new_Scenario" ("id", "createdAt", "updatedAt", "name", "details")
SELECT "id", "createdAt", "createdAt", "name", NULL FROM "Scenario";

DROP TABLE "Scenario";
ALTER TABLE "new_Scenario" RENAME TO "Scenario";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
