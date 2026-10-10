"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
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
  ChevronLeft,
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
  ShieldCheck,
  Star,
  Zap,
  HelpCircle,
  Laptop,
  Code2,
  Compass,
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
  const bookingRef = useRef<HTMLDivElement>(null);

  // Stepper State: 1 = Timezone, 2 = Day & Time, 3 = Student Info, 4 = Confirmation
  const [activeStep, setActiveStep] = useState<number>(1);

  // Timezone State
  const [selectedTimezone, setSelectedTimezone] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detected) {
          return detected === "Asia/Calcutta" ? "Asia/Kolkata" : detected;
        }
      } catch {
        // Fallback to default
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
  const [notifyReminder, setNotifyReminder] = useState(true);

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

  // Helper to format 24h to 12h
  const formatTimeDisplay = (time24: string) => {
    if (timeFormat === "24h") return time24;
    const [hStr, mStr] = time24.split(":");
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${mStr} ${ampm}`;
  };

  // Fetch available slots from server
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
        setActiveStep(4);
        fetchNotifications(json.data.id);
      } else if (res.status === 409 || res.status === 422) {
        setBookingError(
          json.error?.message ||
            "This slot was just booked by another parent or mentor capacity was reached. Slots refreshed."
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

  const scrollToBooking = () => {
    bookingRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Generate 7 days for the column view
  const calendarColumns = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i + 1);
      const dateStr = d.toISOString().split("T")[0];
      const dayName = i === 0 ? "TODAY" : d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
      const dateFormatted = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
      return { dateStr, dayName, dateFormatted };
    });
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Clean White Top Navbar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-1.5 cursor-pointer">
              <span className="text-xl font-extrabold tracking-tight text-slate-900">CODEYOUNG</span>
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block mb-1" />
            </div>
            <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
              <a href="#curriculum" className="hover:text-blue-600 transition-colors">Curriculum</a>
              <a href="#mentors" className="hover:text-blue-600 transition-colors">Mentors</a>
              <a href="#why-us" className="hover:text-blue-600 transition-colors">Why Codeyoung</a>
              <a href="#reviews" className="hover:text-blue-600 transition-colors">Reviews</a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs bg-blue-50 border border-blue-200/60 text-blue-700 px-3 py-1.5 rounded-full flex items-center gap-2 font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span>10 Mentors Live</span>
            </div>
            <button
              type="button"
              onClick={scrollToBooking}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              Book Free Trial
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section with Natural Intensity Background Image */}
      <section className="relative w-full overflow-hidden bg-slate-900 min-h-[560px] lg:min-h-[600px] flex items-center">
        {/* Full Hero Photo at Natural Visual Intensity */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero-coding-illustration.jpg"
            alt="Codeyoung 1:1 STEM and Coding Mentorship"
            fill
            priority
            sizes="100vw"
            className="object-cover object-right md:object-center"
          />
        </div>

        {/* Hero Content Card - Crisp, High Readability Dark Navy Text */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 w-full">
          <div className="max-w-xl bg-white/95 backdrop-blur-md rounded-3xl p-7 sm:p-9 shadow-2xl border border-white/80 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>1:1 Live STEM Mentorship • Ages 5–17</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
              Where Young Minds Learn to Code, Build, &amp; Lead.
            </h1>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Personalized 1:1 coding and STEM trial sessions led by top certified mentors across global timezones. Pick a time that suits your family and experience live project-based learning.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={scrollToBooking}
                className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <span>Book a Free Trial Class</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <a
                href="#why-us"
                className="px-5 py-3.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold text-sm rounded-xl transition-colors"
              >
                Explore Tracks
              </a>
            </div>

            {/* 3 Trust Indicators */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
                  <strong className="text-slate-900 font-bold text-[11px] sm:text-xs">4.9/5 Rating</strong>
                </div>
                <p className="text-slate-500 text-[10px] sm:text-[11px]">10k+ parents</p>
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <strong className="text-slate-900 font-bold text-[11px] sm:text-xs">Top 1% Mentors</strong>
                </div>
                <p className="text-slate-500 text-[10px] sm:text-[11px]">Max 2 classes/day</p>
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <strong className="text-slate-900 font-bold text-[11px] sm:text-xs">1:1 Live Trial</strong>
                </div>
                <p className="text-slate-500 text-[10px] sm:text-[11px]">Instant room link</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Interactive Booking Application (Faithful to Reference UI) */}
      <section ref={bookingRef} className="py-14 px-4 sm:px-6 max-w-6xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1">
            Seamless Reservation System
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Schedule Your Child&apos;s Trial Session
          </h2>
          <p className="text-slate-600 text-sm mt-1.5">
            Select your local timezone, pick an available slot, and enter student details to generate your verified room.
          </p>
        </div>

        {/* Master Card (Reference UI Layout) */}
        <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl shadow-slate-100 overflow-hidden text-slate-900 grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
          
          {/* Left Column: Brand & Vertical Stepper */}
          <aside className="lg:col-span-3 bg-slate-50/70 border-b lg:border-b-0 lg:border-r border-slate-200/80 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              {/* Brand Header */}
              <div className="flex items-center gap-1.5 mb-8">
                <span className="text-2xl font-black tracking-tight text-slate-900">CODEYOUNG</span>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block mb-1" />
              </div>

              {/* Stepper Navigation */}
              <nav className="space-y-6 relative">
                {/* Vertical connecting line */}
                <div className="absolute left-[17px] top-4 bottom-4 w-0.5 bg-slate-200 -z-0" />

                {/* Step 1: Timezone */}
                <div
                  onClick={() => {
                    if (activeStep > 1 && !confirmedBooking) setActiveStep(1);
                  }}
                  className={`flex items-center gap-3 relative z-10 cursor-pointer transition-all ${
                    activeStep === 1 ? "opacity-100" : "opacity-75 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      activeStep === 1
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-4 ring-blue-100"
                        : activeStep > 1
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-slate-500 border border-slate-300"
                    }`}
                  >
                    {activeStep > 1 ? <Check className="w-4 h-4" /> : "1"}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block leading-tight">Timezone</span>
                    <span className="text-[10px] text-slate-500">Region &amp; Clock</span>
                  </div>
                </div>

                {/* Step 2: Day and time */}
                <div
                  onClick={() => {
                    if (!confirmedBooking) setActiveStep(2);
                  }}
                  className={`flex items-center gap-3 relative z-10 cursor-pointer transition-all ${
                    activeStep === 2 ? "opacity-100" : "opacity-75 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      activeStep === 2
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-4 ring-blue-100"
                        : activeStep > 2
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-slate-500 border border-slate-300"
                    }`}
                  >
                    {activeStep > 2 ? <Check className="w-4 h-4" /> : "2"}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block leading-tight">Day &amp; Time</span>
                    <span className="text-[10px] text-slate-500">Available Slots</span>
                  </div>
                </div>

                {/* Step 3: Student Details */}
                <div
                  onClick={() => {
                    if (selectedSlot && !confirmedBooking) setActiveStep(3);
                  }}
                  className={`flex items-center gap-3 relative z-10 cursor-pointer transition-all ${
                    activeStep === 3 ? "opacity-100" : "opacity-75 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      activeStep === 3
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-4 ring-blue-100"
                        : activeStep > 3
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-slate-500 border border-slate-300"
                    }`}
                  >
                    {activeStep > 3 ? <Check className="w-4 h-4" /> : "3"}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block leading-tight">Student Info</span>
                    <span className="text-[10px] text-slate-500">Grade &amp; Topic</span>
                  </div>
                </div>

                {/* Step 4: Confirmation */}
                <div
                  className={`flex items-center gap-3 relative z-10 transition-all ${
                    activeStep === 4 ? "opacity-100" : "opacity-60"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      activeStep === 4
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 ring-4 ring-emerald-100"
                        : "bg-white text-slate-500 border border-slate-300"
                    }`}
                  >
                    4
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block leading-tight">Confirmation</span>
                    <span className="text-[10px] text-slate-500">Meeting Room URL</span>
                  </div>
                </div>
              </nav>
            </div>

            {/* Bottom Status Help */}
            <div className="pt-6 border-t border-slate-200 text-xs text-slate-500 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span>Questions? 24/7 Academic Support</span>
            </div>
          </aside>

          {/* Right Column: Step Views */}
          <section className="lg:col-span-9 p-6 sm:p-8 flex flex-col justify-between">
            
            {/* STEP 1: Timezone Selection */}
            {activeStep === 1 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h2 className="text-xl font-extrabold text-slate-900">Select Your Local Timezone</h2>
                  <span className="text-xs font-semibold text-slate-500">step 1 from 4</span>
                </div>

                {/* Quick Preset Buttons */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Popular Regions</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {POPULAR_TIMEZONES.map((tz) => (
                      <button
                        key={tz.value}
                        type="button"
                        onClick={() => setSelectedTimezone(tz.value)}
                        className={`px-3 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                          selectedTimezone === tz.value
                            ? "bg-blue-50 border-blue-600 text-blue-700 font-bold"
                            : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <span>{tz.flag}</span>
                        <span className="truncate">{tz.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Searchable Input */}
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-700 mb-2">Or Search Any Global City / Zone</label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Type timezone name, e.g. London, New York, Sydney, Dubai, Paris..."
                      value={tzSearchQuery}
                      onChange={(e) => {
                        setTzSearchQuery(e.target.value);
                        setShowTzDropdown(true);
                      }}
                      onFocus={() => setShowTzDropdown(true)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                    />
                  </div>

                  {showTzDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-30 max-h-56 overflow-y-auto p-1 text-xs">
                      {filteredTimezones.map((tz) => (
                        <button
                          key={tz.value}
                          type="button"
                          onClick={() => {
                            setSelectedTimezone(tz.value);
                            setShowTzDropdown(false);
                            setTzSearchQuery("");
                          }}
                          className={`w-full text-left px-3.5 py-2.5 rounded-lg flex items-center justify-between hover:bg-blue-50 transition-all ${
                            selectedTimezone === tz.value ? "bg-blue-50 text-blue-800 font-bold" : "text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{tz.flag}</span>
                            <span>{tz.label}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({tz.value})</span>
                          </div>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{tz.region}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <span className="text-slate-600 font-medium">Selected Zone:</span>
                    <code className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">{selectedTimezone}</code>
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold">✓ DST Aware</span>
                </div>
              </div>
            )}

            {/* STEP 2: Day & Time (Faithful to Reference Design) */}
            {activeStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">Select Date and Time</h2>
                    <span className="text-xs text-slate-500">Times displayed in {selectedTimezone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-100 p-0.5 rounded-lg flex text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setTimeFormat("12h")}
                        className={`px-2.5 py-1 rounded-md transition-all ${
                          timeFormat === "12h" ? "bg-white text-blue-700 shadow-xs" : "text-slate-500"
                        }`}
                      >
                        12h
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimeFormat("24h")}
                        className={`px-2.5 py-1 rounded-md transition-all ${
                          timeFormat === "24h" ? "bg-white text-blue-700 shadow-xs" : "text-slate-500"
                        }`}
                      >
                        24h
                      </button>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">step 2 from 4</span>
                  </div>
                </div>

                {/* Date Columns Strip */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {calendarColumns.map((col) => {
                    const isSelected = selectedDate === col.dateStr;
                    return (
                      <button
                        key={col.dateStr}
                        type="button"
                        onClick={() => setSelectedDate(col.dateStr)}
                        className={`flex-1 min-w-[96px] py-2.5 px-2 rounded-xl text-center transition-all ${
                          isSelected
                            ? "bg-blue-600 text-white shadow-sm font-bold"
                            : "hover:bg-slate-200/60 text-slate-700 bg-slate-100/70"
                        }`}
                      >
                        <span className={`text-[10px] font-bold block ${isSelected ? "text-blue-100" : "text-slate-500"}`}>
                          {col.dayName}
                        </span>
                        <span className="text-xs font-extrabold mt-0.5 block">{col.dateFormatted}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Slot Selection Grid */}
                <div className="min-h-[220px]">
                  {loadingSlots ? (
                    <div className="py-14 flex flex-col items-center justify-center text-slate-400 gap-2">
                      <RefreshCw className="w-7 h-7 animate-spin text-blue-600" />
                      <span className="text-xs font-bold text-slate-600">Calculating mentor schedules &amp; DST offsets...</span>
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
                      <AlertCircle className="w-7 h-7 text-amber-500 mx-auto mb-2" />
                      <h3 className="text-sm font-bold text-slate-800">No Mentors Available for this Date</h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        All mentors are fully booked for their 2-class daily quota or off schedule. Please select another date above.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                      {slots.map((slot) => {
                        const isSelected =
                          selectedSlot?.slotStartTime === slot.slotStartTime &&
                          selectedSlot?.slotDate === slot.slotDate;

                        return (
                          <button
                            key={slot.slotStartTime}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`py-3 px-3 rounded-xl font-bold text-xs transition-all flex flex-col items-center justify-center cursor-pointer ${
                              isSelected
                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 scale-[1.02]"
                                : "bg-white hover:bg-blue-50/40 text-slate-800 border border-slate-200 shadow-2xs hover:border-blue-300"
                            }`}
                          >
                            <span className="text-sm">{formatTimeDisplay(slot.slotStartTime)}</span>
                            <span className={`text-[10px] font-medium mt-0.5 ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                              {slot.availableMentorCount} mentor{slot.availableMentorCount > 1 ? "s" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Selected Slot Footer Indicator & Reminder */}
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">Date: <strong className="text-slate-900">{selectedDate}</strong></span>
                      <span className="text-slate-500">
                        Time: <strong className="text-slate-900">{selectedSlot ? formatTimeDisplay(selectedSlot.slotStartTime) : "None selected"}</strong>
                      </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-600 text-[11px] pt-1">
                      <input
                        type="checkbox"
                        checked={notifyReminder}
                        onChange={(e) => setNotifyReminder(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Notify me with email reminder 1 day in advance</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Student Details */}
            {activeStep === 3 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h2 className="text-xl font-extrabold text-slate-900">Student &amp; Parent Details</h2>
                  <span className="text-xs font-semibold text-slate-500">step 3 from 4</span>
                </div>

                {/* Selected Slot Summary Header */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 font-medium block">Selected Slot:</span>
                    <strong className="text-slate-900 font-bold text-sm">
                      {selectedSlot?.slotDate} at {selectedSlot && formatTimeDisplay(selectedSlot.slotStartTime)} – {selectedSlot && formatTimeDisplay(selectedSlot.slotEndTime)}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 font-medium block">Timezone:</span>
                    <span className="font-mono text-blue-700 font-bold">{selectedTimezone}</span>
                  </div>
                </div>

                {bookingError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{bookingError}</span>
                  </div>
                )}

                <form id="booking-form" onSubmit={handleBookingSubmit} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Parent Full Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Sarah Jenkins"
                        value={parentName}
                        onChange={(e) => {
                          setParentName(e.target.value);
                          if (fieldErrors.parentName) setFieldErrors({ ...fieldErrors, parentName: "" });
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 bg-white ${
                          fieldErrors.parentName ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-600"
                        }`}
                      />
                      {fieldErrors.parentName && <span className="text-[10px] text-red-600 mt-0.5 block">{fieldErrors.parentName}</span>}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Parent Email *</label>
                      <input
                        type="email"
                        placeholder="e.g. sarah.jenkins@example.com"
                        value={parentEmail}
                        onChange={(e) => {
                          setParentEmail(e.target.value);
                          if (fieldErrors.parentEmail) setFieldErrors({ ...fieldErrors, parentEmail: "" });
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 bg-white ${
                          fieldErrors.parentEmail ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-600"
                        }`}
                      />
                      {fieldErrors.parentEmail && <span className="text-[10px] text-red-600 mt-0.5 block">{fieldErrors.parentEmail}</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Student Full Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Leo Jenkins"
                        value={studentName}
                        onChange={(e) => {
                          setStudentName(e.target.value);
                          if (fieldErrors.studentName) setFieldErrors({ ...fieldErrors, studentName: "" });
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 bg-white ${
                          fieldErrors.studentName ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-600"
                        }`}
                      />
                      {fieldErrors.studentName && <span className="text-[10px] text-red-600 mt-0.5 block">{fieldErrors.studentName}</span>}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Student Grade</label>
                      <select
                        value={studentGrade}
                        onChange={(e) => setStudentGrade(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                      >
                        {GRADE_LEVELS.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Learning Track / Topic of Interest</label>
                    <select
                      value={learningInterest}
                      onChange={(e) => setLearningInterest(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                    >
                      {LEARNING_INTERESTS.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 4: Confirmation (Faithful Card Style) */}
            {activeStep === 4 && confirmedBooking && (
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900">Trial Class Confirmed!</h2>
                      <span className="text-xs text-emerald-600 font-bold">Mentor Automatically Assigned</span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">step 4 from 4</span>
                </div>

                {/* Details Breakdown */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-semibold">Assigned Mentor:</span>
                    <strong className="text-sm font-black text-slate-900 block mt-0.5">{confirmedBooking.mentorName}</strong>
                    <span className="text-slate-500">{confirmedBooking.mentorEmail}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Registered Student / Parent:</span>
                    <strong className="text-sm font-black text-slate-900 block mt-0.5">{confirmedBooking.parentName}</strong>
                    <span className="text-slate-500">{confirmedBooking.parentEmail}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-blue-700 font-bold block mb-0.5">Parent Time ({confirmedBooking.parentTimezone})</span>
                    <span className="font-extrabold text-slate-900 text-xs">{confirmedBooking.parentLocalStart} – {confirmedBooking.parentLocalEnd}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-700 font-bold block mb-0.5">Mentor Time ({confirmedBooking.mentorTimezone})</span>
                    <span className="font-extrabold text-slate-900 text-xs">{confirmedBooking.mentorLocalStart} – {confirmedBooking.mentorLocalEnd}</span>
                  </div>
                </div>

                {/* Meeting Link Banner */}
                <div className="bg-blue-50/60 border border-blue-200/80 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                      <Video className="w-4 h-4" />
                    </div>
                    <div>
                      <strong className="font-bold text-slate-900 block">Classroom Link</strong>
                      <span className="font-mono text-[11px] text-slate-600 break-all">{confirmedBooking.meetingLink}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg flex items-center gap-1.5 transition-all text-xs"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? "Copied" : "Copy"}</span>
                    </button>
                    <a
                      href={confirmedBooking.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs whitespace-nowrap text-xs transition-colors"
                    >
                      <span>Enter</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Calendar Add Links */}
                <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                  <span className="text-slate-500 font-bold flex items-center gap-1">
                    <CalendarPlus className="w-3.5 h-3.5 text-blue-600" />
                    Add:
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
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-md flex items-center gap-1 transition-all"
                  >
                    <Calendar className="w-3 h-3 text-red-500" />
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
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-md flex items-center gap-1 transition-all"
                  >
                    <Download className="w-3 h-3 text-blue-600" />
                    <span>Apple / Outlook (.ics)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Stepper Action Bar (Reference UI Layout) */}
            <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <HelpCircle className="w-4 h-4 text-slate-400" />
                <button
                  type="button"
                  onClick={() => alert("Need help? Call our support desk at +1 (800) 555-CODE or email support@codeyoung.com")}
                  className="hover:underline"
                >
                  Help
                </button>
              </div>

              <div className="flex items-center gap-3">
                {activeStep > 1 && activeStep < 4 && (
                  <button
                    type="button"
                    onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
                    className="px-5 py-3 text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                )}

                {activeStep === 1 && (
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    <span>Next step</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                {activeStep === 2 && (
                  <button
                    type="button"
                    disabled={!selectedSlot}
                    onClick={() => {
                      if (selectedSlot) setActiveStep(3);
                    }}
                    className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-40 cursor-pointer"
                  >
                    <span>Next step</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                {activeStep === 3 && (
                  <button
                    type="submit"
                    form="booking-form"
                    disabled={isSubmitting}
                    className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Matching Mentor...</span>
                      </>
                    ) : (
                      <>
                        <span>Confirm Booking</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}

                {activeStep === 4 && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmedBooking(null);
                      setActiveStep(1);
                      setParentName("");
                      setParentEmail("");
                      setStudentName("");
                      setSelectedSlot(null);
                    }}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
                  >
                    Book Another Class
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </section>

      {/* Bento Section: Why Parents Choose Codeyoung */}
      <section id="why-us" className="py-16 sm:py-20 px-4 sm:px-6 max-w-6xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1">
            Proven STEM Excellence
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Why Parents Choose Codeyoung
          </h2>
          <p className="text-slate-600 text-sm mt-1.5">
            Designed for real learning outcomes with individualized attention and globally trusted infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Bento Card 1 */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-5">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Zero Timezone Confusion</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              Automated IANA timezone conversions and DST transition handling prevent double-bookings and mismatched appointment times.
            </p>
          </div>

          {/* Bento Card 2 */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Top 1% Global Mentors</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              Every mentor is strictly capped at a maximum of 2 demo classes per day to guarantee energetic, attentive, and high-quality instruction.
            </p>
          </div>

          {/* Bento Card 3 */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-5">
              <Code2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Hands-On Projects</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              Students build actual games, AI models, mobile apps, and animations from their very first 45-minute demo session.
            </p>
          </div>

          {/* Bento Card 4 */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-5">
              <Video className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Instant Dedicated Room</h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              Unique, collision-free meeting rooms and transactional email notifications for parent and mentor guarantee seamless attendance.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white py-10 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-slate-900">CODEYOUNG</span>
            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block mb-0.5" />
            <span className="text-slate-400 ml-2">© {new Date().getFullYear()} Codeyoung. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-slate-500">
            <a href="#privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</a>
            <a href="#terms" className="hover:text-blue-600 transition-colors">Terms of Service</a>
            <a href="#support" className="hover:text-blue-600 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
