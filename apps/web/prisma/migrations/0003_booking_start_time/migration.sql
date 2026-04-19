-- Drop unique index on (vehicleId, date, slot) for approved rows; column will be removed.
DROP INDEX IF EXISTS "uniq_approved_vehicle_date_slot";

-- Add new time field; backfill from old AM/PM slot.
ALTER TABLE "BookingRequest" ADD COLUMN "startTime" TEXT NOT NULL DEFAULT '08:00';

UPDATE "BookingRequest" SET "startTime" = CASE
  WHEN "slot"::text = 'AM' THEN '08:00'
  WHEN "slot"::text = 'PM' THEN '13:00'
  ELSE '08:00'
END;

ALTER TABLE "BookingRequest" DROP COLUMN "slot";

DROP TYPE "Slot";

CREATE UNIQUE INDEX "uniq_approved_vehicle_date_startTime"
ON "BookingRequest" ("vehicleId", "date", "startTime")
WHERE "status" = 'APPROVED';
