/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `JobLog` table. All the data in the column will be lost.
  - You are about to drop the column `resultMsg` on the `PostJob` table. All the data in the column will be lost.
  - You are about to drop the column `resultUrl` on the `PostJob` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledAt` on the `PostJob` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `PostJob` table. All the data in the column will be lost.
  - Added the required column `jobId` to the `PostJob` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "desc" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "resultMsg" TEXT,
    "resultUrl" TEXT,
    "errorMsg" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JobLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobId" TEXT NOT NULL,
    CONSTRAINT "JobLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_JobLog" ("createdAt", "id", "jobId", "message") SELECT "createdAt", "id", "jobId", "message" FROM "JobLog";
DROP TABLE "JobLog";
ALTER TABLE "new_JobLog" RENAME TO "JobLog";
CREATE INDEX "JobLog_jobId_idx" ON "JobLog"("jobId");
CREATE TABLE "new_PostJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "galleryUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "password" TEXT,
    "nickname" TEXT,
    "headtext" TEXT,
    "imagePaths" TEXT,
    "loginId" TEXT,
    "loginPassword" TEXT,
    "imagePosition" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    CONSTRAINT "PostJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PostJob" ("contentHtml", "createdAt", "galleryUrl", "headtext", "id", "imagePaths", "imagePosition", "loginId", "loginPassword", "nickname", "password", "title", "updatedAt") SELECT "contentHtml", "createdAt", "galleryUrl", "headtext", "id", "imagePaths", "imagePosition", "loginId", "loginPassword", "nickname", "password", "title", "updatedAt" FROM "PostJob";
DROP TABLE "PostJob";
ALTER TABLE "new_PostJob" RENAME TO "PostJob";
CREATE UNIQUE INDEX "PostJob_jobId_key" ON "PostJob"("jobId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
