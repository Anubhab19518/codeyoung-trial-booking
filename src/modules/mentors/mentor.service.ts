import { MentorRepository } from "./mentor.repository";
import { MentorDTO } from "./mentor.types";

export class MentorService {
  constructor(private readonly mentorRepo: MentorRepository = new MentorRepository()) {}

  async getActiveMentors(): Promise<MentorDTO[]> {
    return this.mentorRepo.findAllActive();
  }

  async getMentorById(id: string): Promise<MentorDTO | null> {
    return this.mentorRepo.findById(id);
  }
}
