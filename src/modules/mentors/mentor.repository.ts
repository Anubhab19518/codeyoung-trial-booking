import { prisma } from "@/shared/db/prisma.client";
import { MentorDTO } from "./mentor.types";

export class MentorRepository {
  async findAllActive(): Promise<MentorDTO[]> {
    const mentors = await prisma.mentor.findMany({
      where: { isActive: true },
      include: {
        workingHours: true,
      },
      orderBy: { name: "asc" },
    });

    return mentors.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      timezone: m.timezone,
      isActive: m.isActive,
      workingHours: m.workingHours.map((wh) => ({
        id: wh.id,
        dayOfWeek: wh.dayOfWeek,
        startLocalTime: wh.startLocalTime,
        endLocalTime: wh.endLocalTime,
      })),
    }));
  }

  async findById(id: string): Promise<MentorDTO | null> {
    const mentor = await prisma.mentor.findUnique({
      where: { id },
      include: {
        workingHours: true,
      },
    });

    if (!mentor) return null;

    return {
      id: mentor.id,
      name: mentor.name,
      email: mentor.email,
      timezone: mentor.timezone,
      isActive: mentor.isActive,
      workingHours: mentor.workingHours.map((wh) => ({
        id: wh.id,
        dayOfWeek: wh.dayOfWeek,
        startLocalTime: wh.startLocalTime,
        endLocalTime: wh.endLocalTime,
      })),
    };
  }
}
