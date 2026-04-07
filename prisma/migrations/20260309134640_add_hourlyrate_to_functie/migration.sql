-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_functies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#f97316',
    "hourlyRate" REAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_functies" ("active", "color", "createdAt", "id", "name") SELECT "active", "color", "createdAt", "id", "name" FROM "functies";
DROP TABLE "functies";
ALTER TABLE "new_functies" RENAME TO "functies";
CREATE UNIQUE INDEX "functies_name_key" ON "functies"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
