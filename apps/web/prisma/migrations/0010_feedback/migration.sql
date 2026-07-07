-- User feedback inbox.
CREATE TABLE IF NOT EXISTS "Feedback" (
  "id"        TEXT NOT NULL,
  "message"   TEXT NOT NULL,
  "rating"    INTEGER,
  "category"  TEXT,
  "userId"    TEXT,
  "userEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Feedback_createdAt_idx" ON "Feedback" ("createdAt");
