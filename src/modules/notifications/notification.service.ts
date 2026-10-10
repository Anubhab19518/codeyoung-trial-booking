import { DateTime } from "luxon";
import { Prisma } from "@prisma/client";
import { NotificationRepository } from "./notification.repository";
import { IEmailProviderAdapter, MockEmailProviderAdapter } from "./email-provider.adapter";
import { OutboxNotificationDTO } from "./notification.types";

export interface BookingNotificationContext {
  bookingId: string;
  parentName: string;
  parentEmail: string;
  parentTimezone: string;
  mentorName: string;
  mentorEmail: string;
  mentorTimezone: string;
  startTimeUtc: Date;
  endTimeUtc: Date;
  meetingLink: string;
}

export class NotificationService {
  constructor(
    private readonly outboxRepo: NotificationRepository = new NotificationRepository(),
    private readonly emailAdapter: IEmailProviderAdapter = new MockEmailProviderAdapter()
  ) {}

  /**
   * Enqueues both Parent and Mentor confirmation notifications within an active Prisma transaction.
   */
  async enqueueBookingConfirmedNotifications(
    ctx: BookingNotificationContext,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const parentLocalStart = DateTime.fromJSDate(ctx.startTimeUtc, { zone: "utc" })
      .setZone(ctx.parentTimezone)
      .toFormat("EEEE, MMMM dd, yyyy 'at' hh:mm a (ZZZZ)");

    const parentLocalEnd = DateTime.fromJSDate(ctx.endTimeUtc, { zone: "utc" })
      .setZone(ctx.parentTimezone)
      .toFormat("hh:mm a (ZZZZ)");

    const mentorLocalStart = DateTime.fromJSDate(ctx.startTimeUtc, { zone: "utc" })
      .setZone(ctx.mentorTimezone)
      .toFormat("EEEE, MMMM dd, yyyy 'at' hh:mm a (ZZZZ)");

    const mentorLocalEnd = DateTime.fromJSDate(ctx.endTimeUtc, { zone: "utc" })
      .setZone(ctx.mentorTimezone)
      .toFormat("hh:mm a (ZZZZ)");

    // 1. Parent Confirmation Email
    const parentSubject = `Confirmed: Codeyoung Trial Class with ${ctx.mentorName}`;
    const parentHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2563eb;">Your Trial Class is Confirmed!</h2>
        <p>Dear ${ctx.parentName},</p>
        <p>We are thrilled to confirm your Codeyoung trial class. Here are your session details:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; font-weight: bold; color: #475569;">Mentor:</td><td style="padding: 8px;">${ctx.mentorName}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #475569;">Your Local Time:</td><td style="padding: 8px;">${parentLocalStart} – ${parentLocalEnd}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #475569;">Mentor Local Time:</td><td style="padding: 8px;">${mentorLocalStart} – ${mentorLocalEnd}</td></tr>
        </table>
        <div style="margin: 25px 0;">
          <a href="${ctx.meetingLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Join Trial Class Room</a>
        </div>
        <p style="color: #64748b; font-size: 14px;">Direct link: <a href="${ctx.meetingLink}">${ctx.meetingLink}</a></p>
        <p style="color: #64748b; font-size: 14px;">Best regards,<br/>The Codeyoung Academic Team</p>
      </div>
    `;

    // 2. Mentor Notification Email
    const mentorSubject = `New Demo Class Scheduled: ${ctx.parentName}`;
    const mentorHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #059669;">New Trial Class Assigned</h2>
        <p>Dear ${ctx.mentorName},</p>
        <p>A new trial class has been scheduled with parent <strong>${ctx.parentName}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; font-weight: bold; color: #475569;">Parent Name:</td><td style="padding: 8px;">${ctx.parentName} (${ctx.parentEmail})</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #475569;">Your Local Time:</td><td style="padding: 8px;">${mentorLocalStart} – ${mentorLocalEnd}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; color: #475569;">Parent Local Time:</td><td style="padding: 8px;">${parentLocalStart} – ${parentLocalEnd}</td></tr>
        </table>
        <div style="margin: 25px 0;">
          <a href="${ctx.meetingLink}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Enter Classroom</a>
        </div>
        <p style="color: #64748b; font-size: 14px;">Direct link: <a href="${ctx.meetingLink}">${ctx.meetingLink}</a></p>
      </div>
    `;

    await this.outboxRepo.enqueue(
      {
        bookingId: ctx.bookingId,
        recipientType: "PARENT",
        recipientEmail: ctx.parentEmail,
        recipientName: ctx.parentName,
        subject: parentSubject,
        contentHtml: parentHtml,
      },
      tx
    );

    await this.outboxRepo.enqueue(
      {
        bookingId: ctx.bookingId,
        recipientType: "MENTOR",
        recipientEmail: ctx.mentorEmail,
        recipientName: ctx.mentorName,
        subject: mentorSubject,
        contentHtml: mentorHtml,
      },
      tx
    );
  }

  /**
   * Processes all pending outbox messages (recoverable async worker).
   */
  async processPendingOutboxMessages(): Promise<{ processed: number; sent: number; failed: number }> {
    const pending = await this.outboxRepo.findPending(20);
    let sent = 0;
    let failed = 0;

    for (const msg of pending) {
      try {
        const result = await this.emailAdapter.sendEmail({
          to: msg.recipientEmail,
          recipientName: msg.recipientName,
          subject: msg.subject,
          html: msg.contentHtml,
        });

        if (result.success) {
          await this.outboxRepo.markSent(msg.id);
          sent++;
        } else {
          await this.outboxRepo.markFailedOrRetry(
            msg.id,
            result.error || "Email delivery failed",
            msg.retryCount,
            msg.maxRetries
          );
          failed++;
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await this.outboxRepo.markFailedOrRetry(msg.id, errorMsg, msg.retryCount, msg.maxRetries);
        failed++;
      }
    }

    return { processed: pending.length, sent, failed };
  }

  async getRecentNotifications(limit = 50): Promise<OutboxNotificationDTO[]> {
    return this.outboxRepo.findAllRecent(limit);
  }

  async getNotificationsForBooking(bookingId: string): Promise<OutboxNotificationDTO[]> {
    return this.outboxRepo.findByBookingId(bookingId);
  }
}
