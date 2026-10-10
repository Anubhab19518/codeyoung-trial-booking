import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/shared/db/prisma.client";
import { bookingsModule } from "@/modules/bookings";
import { main as seedDatabase } from "../../prisma/seed";

describe("Booking Concurrency & Database Integrity Integration Tests", () => {
  beforeAll(async () => {
    // Ensure database is freshly seeded
    await seedDatabase();
    // Clean up test bookings and outbox
    await prisma.notificationOutbox.deleteMany();
    await prisma.booking.deleteMany();
  });

  afterAll(async () => {
    await prisma.notificationOutbox.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.$disconnect();
  });

  it("DATABASE EXCLUSION CONSTRAINT: directly rejects overlapping confirmed bookings for the same mentor", async () => {
    const mentor = await prisma.mentor.findFirstOrThrow({
      where: { email: "aarav.sharma@codeyoung.com" },
    });

    const startUtc = new Date("2026-11-10T10:00:00.000Z");
    const endUtc = new Date("2026-11-10T10:45:00.000Z");

    // First booking
    const b1 = await prisma.booking.create({
      data: {
        mentorId: mentor.id,
        parentName: "Parent One",
        parentEmail: "parent1@test.com",
        parentTimezone: "Asia/Kolkata",
        startTimeUtc: startUtc,
        endTimeUtc: endUtc,
        mentorLocalDate: "2026-11-10",
        meetingLink: "https://meet.codeyoung.com/room/test-1",
        status: "CONFIRMED",
      },
    });
    expect(b1.id).toBeDefined();

    // Second booking with overlapping time window (10:15 - 11:00 UTC)
    const overlapStart = new Date("2026-11-10T10:15:00.000Z");
    const overlapEnd = new Date("2026-11-10T11:00:00.000Z");

    let errorThrown: unknown = null;
    try {
      await prisma.booking.create({
        data: {
          mentorId: mentor.id,
          parentName: "Parent Two",
          parentEmail: "parent2@test.com",
          parentTimezone: "Asia/Kolkata",
          startTimeUtc: overlapStart,
          endTimeUtc: overlapEnd,
          mentorLocalDate: "2026-11-10",
          meetingLink: "https://meet.codeyoung.com/room/test-2",
          status: "CONFIRMED",
        },
      });
    } catch (err) {
      errorThrown = err;
    }

    // Must be rejected by PostgreSQL exclusion constraint
    expect(errorThrown).not.toBeNull();
    const errorStr = String(errorThrown);
    expect(
      errorStr.includes("exclusion") ||
      errorStr.includes("no_overlapping_confirmed_bookings") ||
      errorStr.includes("constraint")
    ).toBe(true);

    // Clean up
    await prisma.booking.deleteMany({ where: { id: b1.id } });
  });

  it("HIGH CONCURRENCY RACE CONDITION: 10 parallel booking attempts for 1 slot -> exactly 1 succeeds", async () => {
    // We target a specific Saturday slot (2026-11-21 16:00 America/New_York) where ONLY Jessica Davis works
    const date = "2026-11-21";
    const time = "16:00";
    const timezone = "America/New_York";


    const attempts = Array.from({ length: 10 }, (_, i) =>
      bookingsModule.createTrialBooking({
        parentName: `Concurrent Parent ${i + 1}`,
        parentEmail: `concurrent${i + 1}@example.com`,
        parentTimezone: timezone,
        slotDate: date,
        slotStartTime: time,
        slotDurationMinutes: 45,
      })
    );

    const results = await Promise.allSettled(attempts);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    console.log(`[Concurrency Test] 10 Parallel Requests: ${fulfilled.length} Fulfilled, ${rejected.length} Rejected`);

    // Exactly 1 succeeds, remaining 9 are rejected
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(9);

    // Verify DB state
    const confirmedCount = await prisma.booking.count({
      where: {
        status: "CONFIRMED",
        parentEmail: { startsWith: "concurrent" },
      },
    });
    expect(confirmedCount).toBe(1);
  });

  it("DAILY QUOTA ENFORCEMENT: prevents more than 2 confirmed bookings per mentor-local day under concurrent requests", async () => {
    // Pick a date: 2026-11-18 (Wednesday).
    // Send 6 non-overlapping slot booking attempts for Jessica Davis (works 14:00 - 20:00 EST):
    // 14:00, 15:00, 16:00, 17:00, 18:00, 19:00
    const times = ["14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
    const date = "2026-11-18";
    const timezone = "America/New_York";

    const attempts = times.map((t, idx) =>
      bookingsModule.createTrialBooking({
        parentName: `Quota Parent ${idx + 1}`,
        parentEmail: `quota${idx + 1}@example.com`,
        parentTimezone: timezone,
        slotDate: date,
        slotStartTime: t,
        slotDurationMinutes: 45,
      })
    );

    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    console.log(`[Daily Quota Test] 6 Slot Requests for same day: ${fulfilled.length} Fulfilled, ${rejected.length} Rejected`);

    // Jessica (or other working mentors for this window) can only accept at most 2 per mentor-local day
    // Check total bookings created
    const totalBooked = await prisma.booking.count({
      where: {
        status: "CONFIRMED",
        parentEmail: { startsWith: "quota" },
      },
    });

    // Check by mentor
    const mentorsBooked = await prisma.booking.groupBy({
      by: ["mentorId", "mentorLocalDate"],
      where: {
        status: "CONFIRMED",
        parentEmail: { startsWith: "quota" },
      },
      _count: { id: true },
    });

    for (const group of mentorsBooked) {
      expect(group._count.id).toBeLessThanOrEqual(2);
    }

    expect(totalBooked).toBeLessThanOrEqual(mentorsBooked.length * 2);
  });
});
