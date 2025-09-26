/*
  Warnings:

  - You are about to drop the column `galleryUrl` on the `CommentJob` table. All the data in the column will be lost.
  - Added the required column `postTitle` to the `CommentJob` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CommentJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyword" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "postUrl" TEXT NOT NULL,
    "postTitle" TEXT NOT NULL,
    "nickname" TEXT,
    "password" TEXT,
    "loginId" TEXT,
    "loginPassword" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    CONSTRAINT "CommentJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CommentJob" ("comment", "createdAt", "id", "jobId", "keyword", "loginId", "loginPassword", "nickname", "password", "postUrl", "postTitle", "updatedAt") SELECT "comment", "createdAt", "id", "jobId", "keyword", "loginId", "loginPassword", "nickname", "password", "postUrl", "알 수 없는 제목", "updatedAt" FROM "CommentJob";
DROP TABLE "CommentJob";
ALTER TABLE "new_CommentJob" RENAME TO "CommentJob";
CREATE UNIQUE INDEX "CommentJob_jobId_key" ON "CommentJob"("jobId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
