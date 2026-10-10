import { NextResponse } from "next/server";
import { mentorsModule } from "@/modules/mentors";
import { handleApiError } from "@/shared/errors/error-handler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const mentors = await mentorsModule.getActiveMentors();
    return NextResponse.json({
      success: true,
      data: mentors,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
