/*
  Warnings:

  - You are about to drop the column `resultUrl` on the `Job` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PostJob" ADD COLUMN "resultUrl" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "desc" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "resultMsg" TEXT,
    "errorMsg" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Job" ("completedAt", "createdAt", "desc", "errorMsg", "id", "priority", "resultMsg", "scheduledAt", "startedAt", "status", "subject", "type", "updatedAt") SELECT "completedAt", "createdAt", "desc", "errorMsg", "id", "priority", "resultMsg", "scheduledAt", "startedAt", "status", "subject", "type", "updatedAt" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
