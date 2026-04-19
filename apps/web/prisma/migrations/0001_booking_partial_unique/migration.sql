-- Prevent double-booking for the same vehicle/date/slot for APPROVED requests only.
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_approved_vehicle_date_slot"
ON "BookingRequest" ("vehicleId", "date", "slot")
WHERE "status" = 'APPROVED';

