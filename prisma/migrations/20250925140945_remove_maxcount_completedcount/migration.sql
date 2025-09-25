-- Make migration resilient
DROP INDEX IF EXISTS "CommentJob_jobId_key";

-- Columns may not exist on fresh DBs; skip DROP to avoid failures
-- ALTER TABLE "CommentJob" DROP COLUMN "completedCount";
-- ALTER TABLE "CommentJob" DROP COLUMN "maxCount";

CREATE UNIQUE INDEX IF NOT EXISTS "CommentJob_jobId_key" ON "CommentJob"("jobId");
