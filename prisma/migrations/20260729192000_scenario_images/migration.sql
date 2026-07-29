-- Mehrere Bilder pro Szenario.
--
-- Analog zu `CharacterImage`: Die bisherigen Spalten `Scenario.imageData` /
-- `Scenario.thumbnail` werden durch die Tabelle `ScenarioImage` ersetzt. Das
-- vorhandene Weltbild jedes Szenarios wandert als erstes und primäres Bild
-- hinüber, **bevor** die Spalten fallen – sonst wären alle bestehenden
-- Weltbilder verloren.

-- CreateTable
CREATE TABLE "ScenarioImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scenarioId" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "thumbnail" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ScenarioImage_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ScenarioImage_scenarioId_idx" ON "ScenarioImage"("scenarioId");

-- Bestandsdaten übernehmen: je Szenario mit Weltbild genau eine Zeile, primär.
-- Die id ahmt eine cuid nach (Präfix + Zufall); sie muss nur eindeutig sein.
INSERT INTO "ScenarioImage" ("id", "createdAt", "scenarioId", "imageData", "thumbnail", "isPrimary")
SELECT
    'mig' || lower(hex(randomblob(11))),
    "createdAt",
    "id",
    "imageData",
    "thumbnail",
    true
FROM "Scenario"
WHERE "imageData" IS NOT NULL;

-- AlterTable
ALTER TABLE "Scenario" DROP COLUMN "imageData";
ALTER TABLE "Scenario" DROP COLUMN "thumbnail";
