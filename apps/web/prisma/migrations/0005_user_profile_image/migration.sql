-- Avatar image (data URL) for profile settings. Nullable; existing users keep initials.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "image" TEXT;
