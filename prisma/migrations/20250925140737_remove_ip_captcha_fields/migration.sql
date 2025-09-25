-- DropIndex
DROP INDEX "CommentJob_jobId_key";

-- AlterTable
ALTER TABLE "CommentJob" DROP COLUMN "captchaEnabled";
ALTER TABLE "CommentJob" DROP COLUMN "ipChangeEnabled";

-- CreateIndex
CREATE UNIQUE INDEX "CommentJob_jobId_key" ON "CommentJob"("jobId");
