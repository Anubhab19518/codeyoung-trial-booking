import { prisma } from "@/shared/db/prisma.client";
import { Prisma } from "@prisma/client";
import { notificationsModule } from "@/modules/notifications";
import { ConflictError, DailyQuotaExceededError } from "@/shared/errors/domain-error";
import { BookingDTO } from "./booking.types";
import { DateTime } from "luxon";

export interface AtomicBookingCandidate {
  mentorId: string;
  mentorName: string;
  mentorEmail: string;
  mentorTimezone: string;
  mentorLocalDate: string;
  utcStart: Date;
  utcEnd: Date;
  parentName: string;
  parentEmail: string;
  parentTimezone: string;
}

export class BookingRepository {
  /**
   * Attempts to atomically lock, verify daily quota, verify collisions, and persist a booking with notifications.
   * If the mentor has already reached 2 bookings or has a collision, throws ConflictError/DailyQuotaExceededError.
   */
  async attemptAtomicBooking(candidate: AtomicBookingCandidate): Promise<BookingDTO> {
    return prisma.$transaction(
      async (tx) => {
        // 1. Acquire transaction-scoped advisory lock for this mentor on their local date
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(concat(${candidate.mentorId}::text, ':', ${candidate.mentorLocalDate}::text)))
        `;

        // 2. Enforce Daily Quota (Max 2 confirmed bookings per mentor-local calendar day)
        const dailyCount = await tx.booking.count({
          where: {
            mentorId: candidate.mentorId,
            mentorLocalDate: candidate.mentorLocalDate,
            status: "CONFIRMED",
          },
        });

        if (dailyCount >= 2) {
          throw new DailyQuotaExceededError(
            `Mentor ${candidate.mentorName} has already reached the maximum of 2 demo classes for ${candidate.mentorLocalDate}.`
          );
        }

        // 3. Collision check in UTC interval
        const existingCollision = await tx.booking.findFirst({
          where: {
            mentorId: candidate.mentorId,
            status: "CONFIRMED",
            startTimeUtc: { lt: candidate.utcEnd },
            endTimeUtc: { gt: candidate.utcStart },
          },
        });

        if (existingCollision) {
          throw new ConflictError(
            `Mentor ${candidate.mentorName} is already booked during this time window.`
          );
        }

        // 4. Generate unique dummy meeting link
        const meetingRoomId = `meet-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const meetingLink = `https://meet.codeyoung.com/room/${meetingRoomId}`;

        // 5. Insert Booking record
        const booking = await tx.booking.create({
          data: {
            mentorId: candidate.mentorId,
            parentName: candidate.parentName,
            parentEmail: candidate.parentEmail,
            parentTimezone: candidate.parentTimezone,
            startTimeUtc: candidate.utcStart,
            endTimeUtc: candidate.utcEnd,
            mentorLocalDate: candidate.mentorLocalDate,
            meetingLink,
            status: "CONFIRMED",
          },
        });

        // 6. Enqueue parent & mentor outbox notifications atomically within the transaction
        await notificationsModule.enqueueBookingConfirmedNotifications(
          {
            bookingId: booking.id,
            parentName: candidate.parentName,
            parentEmail: candidate.parentEmail,
            parentTimezone: candidate.parentTimezone,
            mentorName: candidate.mentorName,
            mentorEmail: candidate.mentorEmail,
            mentorTimezone: candidate.mentorTimezone,
            startTimeUtc: candidate.utcStart,
            endTimeUtc: candidate.utcEnd,
            meetingLink,
          },
          tx
        );

        const parentLocalStart = DateTime.fromJSDate(candidate.utcStart, { zone: "utc" })
          .setZone(candidate.parentTimezone)
          .toFormat("yyyy-MM-dd HH:mm");
        const parentLocalEnd = DateTime.fromJSDate(candidate.utcEnd, { zone: "utc" })
          .setZone(candidate.parentTimezone)
          .toFormat("yyyy-MM-dd HH:mm");
        const mentorLocalStart = DateTime.fromJSDate(candidate.utcStart, { zone: "utc" })
          .setZone(candidate.mentorTimezone)
          .toFormat("yyyy-MM-dd HH:mm");
        const mentorLocalEnd = DateTime.fromJSDate(candidate.utcEnd, { zone: "utc" })
          .setZone(candidate.mentorTimezone)
          .toFormat("yyyy-MM-dd HH:mm");

        return {
          id: booking.id,
          mentorId: candidate.mentorId,
          mentorName: candidate.mentorName,
          mentorEmail: candidate.mentorEmail,
          mentorTimezone: candidate.mentorTimezone,
          parentName: candidate.parentName,
          parentEmail: candidate.parentEmail,
          parentTimezone: candidate.parentTimezone,
          startTimeUtc: booking.startTimeUtc,
          endTimeUtc: booking.endTimeUtc,
          parentLocalStart,
          parentLocalEnd,
          mentorLocalStart,
          mentorLocalEnd,
          mentorLocalDate: candidate.mentorLocalDate,
          meetingLink: booking.meetingLink,
          status: booking.status as "CONFIRMED" | "CANCELLED",
          createdAt: booking.createdAt,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 10000,
      }
    );
  }

  async getConfirmedBookingsInRange(startUtc: Date, endUtc: Date): Promise<Array<{ mentorId: string; startTimeUtc: Date; endTimeUtc: Date }>> {
    return prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        startTimeUtc: { lt: endUtc },
        endTimeUtc: { gt: startUtc },
      },
      select: {
        mentorId: true,
        startTimeUtc: true,
        endTimeUtc: true,
      },
    });
  }

  async countConfirmedBookingsForMentorDate(mentorId: string, mentorLocalDate: string): Promise<number> {
    return prisma.booking.count({
      where: {
        mentorId,
        mentorLocalDate,
        status: "CONFIRMED",
      },
    });
  }

  async getRecentBookings(limit = 20): Promise<BookingDTO[]> {
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        mentor: true,
      },
    });

    return bookings.map((b) => ({
      id: b.id,
      mentorId: b.mentorId,
      mentorName: b.mentor.name,
      mentorEmail: b.mentor.email,
      mentorTimezone: b.mentor.timezone,
      parentName: b.parentName,
      parentEmail: b.parentEmail,
      parentTimezone: b.parentTimezone,
      startTimeUtc: b.startTimeUtc,
      endTimeUtc: b.endTimeUtc,
      parentLocalStart: DateTime.fromJSDate(b.startTimeUtc, { zone: "utc" }).setZone(b.parentTimezone).toFormat("yyyy-MM-dd HH:mm"),
      parentLocalEnd: DateTime.fromJSDate(b.endTimeUtc, { zone: "utc" }).setZone(b.parentTimezone).toFormat("yyyy-MM-dd HH:mm"),
      mentorLocalStart: DateTime.fromJSDate(b.startTimeUtc, { zone: "utc" }).setZone(b.mentor.timezone).toFormat("yyyy-MM-dd HH:mm"),
      mentorLocalEnd: DateTime.fromJSDate(b.endTimeUtc, { zone: "utc" }).setZone(b.mentor.timezone).toFormat("yyyy-MM-dd HH:mm"),
      mentorLocalDate: b.mentorLocalDate,
      meetingLink: b.meetingLink,
      status: b.status as "CONFIRMED" | "CANCELLED",
      createdAt: b.createdAt,
    }));
  }
}
