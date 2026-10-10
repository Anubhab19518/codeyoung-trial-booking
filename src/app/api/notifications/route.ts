import { NextResponse } from "next/server";
import { notificationsModule } from "@/modules/notifications";
import { handleApiError } from "@/shared/errors/error-handler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const notifications = await notificationsModule.getRecentNotifications(50);
    return NextResponse.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST() {
  try {
    const result = await notificationsModule.processPendingOutboxMessages();
    return NextResponse.json({
      success: true,
      message: "Outbox worker processed pending notifications.",
      data: result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
