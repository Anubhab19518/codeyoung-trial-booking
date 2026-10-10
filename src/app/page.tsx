"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
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
  Search,
  BookOpen,
  GraduationCap,
  Download,
  CalendarPlus,
  Copy,
  Check,
} from "lucide-react";
import { POPULAR_TIMEZONES, ALL_TIMEZONES } from "@/shared/time/timezone-options";
import { generateGoogleCalendarUrl, downloadIcsFile } from "@/shared/calendar/calendar-export";

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
  startTimeUtc: string;
  endTimeUtc: string;
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

const GRADE_LEVELS = [
  "Grade 1 - 2 (Ages 6-7)",
  "Grade 3 - 5 (Ages 8-10)",
  "Grade 6 - 8 (Ages 11-13)",
  "Grade 9 - 10 (Ages 14-15)",
  "Grade 11 - 12 (Ages 16-18)",
];

const LEARNING_INTERESTS = [
  "Visual Coding & Scratch (Beginners)",
  "Python & App Development",
  "AI, Machine Learning & Robotics",
  "Roblox & 3D Game Design",
  "Full-Stack Web Development",
  "Creative Problem Solving & Math",
];

export default function BookingPage() {
  const [, startTransition] = useTransition();

  // Timezone State
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
  const [tzSearchQuery, setTzSearchQuery] = useState("");
  const [showTzDropdown, setShowTzDropdown] = useState(false);

  // Date State
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });

  // Time Format Preference (12h vs 24h)
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");

  // Slots State
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);

  // Form Fields State
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentGrade, setStudentGrade] = useState(GRADE_LEVELS[1]);
  const [learningInterest, setLearningInterest] = useState(LEARNING_INTERESTS[0]);

  // Form Validation & Submission State
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Success Confirmation State
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(null);
  const [notifications, setNotifications] = useState<OutboxNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Filtered Timezones
  const filteredTimezones = useMemo(() => {
    if (!tzSearchQuery.trim()) return ALL_TIMEZONES;
    const q = tzSearchQuery.toLowerCase();
    return ALL_TIMEZONES.filter(
      (tz) =>
        tz.label.toLowerCase().includes(q) ||
        tz.value.toLowerCase().includes(q) ||
        tz.region.toLowerCase().includes(q)
    );
  }, [tzSearchQuery]);

  // Helper to convert HH:mm to 12h format
  const formatTimeDisplay = (time24: string) => {
    if (timeFormat === "24h") return time24;
    const [hStr, mStr] = time24.split(":");
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${mStr} ${ampm}`;
  };

  // Fetch available slots on date or timezone change
  useEffect(() => {
    let ignore = false;

    async function loadSlots() {
      if (!selectedDate || !selectedTimezone) return;
      setLoadingSlots(true);
      setSelectedSlot(null);
      setBookingError(null);

      try {
        const res = await fetch(
          `/api/slots?date=${selectedDate}&timezone=${encodeURIComponent(selectedTimezone)}&durationMinutes=45`
        );
        const json = await res.json();
        if (!ignore) {
          if (json.success) {
            setSlots(json.data.slots);
          } else {
            setSlots([]);
            setBookingError(json.error?.message || "Failed to load slots");
          }
        }
      } catch {
        if (!ignore) {
          setSlots([]);
          setBookingError("Network error while loading available slots. Please try again.");
        }
      } finally {
        if (!ignore) {
          setLoadingSlots(false);
        }
      }
    }

    loadSlots();

    return () => {
      ignore = true;
    };
  }, [selectedDate, selectedTimezone]);

  const refreshSlots = () => {
    if (selectedDate && selectedTimezone) {
      setLoadingSlots(true);
      setSelectedSlot(null);
      setBookingError(null);
      fetch(
        `/api/slots?date=${selectedDate}&timezone=${encodeURIComponent(selectedTimezone)}&durationMinutes=45`
      )
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setSlots(json.data.slots);
          } else {
            setSlots([]);
            setBookingError(json.error?.message || "Failed to load slots");
          }
        })
        .catch(() => {
          setSlots([]);
          setBookingError("Network error while loading available slots.");
        })
        .finally(() => {
          setLoadingSlots(false);
        });
    }
  };


  // Client Validation
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!parentName.trim() || parentName.trim().length < 2) {
      errors.parentName = "Parent name must be at least 2 characters.";
    }
    if (!parentEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim())) {
      errors.parentEmail = "Please enter a valid email address.";
    }
    if (!studentName.trim() || studentName.trim().length < 2) {
      errors.studentName = "Student name must be at least 2 characters.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Booking Submit
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || isSubmitting) return;

    if (!validateForm()) return;

    setIsSubmitting(true);
    setBookingError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName: `${parentName.trim()} (Student: ${studentName.trim()} | ${studentGrade} | ${learningInterest})`,
          parentEmail: parentEmail.trim(),
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
      } else if (res.status === 409 || res.status === 422) {
        setBookingError(
          json.error?.message ||
            "This slot was just booked by another parent or mentor daily capacity was reached. We have refreshed the availability list for you."
        );
        refreshSlots();
      } else {

        setBookingError(json.error?.message || "Booking could not be confirmed. Please select another slot.");
      }
    } catch {
      setBookingError("A network error occurred while submitting your booking. Please try again.");
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

  const handleCopyLink = () => {
    if (!confirmedBooking) return;
    navigator.clipboard.writeText(confirmedBooking.meetingLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Generate next 14 selectable dates
  const availableDates = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i + 1);
      const dateStr = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const monthName = d.toLocaleDateString("en-US", { month: "short" });
      const dayNum = d.getDate();
      return { dateStr, dayName, monthName, dayNum };
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
              CY
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-slate-900">Codeyoung</span>
                <span className="text-[10px] uppercase tracking-wider font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  1-on-1 Trial
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">Timezone-Aware Global Trial Booking Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>10 Dedicated Mentors Ready</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {!confirmedBooking ? (
          <div className="space-y-8">
            {/* Hero Header */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/20 backdrop-blur-xs px-2.5 py-1 rounded-full text-blue-50 mb-3">
                  <GraduationCap className="w-3.5 h-3.5" />
                  Free 45-Minute Live Interactive Trial Class
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Book Your Child&apos;s 1-on-1 Coding Trial Class
                </h1>
                <p className="mt-2 text-blue-100 text-sm sm:text-base leading-relaxed">
                  Select your local timezone and preferred date. Our system automatically matches an eligible mentor, guarantees conflict-free scheduling, and creates your personal classroom room.
                </p>
              </div>
            </div>

            {/* Step 1: Timezone Selection */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h2 className="text-base font-bold text-slate-900">Select Your Local Timezone</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Display Format:</span>
                  <div className="bg-slate-100 p-0.5 rounded-lg flex text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setTimeFormat("12h")}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        timeFormat === "12h" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      12 Hour (AM/PM)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeFormat("24h")}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        timeFormat === "24h" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      24 Hour
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Preset Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 mb-4">
                {POPULAR_TIMEZONES.slice(0, 5).map((tz) => (
                  <button
                    key={tz.value}
                    type="button"
                    onClick={() => {
                      setSelectedTimezone(tz.value);
                      setShowTzDropdown(false);
                    }}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                      selectedTimezone === tz.value
                        ? "bg-blue-50 border-blue-600 text-blue-700 font-semibold shadow-xs"
                        : "border-slate-200 text-slate-700 hover:border-slate-300 bg-slate-50/50"
                    }`}
                  >
                    <span>{tz.flag}</span>
                    <span className="truncate">{tz.label}</span>
                  </button>
                ))}
              </div>

              {/* Searchable Timezone Dropdown Selector */}
              <div className="relative">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search any global timezone (e.g. Sydney, Tokyo, Paris, Toronto, Dubai)..."
                      value={tzSearchQuery}
                      onChange={(e) => {
                        setTzSearchQuery(e.target.value);
                        setShowTzDropdown(true);
                      }}
                      onFocus={() => setShowTzDropdown(true)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                    />
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-blue-50/80 border border-blue-200 rounded-xl text-xs font-mono text-blue-800">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    <span className="truncate max-w-[180px]">{selectedTimezone}</span>
                  </div>
                </div>

                {showTzDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border border-slate-200 shadow-lg z-30 max-h-60 overflow-y-auto p-1 text-xs">
                    <div className="flex justify-between items-center p-2 border-b border-slate-100 text-[11px] font-semibold text-slate-500">
                      <span>Select IANA Timezone</span>
                      <button
                        type="button"
                        onClick={() => setShowTzDropdown(false)}
                        className="text-blue-600 hover:underline"
                      >
                        Close
                      </button>
                    </div>
                    {filteredTimezones.map((tz) => (
                      <button
                        key={tz.value}
                        type="button"
                        onClick={() => {
                          setSelectedTimezone(tz.value);
                          setShowTzDropdown(false);
                          setTzSearchQuery("");
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between hover:bg-blue-50 transition-all ${
                          selectedTimezone === tz.value ? "bg-blue-50/80 text-blue-700 font-semibold" : "text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span>{tz.flag}</span>
                          <span className="font-medium">{tz.label}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({tz.value})</span>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full ml-2">
                          {tz.region}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Step 2: Date Selector */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h2 className="text-base font-bold text-slate-900">Select Trial Class Date</h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Next 14 Days Available</span>
                </div>
              </div>

              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
                {availableDates.map((d) => {
                  const isSelected = selectedDate === d.dateStr;
                  return (
                    <button
                      key={d.dateStr}
                      type="button"
                      onClick={() => {
                        startTransition(() => {
                          setSelectedDate(d.dateStr);
                        });
                      }}
                      className={`flex-shrink-0 flex flex-col items-center justify-center w-20 py-3.5 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/20 font-bold"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                      }`}
                    >
                      <span className={`text-[11px] uppercase font-semibold ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                        {d.dayName}
                      </span>
                      <span className="text-xl font-extrabold my-0.5">{d.dayNum}</span>
                      <span className={`text-[10px] font-medium ${isSelected ? "text-blue-100" : "text-slate-500"}`}>
                        {d.monthName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Step 3: Available Slots Grid */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <h2 className="text-base font-bold text-slate-900">Select Available Slot (45 Mins)</h2>
                </div>
                {slots.length > 0 && (
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-bold">
                    {slots.length} Slots Open
                  </span>
                )}
              </div>

              {loadingSlots ? (
                <div className="py-14 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-7 h-7 animate-spin text-blue-600" />
                  <span className="text-sm font-semibold text-slate-600">
                    Calculating mentor availability and timezone shifts...
                  </span>
                </div>
              ) : slots.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-slate-800">No Slots Available for this Date</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    All mentors are either off duty or have met their maximum daily quota of 2 demo classes for this mentor-local calendar day. Please select another date.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                  {slots.map((slot) => {
                    const isSelected =
                      selectedSlot?.slotStartTime === slot.slotStartTime &&
                      selectedSlot?.slotDate === slot.slotDate;

                    return (
                      <button
                        key={slot.slotStartTime}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                          isSelected
                            ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20"
                            : "border-slate-200 hover:border-blue-300 bg-slate-50/60 text-slate-800 hover:bg-blue-50/40"
                        }`}
                      >
                        <span className="text-sm font-bold tracking-tight">
                          {formatTimeDisplay(slot.slotStartTime)}
                        </span>
                        <span
                          className={`text-[10px] mt-1 px-1.5 py-0.5 rounded-full font-medium ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-slate-200/70 text-slate-600"
                          }`}
                        >
                          {slot.availableMentorCount} mentor{slot.availableMentorCount > 1 ? "s" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Step 4: Parent & Student Details Form */}
            {selectedSlot && (
              <section className="bg-gradient-to-br from-blue-50/80 to-indigo-50/50 rounded-2xl border border-blue-200 p-6 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-blue-100">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    4
                  </div>
                  <h2 className="text-base font-bold text-slate-900">Student & Parent Details</h2>
                </div>

                {/* Selected Slot Summary Card */}
                <div className="bg-white p-4 rounded-xl border border-blue-200 mb-6 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm shadow-2xs">
                  <div>
                    <span className="text-slate-400 text-xs block font-medium">Selected Slot:</span>
                    <strong className="text-slate-900 font-extrabold text-base">
                      {selectedSlot.slotDate} at {formatTimeDisplay(selectedSlot.slotStartTime)} – {formatTimeDisplay(selectedSlot.slotEndTime)}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-xs block font-medium">Your Timezone:</span>
                    <span className="font-mono text-blue-700 font-semibold">{selectedTimezone}</span>
                  </div>
                </div>

                {bookingError && (
                  <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
                    <span>{bookingError}</span>
                  </div>
                )}

                <form onSubmit={handleBookingSubmit} className="space-y-4 max-w-2xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Parent Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Sarah Jenkins"
                        value={parentName}
                        onChange={(e) => {
                          setParentName(e.target.value);
                          if (fieldErrors.parentName) setFieldErrors({ ...fieldErrors, parentName: "" });
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-2 bg-white ${
                          fieldErrors.parentName ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"
                        }`}
                      />
                      {fieldErrors.parentName && (
                        <span className="text-[11px] text-red-600 mt-1 block font-medium">{fieldErrors.parentName}</span>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Parent Email Address *
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. sarah.jenkins@example.com"
                        value={parentEmail}
                        onChange={(e) => {
                          setParentEmail(e.target.value);
                          if (fieldErrors.parentEmail) setFieldErrors({ ...fieldErrors, parentEmail: "" });
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-2 bg-white ${
                          fieldErrors.parentEmail ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"
                        }`}
                      />
                      {fieldErrors.parentEmail && (
                        <span className="text-[11px] text-red-600 mt-1 block font-medium">{fieldErrors.parentEmail}</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Student Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Leo Jenkins"
                        value={studentName}
                        onChange={(e) => {
                          setStudentName(e.target.value);
                          if (fieldErrors.studentName) setFieldErrors({ ...fieldErrors, studentName: "" });
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-2 bg-white ${
                          fieldErrors.studentName ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"
                        }`}
                      />
                      {fieldErrors.studentName && (
                        <span className="text-[11px] text-red-600 mt-1 block font-medium">{fieldErrors.studentName}</span>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Student Grade / Age
                      </label>
                      <select
                        value={studentGrade}
                        onChange={(e) => setStudentGrade(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {GRADE_LEVELS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Primary Learning Interest
                    </label>
                    <select
                      value={learningInterest}
                      onChange={(e) => setLearningInterest(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {LEARNING_INTERESTS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Matching Mentor & Locking Slot...</span>
                        </>
                      ) : (
                        <>
                          <span>Confirm Trial Class Booking</span>
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </section>
            )}
          </div>
        ) : (
          /* Confirmation View */
          <div className="space-y-6 max-w-3xl mx-auto animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl border border-emerald-200 p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-3.5 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0 shadow-2xs">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-xs uppercase font-extrabold text-emerald-600 tracking-wider">
                    Booking Confirmed &amp; Mentor Assigned
                  </span>
                  <h1 className="text-2xl font-black text-slate-900">Your Trial Class is Confirmed!</h1>
                </div>
              </div>

              {/* Mentor and Student Card */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                      Assigned Mentor
                    </span>
                    <strong className="text-base text-slate-900 font-extrabold block mt-0.5">
                      {confirmedBooking.mentorName}
                    </strong>
                    <span className="text-xs text-slate-500">{confirmedBooking.mentorEmail}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                      Parent / Student Details
                    </span>
                    <strong className="text-base text-slate-900 font-extrabold block mt-0.5">
                      {confirmedBooking.parentName}
                    </strong>
                    <span className="text-xs text-slate-500">{confirmedBooking.parentEmail}</span>
                  </div>
                </div>

                {/* Dual-Timezone Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-blue-700 block mb-1">
                      Parent Local Time ({confirmedBooking.parentTimezone})
                    </span>
                    <span className="text-sm font-extrabold text-slate-900">
                      {confirmedBooking.parentLocalStart} – {confirmedBooking.parentLocalEnd}
                    </span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-indigo-700 block mb-1">
                      Mentor Local Time ({confirmedBooking.mentorTimezone})
                    </span>
                    <span className="text-sm font-extrabold text-slate-900">
                      {confirmedBooking.mentorLocalStart} – {confirmedBooking.mentorLocalEnd}
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Classroom Meeting Link */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="text-sm font-extrabold text-slate-900 block">Classroom Link</strong>
                    <span className="text-xs font-mono text-slate-600 break-all">{confirmedBooking.meetingLink}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
                  </button>
                  <a
                    href={confirmedBooking.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                  >
                    <span>Enter Classroom</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Calendar Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-2 pb-4 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <CalendarPlus className="w-4 h-4 text-blue-600" />
                  Add to Calendar:
                </span>
                <a
                  href={generateGoogleCalendarUrl({
                    title: `Codeyoung Trial Class with ${confirmedBooking.mentorName}`,
                    description: `Codeyoung 1-on-1 Trial Class for ${confirmedBooking.parentName}.\n\nMeeting Link: ${confirmedBooking.meetingLink}`,
                    location: confirmedBooking.meetingLink,
                    startTimeUtc: new Date(confirmedBooking.startTimeUtc),
                    endTimeUtc: new Date(confirmedBooking.endTimeUtc),
                  })}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all"
                >
                  <Calendar className="w-3.5 h-3.5 text-red-500" />
                  <span>Google Calendar</span>
                </a>
                <button
                  type="button"
                  onClick={() =>
                    downloadIcsFile({
                      title: `Codeyoung Trial Class with ${confirmedBooking.mentorName}`,
                      description: `Codeyoung 1-on-1 Trial Class for ${confirmedBooking.parentName}.\n\nMeeting Link: ${confirmedBooking.meetingLink}`,
                      location: confirmedBooking.meetingLink,
                      startTimeUtc: new Date(confirmedBooking.startTimeUtc),
                      endTimeUtc: new Date(confirmedBooking.endTimeUtc),
                    })
                  }
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Apple / Outlook (.ics)</span>
                </button>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmedBooking(null);
                    setParentName("");
                    setParentEmail("");
                    setStudentName("");
                    setSelectedSlot(null);
                  }}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Book Another Trial Class
                </button>
              </div>
            </div>

            {/* Email Outbox Inspector */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <h2 className="text-base font-bold text-slate-900">Outbox Email Notification Preview</h2>
                </div>
                <span className="text-xs text-slate-500 font-medium">Transactional Outbox Pattern</span>
              </div>

              {loadingNotifications ? (
                <div className="text-center py-6 text-slate-400 text-xs font-medium">Loading email previews...</div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((n) => (
                    <div key={n.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] ${
                              n.recipientType === "PARENT"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {n.recipientType}
                          </span>
                          <span className="font-bold text-slate-800">{n.recipientEmail}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-600 bg-white px-2.5 py-0.5 rounded-md border border-slate-200 font-semibold">
                          {n.status}
                        </span>
                      </div>
                      <div className="font-semibold text-slate-900 mb-1">Subject: {n.subject}</div>
                      <div
                        className="bg-white p-3 rounded-lg border border-slate-200 text-slate-700 text-[11px] max-h-36 overflow-y-auto"
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
