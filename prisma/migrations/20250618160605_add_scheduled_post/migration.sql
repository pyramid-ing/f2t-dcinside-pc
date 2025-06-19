-- CreateTable
CREATE TABLE "ScheduledPost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "galleryUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nickname" TEXT,
    "headless" BOOLEAN,
    "imagePaths" TEXT,
    "publishAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "resultMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
