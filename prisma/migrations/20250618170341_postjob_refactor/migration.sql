/*
  Warnings:

  - You are about to drop the `ScheduledPost` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ScheduledPost";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "PostJob" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "galleryUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nickname" TEXT,
    "headtext" TEXT,
    "headless" BOOLEAN,
    "imagePaths" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "resultMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
