import { NextRequest, NextResponse } from "next/server";
import { bookingsModule, CreateBookingSchema } from "@/modules/bookings";
import { handleApiError } from "@/shared/errors/error-handler";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedInput = CreateBookingSchema.parse(body);

    const bookingResult = await bookingsModule.createTrialBooking(validatedInput);

    return NextResponse.json(
      {
        success: true,
        message: "Trial class successfully confirmed and mentor assigned.",
        data: bookingResult,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    const recentBookings = await bookingsModule.getRecentBookings(50);
    return NextResponse.json({
      success: true,
      data: recentBookings,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
