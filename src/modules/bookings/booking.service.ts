import { mentorsModule, MentorDTO } from "@/modules/mentors";
import { notificationsModule } from "@/modules/notifications";
import {
  resolveLocalSlotToUtc,
  getMentorLocalDateString,
  getDayOfWeekInTimezone,
  getTimeInTimezone,
} from "@/shared/time/timezone-utils";
import { NoMentorAvailableError } from "@/shared/errors/domain-error";
import { BookingRepository } from "./booking.repository";
import { BookingDTO, CreateBookingInput } from "./booking.types";

export class BookingService {
  constructor(private readonly bookingRepo: BookingRepository = new BookingRepository()) {}

  /**
   * Evaluates if a mentor is scheduled to work during the given UTC interval.
   */
  isMentorWorkingAtSlot(mentor: MentorDTO, utcStart: Date, utcEnd: Date): boolean {
    const mentorDayOfWeek = getDayOfWeekInTimezone(utcStart, mentor.timezone);
    const slotStartLocal = getTimeInTimezone(utcStart, mentor.timezone);
    const slotEndLocal = getTimeInTimezone(utcEnd, mentor.timezone);

    // Check if slot spans across midnight in mentor's local time
    const endDayOfWeek = getDayOfWeekInTimezone(utcEnd, mentor.timezone);

    for (const wh of mentor.workingHours) {
      if (wh.dayOfWeek === mentorDayOfWeek) {
        // Normal within-day slot
        if (mentorDayOfWeek === endDayOfWeek) {
          if (slotStartLocal >= wh.startLocalTime && slotEndLocal <= wh.endLocalTime) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Main business orchestration:
   * Resolves local slot, discovers eligible mentors, load-balances, and atomically books.
   */
  async createTrialBooking(input: CreateBookingInput): Promise<BookingDTO> {
    // 1. Resolve local slot to UTC and validate DST sanity
    const resolvedSlot = resolveLocalSlotToUtc({
      dateStr: input.slotDate,
      timeStr: input.slotStartTime,
      timeZone: input.parentTimezone,
      durationMinutes: input.slotDurationMinutes || 45,
    });

    const { utcStart, utcEnd } = resolvedSlot;

    // 2. Fetch all active mentors
    const activeMentors = await mentorsModule.getActiveMentors();

    // 3. Filter mentors working during this slot
    const workingMentors = activeMentors.filter((m) =>
      this.isMentorWorkingAtSlot(m, utcStart, utcEnd)
    );

    if (workingMentors.length === 0) {
      throw new NoMentorAvailableError("No mentors are scheduled to work at this requested time.");
    }

    // 4. Fetch existing collisions and daily counts for working mentors
    const mentorDailyLoads: Array<{
      mentor: MentorDTO;
      mentorLocalDate: string;
      dailyCount: number;
    }> = [];

    for (const mentor of workingMentors) {
      const mentorLocalDate = getMentorLocalDateString(utcStart, mentor.timezone);
      const count = await this.bookingRepo.countConfirmedBookingsForMentorDate(mentor.id, mentorLocalDate);

      if (count < 2) {
        mentorDailyLoads.push({
          mentor,
          mentorLocalDate,
          dailyCount: count,
        });
      }
    }

    if (mentorDailyLoads.length === 0) {
      throw new NoMentorAvailableError(
        "All mentors working in this slot have reached their maximum capacity of 2 demo classes for the day."
      );
    }

    // 5. Sort candidates by least daily load (load balancing), then deterministically by ID
    mentorDailyLoads.sort((a, b) => {
      if (a.dailyCount !== b.dailyCount) {
        return a.dailyCount - b.dailyCount;
      }
      return a.mentor.id.localeCompare(b.mentor.id);
    });

    // 6. Attempt atomic reservation in order of candidate preference
    let bookedResult: BookingDTO | null = null;
    let lastError: Error | null = null;

    for (const candidate of mentorDailyLoads) {
      try {
        bookedResult = await this.bookingRepo.attemptAtomicBooking({
          mentorId: candidate.mentor.id,
          mentorName: candidate.mentor.name,
          mentorEmail: candidate.mentor.email,
          mentorTimezone: candidate.mentor.timezone,
          mentorLocalDate: candidate.mentorLocalDate,
          utcStart,
          utcEnd,
          parentName: input.parentName,
          parentEmail: input.parentEmail,
          parentTimezone: input.parentTimezone,
        });

        if (bookedResult) break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Continue to try the next candidate mentor
      }
    }

    if (!bookedResult) {
      throw (
        lastError ||
        new NoMentorAvailableError("Unable to reserve slot. Please select a different time.")
      );
    }

    // 7. Trigger async outbox dispatch in background (non-blocking)
    notificationsModule.processPendingOutboxMessages().catch((e) => {
      console.warn("Background notification delivery encountered non-fatal error:", e);
    });

    return bookedResult;
  }

  async getConfirmedBookingsInRange(startUtc: Date, endUtc: Date) {
    return this.bookingRepo.getConfirmedBookingsInRange(startUtc, endUtc);
  }

  async countConfirmedBookingsForMentorDate(mentorId: string, mentorLocalDate: string) {
    return this.bookingRepo.countConfirmedBookingsForMentorDate(mentorId, mentorLocalDate);
  }

  async getRecentBookings(limit = 20) {
    return this.bookingRepo.getRecentBookings(limit);
  }
}
