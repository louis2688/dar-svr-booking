import { z } from "zod";

import { BOOKING_TOO_SOON_MESSAGE, isBookingLeadTimeSatisfied } from "./booking-lead";
import { BookingTimeSchema } from "./booking-times";

export const BookingStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const CreateRequestSchema = z
  .object({
    vehicleId: z.string().min(1),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
    startTime: BookingTimeSchema,
    destination: z.string().min(1).max(200),
    purpose: z.string().min(1).max(500),
    timeText: z.string().max(100).optional(),
    requestorName: z.string().min(1).max(120),
    passengers: z.array(z.string().min(1).max(120)).default([])
  })
  .superRefine((data, ctx) => {
    if (!isBookingLeadTimeSatisfied(data.date, data.startTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: BOOKING_TOO_SOON_MESSAGE,
        path: ["startTime"]
      });
    }
  });

export type CreateRequestInput = z.infer<typeof CreateRequestSchema>;

export const AvailabilityQuerySchema = z.object({
  vehicleId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM")
});

export type AvailabilityQuery = z.infer<typeof AvailabilityQuerySchema>;

