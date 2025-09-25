-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CommentJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyword" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "maxCount" INTEGER NOT NULL,
    "postUrls" TEXT NOT NULL,
    "nickname" TEXT NOT NULL DEFAULT '부갤러',
    "password" TEXT NOT NULL DEFAULT '1234',
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "ipChangeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "captchaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "taskDelay" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    CONSTRAINT "CommentJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CommentJob" ("captchaEnabled", "comment", "completedCount", "createdAt", "id", "ipChangeEnabled", "jobId", "keyword", "maxCount", "postUrls", "taskDelay", "updatedAt") SELECT "captchaEnabled", "comment", "completedCount", "createdAt", "id", "ipChangeEnabled", "jobId", "keyword", "maxCount", "postUrls", "taskDelay", "updatedAt" FROM "CommentJob";
DROP TABLE "CommentJob";
ALTER TABLE "new_CommentJob" RENAME TO "CommentJob";
CREATE UNIQUE INDEX "CommentJob_jobId_key" ON "CommentJob"("jobId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
