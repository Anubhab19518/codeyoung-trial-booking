import { MentorService } from "./mentor.service";
import { MentorDTO, WorkingHourDTO } from "./mentor.types";

export type { MentorDTO, WorkingHourDTO };

// Export singleton service instance as the public contract
export const mentorsModule = new MentorService();
