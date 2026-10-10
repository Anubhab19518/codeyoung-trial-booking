export interface TimezoneOption {
  label: string;
  value: string;
  region: string;
  flag: string;
}

export const POPULAR_TIMEZONES: TimezoneOption[] = [
  { label: "India (IST)", value: "Asia/Kolkata", region: "Asia", flag: "🇮🇳" },
  { label: "US Eastern (EST/EDT)", value: "America/New_York", region: "Americas", flag: "🇺🇸" },
  { label: "US Pacific (PST/PDT)", value: "America/Los_Angeles", region: "Americas", flag: "🇺🇸" },
  { label: "US Central (CST/CDT)", value: "America/Chicago", region: "Americas", flag: "🇺🇸" },
  { label: "UK (GMT/BST)", value: "Europe/London", region: "Europe", flag: "🇬🇧" },
  { label: "Europe Central (CET/CEST)", value: "Europe/Paris", region: "Europe", flag: "🇫🇷" },
  { label: "UAE (GST)", value: "Asia/Dubai", region: "Middle East", flag: "🇦🇪" },
  { label: "Singapore (SGT)", value: "Asia/Singapore", region: "Asia", flag: "🇸🇬" },
  { label: "Australia Eastern (AEST/AEDT)", value: "Australia/Sydney", region: "Oceania", flag: "🇦🇺" },
  { label: "Canada Eastern (EST/EDT)", value: "America/Toronto", region: "Americas", flag: "🇨🇦" },
];

export const ALL_TIMEZONES: TimezoneOption[] = [
  ...POPULAR_TIMEZONES,
  { label: "US Mountain (MST/MDT)", value: "America/Denver", region: "Americas", flag: "🇺🇸" },
  { label: "Japan (JST)", value: "Asia/Tokyo", region: "Asia", flag: "🇯🇵" },
  { label: "Hong Kong (HKT)", value: "Asia/Hong_Kong", region: "Asia", flag: "🇭🇰" },
  { label: "New Zealand (NZST/NZDT)", value: "Pacific/Auckland", region: "Oceania", flag: "🇳🇿" },
  { label: "Germany (CET/CEST)", value: "Europe/Berlin", region: "Europe", flag: "🇩🇪" },
  { label: "UTC (Coordinated Universal Time)", value: "UTC", region: "Global", flag: "🌐" },
];
