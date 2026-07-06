-- Allow multiple bookings for the same vehicle + date + start time.
-- The partial unique index previously enforced one APPROVED booking per slot;
-- drop it so a vehicle can hold multiple bookings at the same time.
DROP INDEX IF EXISTS "uniq_approved_vehicle_date_startTime";
