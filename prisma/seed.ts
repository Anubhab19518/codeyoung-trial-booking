import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedMentor {
  name: string;
  email: string;
  timezone: string;
  workingHours: Array<{
    dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
    startLocalTime: string;
    endLocalTime: string;
  }>;
}

const SEED_MENTORS: SeedMentor[] = [
  {
    name: "Aarav Sharma",
    email: "aarav.sharma@codeyoung.com",
    timezone: "Asia/Kolkata",
    workingHours: [1, 2, 3, 4, 5].map((d) => ({
      dayOfWeek: d,
      startLocalTime: "15:00",
      endLocalTime: "21:00",
    })),
  },
  {
    name: "Priya Patel",
    email: "priya.patel@codeyoung.com",
    timezone: "Asia/Kolkata",
    workingHours: [2, 3, 4, 5, 6].map((d) => ({
      dayOfWeek: d,
      startLocalTime: "10:00",
      endLocalTime: "16:00",
    })),
  },
  {
    name: "Rohan Gupta",
    email: "rohan.gupta@codeyoung.com",
    timezone: "Asia/Kolkata",
    workingHours: [1, 2, 3, 4, 5].map((d) => ({
      dayOfWeek: d,
      startLocalTime: "17:00",
      endLocalTime: "22:00",
    })),
  },
  {
    name: "Ananya Iyer",
    email: "ananya.iyer@codeyoung.com",
    timezone: "Asia/Kolkata",
    workingHours: [0, 3, 4, 5, 6].map((d) => ({
      dayOfWeek: d,
      startLocalTime: "11:00",
      endLocalTime: "18:00",
    })),
  },
  {
    name: "Emily Watson",
    email: "emily.watson@codeyoung.com",
    timezone: "Europe/London",
    workingHours: [1, 2, 3, 4, 5].map((d) => ({
      dayOfWeek: d,
      startLocalTime: "09:00",
      endLocalTime: "15:00",
    })),
  },
  {
    name: "Oliver Smith",
    email: "oliver.smith@codeyoung.com",
    timezone: "Europe/London",
    workingHours: [1, 2, 3, 4, 5].map((d) => ({
      dayOfWeek: d,
      startLocalTime: "13:00",
      endLocalTime: "19:00",
    })),
  },
  {
    name: "Michael Brown",
    email: "michael.brown@codeyoung.com",
    timezone: "America/New_York",
    workingHours: [1, 2, 3, 4, 5].map((d) => ({
      dayOfWeek: d,
      startLocalTime: "09:00",
      endLocalTime: "15:00",
    })),
  },
  {
    name: "Jessica Davis",
    email: "jessica.davis@codeyoung.com",
    timezone: "America/New_York",
    workingHours: [2, 3, 4, 5, 6].map((d) => ({
      dayOfWeek: d,
      startLocalTime: "14:00",
      endLocalTime: "20:00",
    })),
  },
  {
    name: "David Miller",
    email: "david.miller@codeyoung.com",
    timezone: "America/Los_Angeles",
    workingHours: [1, 2, 3, 4, 5].map((d) => ({
      dayOfWeek: d,
      startLocalTime: "09:00",
      endLocalTime: "15:00",
    })),
  },
  {
    name: "Sophia Wilson",
    email: "sophia.wilson@codeyoung.com",
    timezone: "America/Los_Angeles",
    workingHours: [1, 2, 3, 4, 5].map((d) => ({
      dayOfWeek: d,
      startLocalTime: "13:00",
      endLocalTime: "19:00",
    })),
  },
];

export async function main() {
  console.log("🌱 Seeding 10 mentors and working schedules...");

  await prisma.$transaction(async (tx) => {
    for (const mentorData of SEED_MENTORS) {
      const mentor = await tx.mentor.upsert({
        where: { email: mentorData.email },
        update: {
          name: mentorData.name,
          timezone: mentorData.timezone,
          isActive: true,
        },
        create: {
          name: mentorData.name,
          email: mentorData.email,
          timezone: mentorData.timezone,
          isActive: true,
        },
      });

      // Delete existing working hours to avoid duplicates on re-seed
      await tx.mentorWorkingHour.deleteMany({
        where: { mentorId: mentor.id },
      });

      // Insert working hours
      await tx.mentorWorkingHour.createMany({
        data: mentorData.workingHours.map((wh) => ({
          mentorId: mentor.id,
          dayOfWeek: wh.dayOfWeek,
          startLocalTime: wh.startLocalTime,
          endLocalTime: wh.endLocalTime,
        })),
      });

      console.log(`✓ Seeded mentor: ${mentor.name} (${mentor.timezone})`);
    }
  });

  console.log("✅ Mentor seeding completed successfully.");
}


if (require.main === module) {
  main()
    .catch((e) => {
      console.error("❌ Seeding failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
