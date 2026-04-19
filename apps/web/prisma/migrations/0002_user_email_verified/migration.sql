-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerified" TIMESTAMP(3);

-- Backfill: treat existing accounts as already verified (pre-signup-verification users)
UPDATE "User" SET "emailVerified" = "createdAt" WHERE "emailVerified" IS NULL;
