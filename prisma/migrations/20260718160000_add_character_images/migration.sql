-- Mehrere Bilder pro Charakter.
--
-- Die bisherigen Spalten `Character.imageData` / `Character.thumbnail` werden
-- durch die Tabelle `CharacterImage` ersetzt. Das vorhandene Portrait jedes
-- Charakters wandert als erstes und primäres Bild hinüber, **bevor** die
-- Spalten fallen – sonst wären alle bestehenden Bilder verloren.

-- CreateTable
CREATE TABLE "CharacterImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "characterId" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "thumbnail" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CharacterImage_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CharacterImage_characterId_idx" ON "CharacterImage"("characterId");

-- Bestandsdaten übernehmen: je Charakter mit Bild genau eine Zeile, primär.
-- Die id ahmt eine cuid nach (Präfix + Zufall); sie muss nur eindeutig sein.
INSERT INTO "CharacterImage" ("id", "createdAt", "characterId", "imageData", "thumbnail", "isPrimary")
SELECT
    'mig' || lower(hex(randomblob(11))),
    "createdAt",
    "id",
    "imageData",
    "thumbnail",
    true
FROM "Character"
WHERE "imageData" IS NOT NULL;

-- AlterTable
ALTER TABLE "Character" DROP COLUMN "imageData";
ALTER TABLE "Character" DROP COLUMN "thumbnail";
