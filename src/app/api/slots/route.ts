import { NextRequest, NextResponse } from "next/server";
import { schedulingModule, GetSlotsQuerySchema } from "@/modules/scheduling";
import { handleApiError } from "@/shared/errors/error-handler";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const timezone = searchParams.get("timezone");
    const durationMinutes = searchParams.get("durationMinutes");

    const validatedQuery = GetSlotsQuerySchema.parse({
      date,
      timezone,
      durationMinutes: durationMinutes ? Number(durationMinutes) : 45,
    });

    const slots = await schedulingModule.getAvailableSlots(validatedQuery);

    return NextResponse.json({
      success: true,
      data: {
        date: validatedQuery.date,
        timezone: validatedQuery.timezone,
        slotCount: slots.length,
        slots,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
