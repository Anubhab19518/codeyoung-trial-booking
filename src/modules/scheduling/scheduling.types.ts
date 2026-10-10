export interface AvailableSlotDTO {
  slotDate: string;        // "YYYY-MM-DD"
  slotStartTime: string;   // "HH:mm" (24h)
  slotEndTime: string;     // "HH:mm" (24h)
  parentLocalStart: string;// ISO string
  parentLocalEnd: string;  // ISO string
  utcStart: string;        // ISO string
  utcEnd: string;          // ISO string
  availableMentorCount: number;
}

export interface GetAvailableSlotsParams {
  date: string;            // "YYYY-MM-DD"
  timezone: string;        // IANA timezone
  durationMinutes?: number;// default 45
}
