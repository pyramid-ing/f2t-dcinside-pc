/*
  Warnings:

  - You are about to drop the column `postUrls` on the `CommentJob` table. All the data in the column will be lost.
  - You are about to drop the column `taskDelay` on the `CommentJob` table. All the data in the column will be lost.
  - Added the required column `postUrl` to the `CommentJob` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CommentJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyword" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "postUrl" TEXT NOT NULL,
    "nickname" TEXT,
    "password" TEXT,
    "galleryUrl" TEXT,
    "loginId" TEXT,
    "loginPassword" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    CONSTRAINT "CommentJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CommentJob" ("comment", "createdAt", "galleryUrl", "id", "jobId", "keyword", "loginId", "loginPassword", "nickname", "password", "updatedAt") SELECT "comment", "createdAt", "galleryUrl", "id", "jobId", "keyword", "loginId", "loginPassword", "nickname", "password", "updatedAt" FROM "CommentJob";
DROP TABLE "CommentJob";
ALTER TABLE "new_CommentJob" RENAME TO "CommentJob";
CREATE UNIQUE INDEX "CommentJob_jobId_key" ON "CommentJob"("jobId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
