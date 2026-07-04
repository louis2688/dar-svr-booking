-- Admin assigns the vehicle: user-created requests start unassigned (NULL) until approval.
ALTER TABLE "BookingRequest" ALTER COLUMN "vehicleId" DROP NOT NULL;

-- Backstop against double-booking an approved slot. IF NOT EXISTS keeps this idempotent
-- for databases that already got the index from migration 0001/0003, and creates it on
-- databases provisioned via `prisma db push` (which cannot express partial indexes).
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_approved_vehicle_date_startTime"
ON "BookingRequest" ("vehicleId", "date", "startTime")
WHERE "status" = 'APPROVED';
