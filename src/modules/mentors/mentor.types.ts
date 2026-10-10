export interface WorkingHourDTO {
  id: string;
  dayOfWeek: number; // 0=Sun ... 6=Sat
  startLocalTime: string; // "HH:mm"
  endLocalTime: string;   // "HH:mm"
}

export interface MentorDTO {
  id: string;
  name: string;
  email: string;
  timezone: string;
  isActive: boolean;
  workingHours: WorkingHourDTO[];
}
