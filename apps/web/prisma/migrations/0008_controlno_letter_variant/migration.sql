-- Allow lettered control-number variants (e.g. 2026-07-0229 and 2026-07-0229A),
-- which share the numeric monthlySeq. controlNo's UNIQUE index still enforces
-- overall uniqueness; drop the composite unique and keep it as a plain index.
DROP INDEX IF EXISTS "BookingRequest_controlDate_monthlySeq_key";
CREATE INDEX IF NOT EXISTS "BookingRequest_controlDate_monthlySeq_idx"
  ON "BookingRequest" ("controlDate", "monthlySeq");
