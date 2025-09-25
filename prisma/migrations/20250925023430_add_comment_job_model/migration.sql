-- CreateTable
CREATE TABLE "CommentJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyword" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "maxCount" INTEGER NOT NULL,
    "postUrls" TEXT NOT NULL,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "ipChangeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "captchaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "taskDelay" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    CONSTRAINT "CommentJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CommentJob_jobId_key" ON "CommentJob"("jobId");
