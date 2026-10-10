import { mentorsModule, MentorDTO } from "@/modules/mentors";
import { bookingsModule } from "@/modules/bookings";
import {
  assertValidIanaTimezone,
  resolveLocalSlotToUtc,
  getMentorLocalDateString,
  getDayOfWeekInTimezone,
  getTimeInTimezone,
} from "@/shared/time/timezone-utils";
import { AvailableSlotDTO, GetAvailableSlotsParams } from "./scheduling.types";

export class SlotCalculatorService {
  /**
   * Helper to check if mentor working hours cover the UTC interval.
   */
  private isMentorWorking(mentor: MentorDTO, utcStart: Date, utcEnd: Date): boolean {
    const startDayOfWeek = getDayOfWeekInTimezone(utcStart, mentor.timezone);
    const endDayOfWeek = getDayOfWeekInTimezone(utcEnd, mentor.timezone);
    const slotStartLocal = getTimeInTimezone(utcStart, mentor.timezone);
    const slotEndLocal = getTimeInTimezone(utcEnd, mentor.timezone);

    for (const wh of mentor.workingHours) {
      if (wh.dayOfWeek === startDayOfWeek && startDayOfWeek === endDayOfWeek) {
        if (slotStartLocal >= wh.startLocalTime && slotEndLocal <= wh.endLocalTime) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Generates all available slots in the parent's local timezone for a specific calendar date.
   */
  async getAvailableSlots(params: GetAvailableSlotsParams): Promise<AvailableSlotDTO[]> {
    const { date, timezone, durationMinutes = 45 } = params;
    assertValidIanaTimezone(timezone);

    const activeMentors = await mentorsModule.getActiveMentors();
    if (activeMentors.length === 0) return [];

    const availableSlots: AvailableSlotDTO[] = [];

    // Generate candidate start times throughout the day from 06:00 to 22:30 in 30-minute intervals
    for (let hour = 6; hour <= 22; hour++) {
      for (const minute of [0, 30]) {
        if (hour === 22 && minute > 30) continue;

        const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

        let resolvedSlot;
        try {
          resolvedSlot = resolveLocalSlotToUtc({
            dateStr: date,
            timeStr,
            timeZone: timezone,
            durationMinutes,
          });
        } catch {
          // Nonexistent DST spring-forward time or ambiguous fall-back time - safely skip
          continue;
        }

        const { utcStart, utcEnd, parentLocalStart, parentLocalEnd } = resolvedSlot;

        // Find working mentors for this UTC slot
        const workingMentors = activeMentors.filter((m) =>
          this.isMentorWorking(m, utcStart, utcEnd)
        );

        if (workingMentors.length === 0) continue;

        // Query collisions in this UTC interval
        const collisions = await bookingsModule.getConfirmedBookingsInRange(utcStart, utcEnd);
        const collidingMentorIds = new Set(collisions.map((c) => c.mentorId));

        // Count available un-collided mentors who also haven't hit their 2-classes-per-day cap
        let availableMentorCount = 0;

        for (const mentor of workingMentors) {
          if (collidingMentorIds.has(mentor.id)) continue;

          const mentorLocalDate = getMentorLocalDateString(utcStart, mentor.timezone);
          const count = await bookingsModule.countConfirmedBookingsForMentorDate(
            mentor.id,
            mentorLocalDate
          );

          if (count < 2) {
            availableMentorCount++;
          }
        }

        if (availableMentorCount > 0) {
          const endHour = Math.floor((hour * 60 + minute + durationMinutes) / 60);
          const endMin = (hour * 60 + minute + durationMinutes) % 60;
          const endTimeStr = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

          availableSlots.push({
            slotDate: date,
            slotStartTime: timeStr,
            slotEndTime: endTimeStr,
            parentLocalStart,
            parentLocalEnd,
            utcStart: utcStart.toISOString(),
            utcEnd: utcEnd.toISOString(),
            availableMentorCount,
          });
        }
      }
    }

    return availableSlots;
  }
}
