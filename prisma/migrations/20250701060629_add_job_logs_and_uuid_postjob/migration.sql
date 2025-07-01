/*
  Warnings:

  - The primary key for the `PostJob` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- CreateTable
CREATE TABLE "JobLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JobLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "PostJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "scheduledAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "resultMsg" TEXT,
    "resultUrl" TEXT,
    "imagePosition" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PostJob" ("contentHtml", "createdAt", "galleryUrl", "headtext", "id", "imagePaths", "imagePosition", "loginId", "loginPassword", "nickname", "password", "resultMsg", "resultUrl", "scheduledAt", "status", "title", "updatedAt") SELECT "contentHtml", "createdAt", "galleryUrl", "headtext", "id", "imagePaths", "imagePosition", "loginId", "loginPassword", "nickname", "password", "resultMsg", "resultUrl", "scheduledAt", "status", "title", "updatedAt" FROM "PostJob";
DROP TABLE "PostJob";
ALTER TABLE "new_PostJob" RENAME TO "PostJob";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "JobLog_jobId_idx" ON "JobLog"("jobId");
