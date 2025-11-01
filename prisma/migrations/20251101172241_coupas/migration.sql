-- CreateTable
CREATE TABLE "CoupasJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postUrl" TEXT NOT NULL,
    "wordpressUrl" TEXT NOT NULL,
    "wordpressUsername" TEXT NOT NULL,
    "wordpressApiKey" TEXT NOT NULL,
    "nickname" TEXT,
    "password" TEXT,
    "loginId" TEXT,
    "loginPassword" TEXT,
    "resultBlogLink" TEXT,
    "resultComment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    CONSTRAINT "CoupasJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonitoredGallery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'gallery',
    "actionType" TEXT,
    "galleryUrl" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "galleryName" TEXT,
    "commentText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "searchKeyword" TEXT,
    "searchSort" TEXT DEFAULT 'latest',
    "aiPromptCode" TEXT,
    "loginId" TEXT,
    "loginPassword" TEXT,
    "nickname" TEXT,
    "password" TEXT,
    "lastCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BlacklistedGallery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "galleryUrl" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "galleryName" TEXT,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MonitoredPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postUrl" TEXT NOT NULL,
    "postTitle" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "headtext" TEXT,
    "authorName" TEXT,
    "answered" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" DATETIME,
    "approvedStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "aiReason" TEXT,
    "galleryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonitoredPost_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "MonitoredGallery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CommentJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyword" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "postUrl" TEXT NOT NULL,
    "postTitle" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL DEFAULT 'unknown',
    "nickname" TEXT,
    "password" TEXT,
    "loginId" TEXT,
    "loginPassword" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    CONSTRAINT "CommentJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CommentJob" ("comment", "createdAt", "id", "jobId", "keyword", "loginId", "loginPassword", "nickname", "password", "postTitle", "postUrl", "updatedAt") SELECT "comment", "createdAt", "id", "jobId", "keyword", "loginId", "loginPassword", "nickname", "password", "postTitle", "postUrl", "updatedAt" FROM "CommentJob";
DROP TABLE "CommentJob";
ALTER TABLE "new_CommentJob" RENAME TO "CommentJob";
CREATE UNIQUE INDEX "CommentJob_jobId_key" ON "CommentJob"("jobId");
CREATE INDEX "CommentJob_galleryId_idx" ON "CommentJob"("galleryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CoupasJob_jobId_key" ON "CoupasJob"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoredGallery_galleryUrl_key" ON "MonitoredGallery"("galleryUrl");

-- CreateIndex
CREATE INDEX "MonitoredGallery_isActive_idx" ON "MonitoredGallery"("isActive");

-- CreateIndex
CREATE INDEX "MonitoredGallery_type_idx" ON "MonitoredGallery"("type");

-- CreateIndex
CREATE INDEX "MonitoredGallery_actionType_idx" ON "MonitoredGallery"("actionType");

-- CreateIndex
CREATE UNIQUE INDEX "BlacklistedGallery_galleryUrl_key" ON "BlacklistedGallery"("galleryUrl");

-- CreateIndex
CREATE INDEX "BlacklistedGallery_galleryId_idx" ON "BlacklistedGallery"("galleryId");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoredPost_postUrl_key" ON "MonitoredPost"("postUrl");

-- CreateIndex
CREATE INDEX "MonitoredPost_galleryId_answered_idx" ON "MonitoredPost"("galleryId", "answered");

-- CreateIndex
CREATE INDEX "MonitoredPost_answered_idx" ON "MonitoredPost"("answered");

-- CreateIndex
CREATE INDEX "MonitoredPost_approvedStatus_idx" ON "MonitoredPost"("approvedStatus");
