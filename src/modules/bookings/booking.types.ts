export interface CreateBookingInput {
  parentName: string;
  parentEmail: string;
  parentTimezone: string; // IANA
  slotDate: string;       // "YYYY-MM-DD"
  slotStartTime: string;  // "HH:mm" (24h)
  slotDurationMinutes?: number; // default 45
}

export interface BookingDTO {
  id: string;
  mentorId: string;
  mentorName: string;
  mentorEmail: string;
  mentorTimezone: string;
  parentName: string;
  parentEmail: string;
  parentTimezone: string;
  startTimeUtc: Date;
  endTimeUtc: Date;
  parentLocalStart: string;
  parentLocalEnd: string;
  mentorLocalStart: string;
  mentorLocalEnd: string;
  mentorLocalDate: string;
  meetingLink: string;
  status: "CONFIRMED" | "CANCELLED";
  createdAt: Date;
}
