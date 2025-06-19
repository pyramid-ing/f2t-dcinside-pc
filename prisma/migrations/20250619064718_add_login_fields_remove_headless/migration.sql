/*
  Warnings:

  - You are about to drop the column `headless` on the `PostJob` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PostJob" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "galleryUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nickname" TEXT,
    "headtext" TEXT,
    "imagePaths" TEXT,
    "loginId" TEXT,
    "loginPassword" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "resultMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PostJob" ("contentHtml", "createdAt", "galleryUrl", "headtext", "id", "imagePaths", "nickname", "password", "resultMsg", "scheduledAt", "status", "title", "updatedAt") SELECT "contentHtml", "createdAt", "galleryUrl", "headtext", "id", "imagePaths", "nickname", "password", "resultMsg", "scheduledAt", "status", "title", "updatedAt" FROM "PostJob";
DROP TABLE "PostJob";
ALTER TABLE "new_PostJob" RENAME TO "PostJob";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
