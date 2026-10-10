import { describe, it, expect } from "vitest";
import { generateGoogleCalendarUrl } from "@/shared/calendar/calendar-export";

describe("Calendar Export Utilities", () => {
  it("generates a well-formed Google Calendar TEMPLATE URL", () => {
    const url = generateGoogleCalendarUrl({
      title: "Codeyoung Trial Class with Aarav Sharma",
      description: "Codeyoung 1-on-1 Trial Class for Leo Jenkins.\n\nMeeting Link: https://meet.codeyoung.com/room/test",
      location: "https://meet.codeyoung.com/room/test",
      startTimeUtc: new Date("2026-11-15T10:00:00.000Z"),
      endTimeUtc: new Date("2026-11-15T10:45:00.000Z"),
    });

    expect(url).toContain("https://calendar.google.com/calendar/render?action=TEMPLATE");
    expect(url).toContain("text=Codeyoung+Trial+Class+with+Aarav+Sharma");
    expect(url).toContain("dates=20261115T100000Z%2F20261115T104500Z");
    expect(url).toContain("location=https%3A%2F%2Fmeet.codeyoung.com%2Froom%2Ftest");
  });
});
