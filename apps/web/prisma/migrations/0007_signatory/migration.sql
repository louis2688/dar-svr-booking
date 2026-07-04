-- Office signatories (name, position, uploadable signature image) for the printed form.
CREATE TABLE IF NOT EXISTS "Signatory" (
  "role"      TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "position"  TEXT NOT NULL,
  "signature" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Signatory_pkey" PRIMARY KEY ("role")
);

-- Seed the two fixed signatories (idempotent).
INSERT INTO "Signatory" ("role", "name", "position", "updatedAt")
VALUES
  ('APPROVER', 'JOHN PAOLO M. LLANES', 'Administrative Officer IV', NOW()),
  ('NOTED_BY', 'ROSAVILLA M. DAVALOS, JD', 'Chief Administrative Officer', NOW())
ON CONFLICT ("role") DO NOTHING;
