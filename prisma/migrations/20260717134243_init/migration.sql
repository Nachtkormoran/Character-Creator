-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT,
    "input" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "traits" TEXT NOT NULL,
    "imageData" TEXT
);
