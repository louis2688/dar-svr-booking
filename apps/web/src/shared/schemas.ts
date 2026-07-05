import { z } from "zod";

import { BookingTimeSchema } from "./booking-times";

export const BookingStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const CreateRequestSchema = z
  .object({
    /** Admins may pre-assign a vehicle; user requests omit it (admin assigns at approval). */
    // optional (omitted): keep existing on edit / no vehicle on create.
    // explicit null (edit only): admin clears an assigned vehicle.
    vehicleId: z.string().min(1).optional().nullable(),
    /** Admin-only (backfilling past bookings): use the control number from the
        printed paper form instead of auto-generating one. */
    controlNo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{4}$/, "Expected YYYY-MM-0000")
      .optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
    startTime: BookingTimeSchema,
    destination: z.string().min(1).max(200),
    purpose: z.string().min(1).max(500),
    timeText: z.string().max(100).optional(),
    requestorName: z.string().min(1).max(120),
    notedBy: z.string().max(120).optional(),
    passengers: z.array(z.string().min(1).max(120)).default([])
  });
// Lead-time / no-past-dates rule is enforced in the create route for
// non-admins only — admins may backfill past bookings.

export type CreateRequestInput = z.infer<typeof CreateRequestSchema>;

export const AvailabilityQuerySchema = z.object({
  vehicleId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM")
});

export type AvailabilityQuery = z.infer<typeof AvailabilityQuerySchema>;

