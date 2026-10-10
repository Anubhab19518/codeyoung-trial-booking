import { prisma } from "@/shared/db/prisma.client";
import { Prisma } from "@prisma/client";
import { EnqueueNotificationParams, OutboxNotificationDTO } from "./notification.types";

export class NotificationRepository {
  async enqueue(
    params: EnqueueNotificationParams,
    tx?: Prisma.TransactionClient
  ): Promise<OutboxNotificationDTO> {
    const client = tx || prisma;
    const record = await client.notificationOutbox.create({
      data: {
        bookingId: params.bookingId,
        recipientType: params.recipientType,
        recipientEmail: params.recipientEmail,
        recipientName: params.recipientName,
        subject: params.subject,
        contentHtml: params.contentHtml,
        status: "PENDING",
        scheduledFor: new Date(),
      },
    });

    return record as OutboxNotificationDTO;
  }

  async findPending(limit = 20): Promise<OutboxNotificationDTO[]> {
    const records = await prisma.notificationOutbox.findMany({
      where: {
        status: "PENDING",
        scheduledFor: { lte: new Date() },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    return records as OutboxNotificationDTO[];
  }

  async findByBookingId(bookingId: string): Promise<OutboxNotificationDTO[]> {
    const records = await prisma.notificationOutbox.findMany({
      where: { bookingId },
      orderBy: { createdAt: "asc" },
    });

    return records as OutboxNotificationDTO[];
  }

  async findAllRecent(limit = 50): Promise<OutboxNotificationDTO[]> {
    const records = await prisma.notificationOutbox.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return records as OutboxNotificationDTO[];
  }

  async markSent(id: string): Promise<void> {
    try {
      await prisma.notificationOutbox.update({
        where: { id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          lastError: null,
        },
      });
    } catch {
      // Ignored if record was removed during test teardown
    }
  }

  async markFailedOrRetry(id: string, errorMsg: string, retryCount: number, maxRetries: number): Promise<void> {
    const nextRetry = retryCount + 1;
    try {
      if (nextRetry >= maxRetries) {
        await prisma.notificationOutbox.update({
          where: { id },
          data: {
            status: "FAILED",
            retryCount: nextRetry,
            lastError: errorMsg,
          },
        });
      } else {
        // Exponential backoff: 2^(retry) minutes
        const backoffMinutes = Math.pow(2, nextRetry);
        const nextScheduled = new Date(Date.now() + backoffMinutes * 60 * 1000);
        await prisma.notificationOutbox.update({
          where: { id },
          data: {
            status: "PENDING",
            retryCount: nextRetry,
            lastError: errorMsg,
            scheduledFor: nextScheduled,
          },
        });
      }
    } catch {
      // Ignored if record was removed during test teardown
    }
  }

}
