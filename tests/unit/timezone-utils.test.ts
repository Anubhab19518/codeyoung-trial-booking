import { describe, it, expect } from "vitest";
import {
  isValidIanaTimezone,
  isNonexistentSpringForwardTime,
  isAmbiguousFallBackTime,
  resolveLocalSlotToUtc,
  getMentorLocalDateString,
  getDayOfWeekInTimezone,
} from "@/shared/time/timezone-utils";
import { DstTransitionError, ValidationError } from "@/shared/errors/domain-error";

describe("Timezone Utilities & DST Edge Cases", () => {
  describe("IANA Timezone Validation", () => {
    it("accepts valid IANA timezones", () => {
      expect(isValidIanaTimezone("Asia/Kolkata")).toBe(true);
      expect(isValidIanaTimezone("America/New_York")).toBe(true);
      expect(isValidIanaTimezone("America/Los_Angeles")).toBe(true);
      expect(isValidIanaTimezone("Europe/London")).toBe(true);
    });

    it("rejects invalid or non-IANA timezone strings", () => {
      expect(isValidIanaTimezone("Invalid/Zone")).toBe(false);
      expect(isValidIanaTimezone("EST")).toBe(false);
      expect(isValidIanaTimezone("")).toBe(false);
    });
  });

  describe("Daylight Saving Time (DST) Transitions", () => {
    // US Eastern Spring-Forward in 2026: March 8, 2026 (02:00 -> 03:00)
    it("detects nonexistent spring-forward time in US Eastern (America/New_York)", () => {
      const isGap = isNonexistentSpringForwardTime("2026-03-08", "02:30", "America/New_York");
      expect(isGap).toBe(true);

      expect(() =>
        resolveLocalSlotToUtc({
          dateStr: "2026-03-08",
          timeStr: "02:30",
          timeZone: "America/New_York",
        })
      ).toThrow(DstTransitionError);
    });

    // UK BST Spring-Forward in 2026: March 29, 2026 (01:00 -> 02:00)
    it("detects nonexistent spring-forward time in UK (Europe/London)", () => {
      const isGap = isNonexistentSpringForwardTime("2026-03-29", "01:30", "Europe/London");
      expect(isGap).toBe(true);

      expect(() =>
        resolveLocalSlotToUtc({
          dateStr: "2026-03-29",
          timeStr: "01:30",
          timeZone: "Europe/London",
        })
      ).toThrow(DstTransitionError);
    });

    // US Eastern Fall-Back in 2026: November 1, 2026 (02:00 -> 01:00, so 01:00 - 02:00 repeats)
    it("detects ambiguous fall-back time in US Eastern (America/New_York)", () => {
      const isAmbiguous = isAmbiguousFallBackTime("2026-11-01", "01:30", "America/New_York");
      expect(isAmbiguous).toBe(true);

      expect(() =>
        resolveLocalSlotToUtc({
          dateStr: "2026-11-01",
          timeStr: "01:30",
          timeZone: "America/New_York",
        })
      ).toThrow(DstTransitionError);
    });

    // UK Fall-Back in 2026: October 25, 2026 (02:00 -> 01:00, so 01:00 - 02:00 repeats)
    it("detects ambiguous fall-back time in UK (Europe/London)", () => {
      const isAmbiguous = isAmbiguousFallBackTime("2026-10-25", "01:30", "Europe/London");
      expect(isAmbiguous).toBe(true);

      expect(() =>
        resolveLocalSlotToUtc({
          dateStr: "2026-10-25",
          timeStr: "01:30",
          timeZone: "Europe/London",
        })
      ).toThrow(DstTransitionError);
    });

    it("accepts valid standard times outside transition gaps", () => {
      const slot = resolveLocalSlotToUtc({
        dateStr: "2026-10-15",
        timeStr: "14:00",
        timeZone: "America/New_York",
        durationMinutes: 45,
      });

      expect(slot.utcStart).toBeDefined();
      expect(slot.utcEnd).toBeDefined();
      // Oct 15 is in EDT (UTC-4), so 14:00 EDT = 18:00 UTC
      expect(slot.utcStart.toISOString()).toBe("2026-10-15T18:00:00.000Z");
      expect(slot.utcEnd.toISOString()).toBe("2026-10-15T18:45:00.000Z");
    });
  });

  describe("Cross-Midnight and Mentor-Local Date Calculations", () => {
    it("correctly calculates mentor-local calendar day when UTC timestamp shifts date", () => {
      // 2026-10-15 22:30 UTC
      const utcDate = new Date("2026-10-15T22:30:00.000Z");

      // In IST (UTC+5:30), 22:30 + 5:30 = 04:00 AM next day (Oct 16)
      const istDate = getMentorLocalDateString(utcDate, "Asia/Kolkata");
      expect(istDate).toBe("2026-10-16");

      // In New York (UTC-4 EDT), 22:30 - 4:00 = 18:30 same day (Oct 15)
      const nyDate = getMentorLocalDateString(utcDate, "America/New_York");
      expect(nyDate).toBe("2026-10-15");

      // In Los Angeles (UTC-7 PDT), 22:30 - 7:00 = 15:30 same day (Oct 15)
      const laDate = getMentorLocalDateString(utcDate, "America/Los_Angeles");
      expect(laDate).toBe("2026-10-15");
    });

    it("correctly determines day of week in mentor timezone", () => {
      // Friday 2026-10-16 at 01:00 UTC
      const utcDate = new Date("2026-10-16T01:00:00.000Z");

      // In IST (+5:30), it is Friday morning (dayOfWeek = 5)
      expect(getDayOfWeekInTimezone(utcDate, "Asia/Kolkata")).toBe(5);

      // In Los Angeles (-7 PDT), it is Thursday evening Oct 15 (dayOfWeek = 4)
      expect(getDayOfWeekInTimezone(utcDate, "America/Los_Angeles")).toBe(4);
    });
  });
});
