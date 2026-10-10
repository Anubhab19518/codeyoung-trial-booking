export interface CalendarEventPayload {
  title: string;
  description: string;
  location: string;
  startTimeUtc: Date;
  endTimeUtc: Date;
}

function formatUtcForCalendar(d: Date): string {
  return d
    .toISOString()
    .replace(/-|:|\.\d+/g, "");
}

/**
 * Generates a direct Google Calendar creation URL.
 */
export function generateGoogleCalendarUrl(event: CalendarEventPayload): string {
  const startStr = formatUtcForCalendar(event.startTimeUtc);
  const endStr = formatUtcForCalendar(event.endTimeUtc);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${startStr}/${endStr}`,
    details: event.description,
    location: event.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates and triggers a browser download of an .ics file.
 */
export function downloadIcsFile(event: CalendarEventPayload, filename = "codeyoung-trial-class.ics"): void {
  const startStr = formatUtcForCalendar(event.startTimeUtc);
  const endStr = formatUtcForCalendar(event.endTimeUtc);
  const nowStr = formatUtcForCalendar(new Date());

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Codeyoung//Trial Class Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:codeyoung-${Date.now()}@codeyoung.com`,
    `DTSTAMP:${nowStr}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description.replace(/\n/g, "\\n")}`,
    `LOCATION:${event.location}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
