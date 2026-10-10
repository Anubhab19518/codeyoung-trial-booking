"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Globe,
  CheckCircle2,
  Video,
  User,
  Mail,
  AlertCircle,
  ChevronRight,
  Sparkles,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

interface SlotItem {
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
  parentLocalStart: string;
  parentLocalEnd: string;
  utcStart: string;
  utcEnd: string;
  availableMentorCount: number;
}

interface ConfirmedBooking {
  id: string;
  mentorId: string;
  mentorName: string;
  mentorEmail: string;
  mentorTimezone: string;
  parentName: string;
  parentEmail: string;
  parentTimezone: string;
  parentLocalStart: string;
  parentLocalEnd: string;
  mentorLocalStart: string;
  mentorLocalEnd: string;
  meetingLink: string;
  status: string;
}

interface OutboxNotification {
  id: string;
  recipientType: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  contentHtml: string;
  status: string;
  createdAt: string;
}

const POPULAR_TIMEZONES = [
  { label: "India (IST)", value: "Asia/Kolkata", flag: "🇮🇳" },
  { label: "US Eastern (EST/EDT)", value: "America/New_York", flag: "🇺🇸" },
  { label: "US Pacific (PST/PDT)", value: "America/Los_Angeles", flag: "🇺🇸" },
  { label: "UK (GMT/BST)", value: "Europe/London", flag: "🇬🇧" },
];

export default function BookingPage() {
  // State initialized lazily to avoid cascading renders
  const [selectedTimezone, setSelectedTimezone] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detected) return detected;
      } catch {
        // fallback
      }
    }
    return "Asia/Kolkata";
  });

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });

  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);

  // Form State
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Success Confirmation State
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(null);
  const [notifications, setNotifications] = useState<OutboxNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);


  // Fetch available slots whenever date or timezone changes
  useEffect(() => {
    if (!selectedDate || !selectedTimezone) return;

    async function fetchSlots() {
      setLoadingSlots(true);
      setSelectedSlot(null);
      setBookingError(null);

      try {
        const res = await fetch(
          `/api/slots?date=${selectedDate}&timezone=${encodeURIComponent(selectedTimezone)}&durationMinutes=45`
        );
        const json = await res.json();
        if (json.success) {
          setSlots(json.data.slots);
        } else {
          setSlots([]);
          setBookingError(json.error?.message || "Failed to load slots");
        }
      } catch (err) {
        setSlots([]);
        setBookingError("Network error while loading available slots");
      } finally {
        setLoadingSlots(false);
      }
    }

    fetchSlots();
  }, [selectedDate, selectedTimezone]);

  // Handle Booking Submission
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setIsSubmitting(true);
    setBookingError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName,
          parentEmail,
          parentTimezone: selectedTimezone,
          slotDate: selectedSlot.slotDate,
          slotStartTime: selectedSlot.slotStartTime,
          slotDurationMinutes: 45,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setConfirmedBooking(json.data);
        fetchNotifications(json.data.id);
      } else {
        setBookingError(json.error?.message || "Failed to complete booking. Please select another slot.");
      }
    } catch {
      setBookingError("Network error while submitting your reservation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchNotifications = async (bookingId: string) => {
    setLoadingNotifications(true);
    try {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      if (json.success) {
        const matching = json.data.filter((n: OutboxNotification & { bookingId: string }) => n.bookingId === bookingId);
        setNotifications(matching.length > 0 ? matching : json.data.slice(0, 4));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  // Generate next 10 selectable dates
  const availableDates = Array.from({ length: 10 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    const dateStr = d.toISOString().split("T")[0];
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    const monthName = d.toLocaleDateString("en-US", { month: "short" });
    const dayNum = d.getDate();
    return { dateStr, dayName, monthName, dayNum };
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              CY
            </div>
            <div>
              <span className="text-xl font-extrabold text-slate-900 tracking-tight">Codeyoung</span>
              <span className="ml-2 text-xs uppercase px-2 py-0.5 font-semibold bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                Live Trial Booking
              </span>
            </div>
          </div>
          <div className="text-xs text-slate-500 hidden sm:flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            10 Dedicated Global Mentors Active
          </div>
        </div>
      </header>

      {/* Main Booking Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {!confirmedBooking ? (
          <div className="space-y-8">
            {/* Header Hero */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white rounded-2xl p-6 sm:p-8 shadow-sm">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Schedule Your Child&apos;s 1-on-1 Trial Class
              </h1>
              <p className="mt-2 text-blue-100 max-w-2xl text-sm sm:text-base leading-relaxed">

                Choose your local timezone and preferred time. Our system automatically matches an eligible mentor, guarantees collision-free scheduling, and generates a dedicated classroom link.
              </p>
            </div>

            {/* Step 1: Timezone Selector */}
            <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-slate-900">1. Select Your Timezone</h2>
                </div>
                <span className="text-xs text-slate-500 font-medium">All slot times adapt dynamically</span>
              </div>

              {/* Quick Timezone Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                {POPULAR_TIMEZONES.map((tz) => (
                  <button
                    key={tz.value}
                    type="button"
                    onClick={() => setSelectedTimezone(tz.value)}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-xs sm:text-sm font-medium transition-all ${
                      selectedTimezone === tz.value
                        ? "bg-blue-50 border-blue-600 text-blue-700 shadow-sm"
                        : "border-slate-200 text-slate-700 hover:border-slate-300 bg-slate-50/50"
                    }`}
                  >
                    <span>{tz.flag}</span>
                    <span className="truncate">{tz.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-700">Active IANA Timezone:</span>
                <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-blue-700 font-mono">
                  {selectedTimezone}
                </code>
              </div>
            </section>

            {/* Step 2: Date Selector */}
            <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-slate-900">2. Select Date</h2>
              </div>

              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                {availableDates.map((d) => {
                  const isSelected = selectedDate === d.dateStr;
                  return (
                    <button
                      key={d.dateStr}
                      type="button"
                      onClick={() => setSelectedDate(d.dateStr)}
                      className={`flex-shrink-0 flex flex-col items-center justify-center w-20 py-3 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                      }`}
                    >
                      <span className={`text-xs uppercase font-medium ${isSelected ? "text-blue-100" : "text-slate-500"}`}>
                        {d.dayName}
                      </span>
                      <span className="text-xl font-bold mt-0.5">{d.dayNum}</span>
                      <span className={`text-[11px] ${isSelected ? "text-blue-100" : "text-slate-500"}`}>
                        {d.monthName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Step 3: Available Slots Grid */}
            <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-slate-900">3. Available Slots (45 Mins)</h2>
                </div>
                {slots.length > 0 && (
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold">
                    {slots.length} Slots Available
                  </span>
                )}
              </div>

              {loadingSlots ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="text-sm font-medium">Calculating mentor availability and timezone shifts...</span>
                </div>
              ) : slots.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 p-6">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <h3 className="text-sm font-semibold text-slate-800">No Slots Available for this Date</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    All mentors are either off-schedule or have met their 2-booking quota for this calendar day. Please select another date.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                  {slots.map((slot) => {
                    const isSelected =
                      selectedSlot?.slotStartTime === slot.slotStartTime &&
                      selectedSlot?.slotDate === slot.slotDate;

                    return (
                      <button
                        key={slot.slotStartTime}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-3 rounded-lg border text-center transition-all flex flex-col items-center justify-center ${
                          isSelected
                            ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                            : "border-slate-200 hover:border-blue-300 bg-slate-50/50 text-slate-800"
                        }`}
                      >
                        <span className="text-sm font-bold">{slot.slotStartTime}</span>
                        <span className={`text-[11px] mt-0.5 ${isSelected ? "text-blue-100" : "text-slate-500"}`}>
                          {slot.availableMentorCount} mentor{slot.availableMentorCount > 1 ? "s" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Step 4: Parent Confirmation Form (When Slot Selected) */}
            {selectedSlot && (
              <section className="bg-blue-50/70 rounded-xl border border-blue-200 p-6 shadow-sm transition-all animate-in fade-in">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-blue-700" />
                  <h2 className="text-lg font-semibold text-slate-900">4. Confirm Parent Information</h2>
                </div>

                <div className="bg-white p-4 rounded-lg border border-blue-200 mb-6 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm">
                  <div>
                    <span className="text-slate-500 block">Selected Slot:</span>
                    <strong className="text-slate-900 font-semibold text-base">
                      {selectedSlot.slotDate} at {selectedSlot.slotStartTime} – {selectedSlot.slotEndTime}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block">Timezone:</span>
                    <span className="font-mono text-blue-700 font-medium">{selectedTimezone}</span>
                  </div>
                </div>

                {bookingError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{bookingError}</span>
                  </div>
                )}

                <form onSubmit={handleBookingSubmit} className="space-y-4 max-w-xl">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Parent Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sarah Jenkins"
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Parent Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. sarah.jenkins@example.com"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Reserving Slot & Assigning Mentor...</span>
                      </>
                    ) : (
                      <>
                        <span>Confirm Trial Class Reservation</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </section>
            )}
          </div>
        ) : (
          /* Confirmation Screen */
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl border border-emerald-200 p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-xs uppercase font-bold text-emerald-600 tracking-wider">
                    Booking Confirmed
                  </span>
                  <h1 className="text-2xl font-bold text-slate-900">Your Trial Class is Scheduled!</h1>
                </div>
              </div>

              {/* Mentor and Session Card */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <span className="text-xs text-slate-500 block">Assigned Mentor</span>
                    <strong className="text-base text-slate-900 font-bold block mt-0.5">
                      {confirmedBooking.mentorName}
                    </strong>
                    <span className="text-xs text-slate-600">{confirmedBooking.mentorEmail}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Registered Student / Parent</span>
                    <strong className="text-base text-slate-900 font-bold block mt-0.5">
                      {confirmedBooking.parentName}
                    </strong>
                    <span className="text-xs text-slate-600">{confirmedBooking.parentEmail}</span>
                  </div>
                </div>

                {/* Timezone Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                    <span className="text-xs font-semibold text-blue-700 block mb-1">
                      Parent Local Time ({confirmedBooking.parentTimezone})
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {confirmedBooking.parentLocalStart} – {confirmedBooking.parentLocalEnd}
                    </span>
                  </div>
                  <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                    <span className="text-xs font-semibold text-indigo-700 block mb-1">
                      Mentor Local Time ({confirmedBooking.mentorTimezone})
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {confirmedBooking.mentorLocalStart} – {confirmedBooking.mentorLocalEnd}
                    </span>
                  </div>
                </div>
              </div>

              {/* Meeting Link Action */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Video className="w-8 h-8 text-blue-600 flex-shrink-0" />
                  <div>
                    <strong className="text-sm font-bold text-slate-900 block">Live Classroom Link</strong>
                    <span className="text-xs font-mono text-slate-600 break-all">{confirmedBooking.meetingLink}</span>
                  </div>
                </div>
                <a
                  href={confirmedBooking.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-lg flex items-center gap-2 shadow-sm whitespace-nowrap"
                >
                  <span>Enter Classroom</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmedBooking(null);
                    setParentName("");
                    setParentEmail("");
                    setSelectedSlot(null);
                  }}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Book Another Trial Class
                </button>
              </div>
            </div>

            {/* Email Outbox Inspector */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <h2 className="text-base font-bold text-slate-900">Outbox Email Notification Preview</h2>
                </div>
                <span className="text-xs text-slate-500 font-medium">Transactional Outbox Pattern</span>
              </div>

              {loadingNotifications ? (
                <div className="text-center py-6 text-slate-400 text-xs">Loading email previews...</div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((n) => (
                    <div key={n.id} className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/70 text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              n.recipientType === "PARENT"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {n.recipientType}
                          </span>
                          <span className="font-semibold text-slate-800">{n.recipientEmail}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {n.status}
                        </span>
                      </div>
                      <div className="font-medium text-slate-900 mb-1">Subject: {n.subject}</div>
                      <div
                        className="bg-white p-3 rounded border border-slate-200 text-slate-700 text-[11px] max-h-36 overflow-y-auto"
                        dangerouslySetInnerHTML={{ __html: n.contentHtml }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
