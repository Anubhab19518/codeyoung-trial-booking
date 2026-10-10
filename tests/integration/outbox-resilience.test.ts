import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/shared/db/prisma.client";
import { bookingsModule } from "@/modules/bookings";
import { notificationsModule } from "@/modules/notifications";
import { main as seedDatabase } from "../../prisma/seed";

describe("Transactional Outbox & Notification Resilience Integration Tests", () => {
  beforeAll(async () => {
    await seedDatabase();
    await prisma.notificationOutbox.deleteMany();
    await prisma.booking.deleteMany();
  });

  afterAll(async () => {
    await prisma.notificationOutbox.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.$disconnect();
  });

  it("creates outbox records atomically with booking confirmation", async () => {
    const booking = await bookingsModule.createTrialBooking({
      parentName: "Alice Wonderland",
      parentEmail: "alice@example.com",
      parentTimezone: "Europe/London",
      slotDate: "2026-11-20",
      slotStartTime: "10:00",
      slotDurationMinutes: 45,
    });

    expect(booking.id).toBeDefined();
    expect(booking.mentorName).toBeDefined();
    expect(booking.meetingLink).toContain("https://meet.codeyoung.com/room/");

    // Check outbox entries
    const outboxEntries = await prisma.notificationOutbox.findMany({
      where: { bookingId: booking.id },
    });

    // Exactly 2 notifications: 1 for PARENT, 1 for MENTOR
    expect(outboxEntries.length).toBe(2);

    const parentNotif = outboxEntries.find((e) => e.recipientType === "PARENT");
    const mentorNotif = outboxEntries.find((e) => e.recipientType === "MENTOR");

    expect(parentNotif).toBeDefined();
    expect(parentNotif?.recipientEmail).toBe("alice@example.com");
    expect(parentNotif?.subject).toContain("Confirmed: Codeyoung Trial Class");
    expect(parentNotif?.contentHtml).toContain(booking.meetingLink);

    expect(mentorNotif).toBeDefined();
    expect(mentorNotif?.recipientEmail).toBe(booking.mentorEmail);
    expect(mentorNotif?.subject).toContain("New Demo Class Scheduled");
    expect(mentorNotif?.contentHtml).toContain(booking.meetingLink);
  });

  it("outbox worker processes pending messages without affecting confirmed bookings", async () => {
    // Explicitly create a pending outbox item
    const booking = await prisma.booking.findFirstOrThrow();
    await prisma.notificationOutbox.create({
      data: {
        bookingId: booking.id,
        recipientType: "PARENT",
        recipientEmail: "pending_test@example.com",
        recipientName: "Pending Parent",
        subject: "Manual Outbox Test",
        contentHtml: "<p>Test</p>",
        status: "PENDING",
      },
    });

    const result = await notificationsModule.processPendingOutboxMessages();
    expect(result.processed).toBeGreaterThan(0);
    expect(result.sent).toBeGreaterThan(0);

    const pendingLeft = await prisma.notificationOutbox.count({
      where: { status: "PENDING" },
    });
    expect(pendingLeft).toBe(0);

    const sentCount = await prisma.notificationOutbox.count({
      where: { status: "SENT" },
    });
    expect(sentCount).toBeGreaterThan(0);
  });

});
