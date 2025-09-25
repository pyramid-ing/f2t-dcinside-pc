-- Make migration resilient for environments where columns/index may not exist
-- DropIndex (safe)
DROP INDEX IF EXISTS "CommentJob_jobId_key";

-- Columns may already be absent; skip dropping to avoid errors on shadow DB
-- ALTER TABLE "CommentJob" DROP COLUMN "captchaEnabled";
-- ALTER TABLE "CommentJob" DROP COLUMN "ipChangeEnabled";

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "CommentJob_jobId_key" ON "CommentJob"("jobId");
