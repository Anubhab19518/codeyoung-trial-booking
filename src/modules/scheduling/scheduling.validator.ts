import { z } from "zod";

export const GetSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date parameter must be in YYYY-MM-DD format"),
  timezone: z.string().min(1, "timezone parameter is required"),
  durationMinutes: z.coerce.number().int().min(15).max(120).optional().default(45),
});

export type GetSlotsQueryParams = z.infer<typeof GetSlotsQuerySchema>;
