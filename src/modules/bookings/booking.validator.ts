import { z } from "zod";

export const CreateBookingSchema = z.object({
  parentName: z.string().min(2, "Parent name must be at least 2 characters").max(100),
  parentEmail: z.string().email("Please provide a valid email address"),
  parentTimezone: z.string().min(1, "Parent timezone is required"),
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "slotDate must be in YYYY-MM-DD format"),
  slotStartTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "slotStartTime must be in HH:mm 24-hour format"),
  slotDurationMinutes: z.number().int().min(15).max(120).optional().default(45),
});

export type CreateBookingPayload = z.infer<typeof CreateBookingSchema>;
