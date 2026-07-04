-- Optional "Noted by" endorser name on booking requests, shown on the printed form.
ALTER TABLE "BookingRequest" ADD COLUMN IF NOT EXISTS "notedBy" TEXT;
