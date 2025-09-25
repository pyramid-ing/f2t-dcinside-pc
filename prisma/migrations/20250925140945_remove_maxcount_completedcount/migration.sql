-- DropIndex
DROP INDEX "CommentJob_jobId_key";

-- AlterTable
ALTER TABLE "CommentJob" DROP COLUMN "completedCount";
ALTER TABLE "CommentJob" DROP COLUMN "maxCount";

-- CreateIndex
CREATE UNIQUE INDEX "CommentJob_jobId_key" ON "CommentJob"("jobId");
