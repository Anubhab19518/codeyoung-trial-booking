"use client";

import { useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

const emptySubscribe = () => () => {};
import {
  Calendar,
  Clock,
  Globe,
  CheckCircle2,
  Video,
  User,
  Users,
  Mail,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
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
  ArrowRight,
  Rocket,
  X,
} from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { POPULAR_TIMEZONES, ALL_TIMEZONES } from "@/shared/time/timezone-options";
import { generateGoogleCalendarUrl, downloadIcsFile } from "@/shared/calendar/calendar-export";
import {
  handleBookingResponseError,
  handleBookingNetworkError,
  type BookingFailure,
} from "@/shared/errors/booking-error-handler";

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
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const tzTriggerRef = useRef<HTMLButtonElement>(null);
  const tzDropdownRef = useRef<HTMLDivElement>(null);
  const tzSearchInputRef = useRef<HTMLInputElement>(null);
  const [tzDropdownCoords, setTzDropdownCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    openUpward: boolean;
    maxHeight: number;
  }>({ left: 0, width: 0, openUpward: false, maxHeight: 380 });

  const updateTzDropdownPosition = useCallback(() => {
    if (!tzTriggerRef.current) return;
    const rect = tzTriggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const spaceBelow = viewportHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;

    const openUpward = spaceBelow < 340 && spaceAbove > spaceBelow;
    const availableHeight = openUpward ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(Math.max(availableHeight, 220), 440);

    let left = rect.left;
    let width = Math.max(rect.width, 320);

    if (left + width > viewportWidth - 12) {
      width = Math.min(width, viewportWidth - 24);
      left = Math.max(12, viewportWidth - width - 12);
    }
    if (left < 12) {
      left = 12;
      width = Math.min(width, viewportWidth - 24);
    }

    if (openUpward) {
      setTzDropdownCoords({
        bottom: viewportHeight - rect.top + 6,
        left,
        width,
        openUpward: true,
        maxHeight,
      });
    } else {
      setTzDropdownCoords({
        top: rect.bottom + 6,
        left,
        width,
        openUpward: false,
        maxHeight,
      });
    }
  }, []);

  useEffect(() => {
    if (!showTzDropdown) return;
    updateTzDropdownPosition();

    const timer = setTimeout(() => {
      tzSearchInputRef.current?.focus();
    }, 50);

    const handleScrollOrResize = () => {
      updateTzDropdownPosition();
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        tzDropdownRef.current &&
        !tzDropdownRef.current.contains(target) &&
        tzTriggerRef.current &&
        !tzTriggerRef.current.contains(target)
      ) {
        setShowTzDropdown(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowTzDropdown(false);
        tzTriggerRef.current?.focus();
      }
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showTzDropdown, updateTzDropdownPosition]);

  // Date State
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });

  // Calendar View Month State (for interactive month calendar picker)
  const [viewDate, setViewDate] = useState<Date>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return new Date(tomorrow.getFullYear(), tomorrow.getMonth(), 1);
  });

  // Time Format Preference (12h vs 24h)
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");

  // Slot Period Filter ("all" | "morning" | "afternoon" | "evening")
  const [slotPeriodFilter, setSlotPeriodFilter] = useState<"all" | "morning" | "afternoon" | "evening">("all");

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
  const [bookingFailure, setBookingFailure] = useState<BookingFailure | null>(null);
  const [slotFetchError, setSlotFetchError] = useState<string | null>(null);

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

  // Month navigation helpers for the calendar picker
  const canGoPrevMonth = useMemo(() => {
    const now = new Date();
    return (
      viewDate.getFullYear() > now.getFullYear() ||
      viewDate.getMonth() > now.getMonth()
    );
  }, [viewDate]);

  const canGoNextMonth = useMemo(() => {
    const now = new Date();
    const maxDate = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    return viewDate < maxDate;
  }, [viewDate]);

  const handlePrevMonth = () => {
    if (canGoPrevMonth) {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    }
  };

  const handleNextMonth = () => {
    if (canGoNextMonth) {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    }
  };

  const monthName = useMemo(() => {
    return viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [viewDate]);

  // Calendar days grid calculation
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    const maxDateStr = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, "0")}-${String(maxDate.getDate()).padStart(2, "0")}`;

    const days = [];

    // Empty padding cells before first day
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        key: `pad-${i}`,
        dayNum: null,
        dateStr: "",
        isAvailable: false,
        isPast: true,
        isSelected: false,
        isToday: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isPast = dateStr < todayStr;
      const isTooFar = dateStr > maxDateStr;
      const isAvailable = !isPast && !isTooFar;
      const isSelected = dateStr === selectedDate;
      const isToday = dateStr === todayStr;

      days.push({
        key: dateStr,
        dayNum: day,
        dateStr,
        isAvailable,
        isPast,
        isSelected,
        isToday,
      });
    }

    return days;
  }, [viewDate, selectedDate]);

  // Friendly label & icon for selected timezone
  const selectedTzObj = useMemo(() => {
    return (
      POPULAR_TIMEZONES.find((t) => t.value === selectedTimezone) ||
      ALL_TIMEZONES.find((t) => t.value === selectedTimezone) || {
        value: selectedTimezone,
        label: selectedTimezone.replace(/_/g, " ").split("/").pop() || selectedTimezone,
        flag: "🌐",
        region: "Global",
      }
    );
  }, [selectedTimezone]);

  // Real local time in selected timezone (e.g. "1:37 PM")
  const currentTimeInZone = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: selectedTimezone,
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }).format(new Date());
    } catch {
      return "";
    }
  }, [selectedTimezone]);

  // Formatted date string for selected date header
  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return "";
    try {
      const [y, m, d] = selectedDate.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Filtered slots by period (morning / afternoon / evening / all)
  const filteredSlots = useMemo(() => {
    if (slotPeriodFilter === "all") return slots;
    return slots.filter((s) => {
      const hour = parseInt(s.slotStartTime.split(":")[0], 10);
      if (slotPeriodFilter === "morning") return hour < 12;
      if (slotPeriodFilter === "afternoon") return hour >= 12 && hour < 17;
      if (slotPeriodFilter === "evening") return hour >= 17;
      return true;
    });
  }, [slots, slotPeriodFilter]);

  // Fetch available slots from server
  useEffect(() => {
    let ignore = false;

    async function loadSlots() {
      if (!selectedDate || !selectedTimezone) return;
      setLoadingSlots(true);
      setSelectedSlot(null);
      setSlotFetchError(null);

      try {
        const res = await fetch(
          `/api/slots?date=${selectedDate}&timezone=${encodeURIComponent(selectedTimezone)}&durationMinutes=45`
        );
        const json = await res.json().catch(() => null);
        if (!ignore) {
          if (json?.success) {
            setSlots(json.data.slots);
          } else {
            setSlots([]);
            setSlotFetchError(json?.error?.message || "Failed to load slots");
          }
        }
      } catch {
        if (!ignore) {
          setSlots([]);
          setSlotFetchError("Network error while loading available slots. Please try again.");
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

  const refreshSlots = async () => {
    if (!selectedDate || !selectedTimezone) return;
    setLoadingSlots(true);
    setSlotFetchError(null);
    try {
      const res = await fetch(
        `/api/slots?date=${selectedDate}&timezone=${encodeURIComponent(selectedTimezone)}&durationMinutes=45`
      );
      const json = await res.json().catch(() => null);
      if (json?.success) {
        setSlots(json.data.slots);
      } else {
        setSlots([]);
        setSlotFetchError(json?.error?.message || "Failed to load slots");
      }
    } catch {
      setSlots([]);
      setSlotFetchError("Network error while refreshing available slots.");
    } finally {
      setLoadingSlots(false);
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
    if (isSubmitting) return;

    if (!selectedSlot) {
      setBookingFailure({
        type: "conflict",
        message: "This time slot is no longer available. Another parent may have booked it. Please select another time.",
        retryable: false,
      });
      return;
    }

    if (!validateForm()) {
      // Do not additionally show the generic red banner for expected field-validation failures
      setBookingFailure(null);
      return;
    }

    setIsSubmitting(true);
    setBookingFailure(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName: parentName.trim(),
          parentEmail: parentEmail.trim(),
          parentTimezone: selectedTimezone,
          slotDate: selectedSlot.slotDate,
          slotStartTime: selectedSlot.slotStartTime,
          slotDurationMinutes: 45,
        }),
      });

      const json = await res.json().catch(() => null);

      if (res.ok && json?.success) {
        setConfirmedBooking(json.data);
        setActiveStep(3);
        fetchNotifications(json.data.id);
      } else {
        const failure = handleBookingResponseError(res.status, json);
        if (failure.type === "conflict") {
          // Requirement 1: Clear slot selection, prompt to choose another time, and refresh availability
          setSelectedSlot(null);
          refreshSlots();
          setBookingFailure(failure);
        } else if (failure.type === "validation") {
          if (failure.fieldErrors && Object.keys(failure.fieldErrors).length > 0) {
            // Map each issue directly to the corresponding form field
            setFieldErrors((prev) => ({ ...prev, ...failure.fieldErrors }));
            // Do not additionally show the generic red banner for the same validation failure
            setBookingFailure(null);
          } else {
            // Show general banner only for non-field validation failures
            setBookingFailure(failure);
          }
        } else {
          setBookingFailure(failure);
        }
      }
    } catch {
      // Requirement 2: Handle Network errors
      setBookingFailure(handleBookingNetworkError());
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

  // Framer Motion Reduced Motion & Animation Variants
  const shouldReduceMotion = useReducedMotion();

  const heroContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
        delayChildren: shouldReduceMotion ? 0 : 0.04,
      },
    },
  };

  const heroItemVariants: Variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.05 : 0.45,
        ease: "easeOut",
      },
    },
  };

  const heroImageVariants: Variants = {
    hidden: { opacity: 0, scale: shouldReduceMotion ? 1 : 0.98 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: shouldReduceMotion ? 0.05 : 0.65,
        ease: "easeOut",
      },
    },
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Inset Floating Navbar with Top Breathing Room */}
      <header className="sticky top-3 sm:top-4 z-40 w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/90 backdrop-blur-md border border-slate-200/70 rounded-2xl shadow-xs shadow-slate-900/5 px-4 sm:px-6 lg:px-8 h-16 sm:h-17 flex items-center justify-between relative">
            {/* Left: Codeyoung logo with blue dot */}
            <div className="flex items-center gap-1.5 cursor-pointer">
              <span className="text-xl font-extrabold tracking-tight text-slate-900">CODEYOUNG</span>
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block mb-1" />
            </div>

            {/* Center: Navigation Links */}
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 absolute left-1/2 -translate-x-1/2">
              <a href="#curriculum" className="hover:text-blue-600 transition-colors">Curriculum</a>
              <a href="#mentors" className="hover:text-blue-600 transition-colors">Mentors</a>
              <a href="#why-us" className="hover:text-blue-600 transition-colors">Why Codeyoung</a>
              <a href="#reviews" className="hover:text-blue-600 transition-colors">Reviews</a>
            </nav>

            {/* Right: Booking CTA */}
            <div className="flex items-center">
              <motion.button
                type="button"
                onClick={scrollToBooking}
                whileHover={shouldReduceMotion ? {} : { scale: 1.02 }}
                whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                className="px-4.5 py-2 sm:px-5 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-md transition-colors shadow-xs cursor-pointer whitespace-nowrap"
              >
                Book Free Trial
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section matching Reference Design — Preserving Full Illustration */}
      <section className="relative w-full bg-white overflow-hidden pt-6 pb-12 sm:pt-8 sm:pb-16 lg:pt-10 lg:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center">
            
            {/* Left Column: Typography, Copy, CTAs & Benefits */}
            <motion.div
              variants={heroContainerVariants}
              initial="hidden"
              animate="visible"
              className="lg:col-span-5 xl:col-span-5 z-10 space-y-6"
            >
              {/* Eyebrow Kicker */}
              <motion.div variants={heroItemVariants} className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold tracking-wider text-blue-600 uppercase">
                  LIVE 1:1 CODING &amp; STEM CLASSES &nbsp;•&nbsp; AGES 5–17
                </span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                variants={heroItemVariants}
                className="text-4xl sm:text-5xl lg:text-[3.25rem] xl:text-[3.75rem] font-extrabold tracking-tight text-slate-900 leading-[1.08]"
              >
                Big ideas<br />
                <span className="text-blue-600">start here.</span>
              </motion.h1>

              {/* Supporting Copy */}
              <motion.p
                variants={heroItemVariants}
                className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-lg font-normal"
              >
                Personalized coding and STEM sessions with top mentors. Help your child build real skills, real projects, and real confidence.
              </motion.p>

              {/* CTAs */}
              <motion.div variants={heroItemVariants} className="flex flex-wrap items-center gap-3.5 pt-1">
                <motion.button
                  type="button"
                  onClick={scrollToBooking}
                  whileHover={shouldReduceMotion ? {} : { scale: 1.02 }}
                  whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                  className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-md transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>Book a Free Trial Class</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </motion.div>

              {/* Mini Learning Journey: From Curious to Creator */}
              <motion.div variants={heroItemVariants} className="space-y-3 pt-2 sm:pt-3">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.14em] uppercase text-blue-600">
                    From Curious to Creator
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-[11px] text-slate-500 font-medium">The 3-stage learning journey</span>
                </div>

                <div className="relative">
                  {/* Mobile Vertical Connecting Track */}
                  <div className="sm:hidden absolute left-[15px] top-4 bottom-4 w-px bg-blue-100" aria-hidden="true" />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-3 relative">
                    {/* Stage 1 */}
                    <div className="relative flex items-start gap-3 sm:flex-col sm:gap-2">
                      <div className="relative z-10 w-8 h-8 rounded-lg bg-blue-50/80 border border-blue-200/70 text-blue-600 flex items-center justify-center flex-shrink-0 shadow-2xs">
                        <Compass className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="hidden sm:block absolute left-8 top-4 right-[-12px] h-[1.5px] bg-gradient-to-r from-blue-200 via-blue-200 to-blue-200" aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <strong className="block text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                            Explore an idea
                          </strong>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed mt-0.5">
                          Start with curiosity, not memorisation.
                        </p>
                      </div>
                    </div>

                    {/* Stage 2 */}
                    <div className="relative flex items-start gap-3 sm:flex-col sm:gap-2">
                      <div className="relative z-10 w-8 h-8 rounded-lg bg-blue-50/80 border border-blue-200/70 text-blue-600 flex items-center justify-center flex-shrink-0 shadow-2xs">
                        <Code2 className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="hidden sm:block absolute left-8 top-4 right-[-12px] h-[1.5px] bg-gradient-to-r from-blue-200 via-blue-200 to-blue-200" aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <strong className="block text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                            Make it work
                          </strong>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed mt-0.5">
                          Turn ideas into code and experiments.
                        </p>
                      </div>
                    </div>

                    {/* Stage 3 */}
                    <div className="relative flex items-start gap-3 sm:flex-col sm:gap-2">
                      <div className="relative z-10 w-8 h-8 rounded-lg bg-blue-50/80 border border-blue-200/70 text-blue-600 flex items-center justify-center flex-shrink-0 shadow-2xs">
                        <Rocket className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <strong className="block text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                            Build something real
                          </strong>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed mt-0.5">
                          Create projects they can proudly show.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Right Column: Hero Illustration (col-span-12 lg:col-span-7 xl:col-span-7) — Full Uncropped Image */}
            <motion.div
              variants={heroImageVariants}
              initial="hidden"
              animate="visible"
              className="lg:col-span-7 xl:col-span-7 relative w-full flex items-center justify-center lg:justify-end"
            >
              <div className="relative w-full aspect-[1200/896] max-w-[640px] lg:max-w-none">
                <Image
                  src="/images/hero-coding-illustration.jpg"
                  alt="Codeyoung Student Learning to Code with 1:1 Robot Mentor"
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 58vw, 750px"
                  className="object-contain object-center lg:object-right"
                />
                {/* Subtle, soft edge fade strictly on the far-left edge that does not obscure any subjects */}
                <div className="hidden lg:block absolute inset-y-0 left-0 w-10 xl:w-14 bg-gradient-to-r from-white via-white/30 to-transparent pointer-events-none" />
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Main Interactive Booking Application (Guided 3-Stage Experience) */}
      <section ref={bookingRef} id="booking" className="py-16 sm:py-20 px-4 sm:px-6 max-w-6xl mx-auto w-full scroll-mt-16">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1.5">
            Live 1:1 Trial Session
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Schedule Your Child&apos;s Trial Session
          </h2>
          <p className="text-slate-600 text-sm mt-1.5 leading-relaxed">
            Select your local timezone, pick an available slot, and enter student details to generate your verified 1:1 room.
          </p>
        </div>

        {/* Master Booking Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-100/80 overflow-hidden text-slate-900 p-6 sm:p-8 lg:p-10 min-h-[580px]">
          
          {/* 3-Stage Progress Indicator */}
          <div className="border-b border-slate-100 pb-6 mb-8">
            <div className="grid grid-cols-3 gap-3 sm:gap-6 max-w-2xl mx-auto">
              {/* Stage 1: Choose a time */}
              <button
                type="button"
                onClick={() => {
                  if (activeStep > 1 && !confirmedBooking) setActiveStep(1);
                }}
                disabled={confirmedBooking !== null}
                className={`text-left group transition-all ${
                  activeStep === 1
                    ? "opacity-100"
                    : activeStep > 1
                    ? "opacity-90 hover:opacity-100 cursor-pointer"
                    : "opacity-50 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      activeStep === 1
                        ? "bg-blue-600 text-white shadow-xs"
                        : activeStep > 1
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {activeStep > 1 ? <Check className="w-3.5 h-3.5" /> : "1"}
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      activeStep === 1 ? "text-blue-600" : "text-slate-900"
                    }`}
                  >
                    Choose a time
                  </span>
                </div>
                <div
                  className={`h-1 w-full rounded-full transition-all ${
                    activeStep === 1 ? "bg-blue-600" : activeStep > 1 ? "bg-emerald-600" : "bg-slate-100"
                  }`}
                />
              </button>

              {/* Stage 2: Your details */}
              <button
                type="button"
                onClick={() => {
                  if (selectedSlot && !confirmedBooking) setActiveStep(2);
                }}
                disabled={!selectedSlot || confirmedBooking !== null}
                className={`text-left group transition-all ${
                  activeStep === 2
                    ? "opacity-100"
                    : activeStep > 2
                    ? "opacity-90 hover:opacity-100 cursor-pointer"
                    : selectedSlot
                    ? "opacity-75 hover:opacity-100 cursor-pointer"
                    : "opacity-40 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      activeStep === 2
                        ? "bg-blue-600 text-white shadow-xs"
                        : activeStep > 2
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {activeStep > 2 ? <Check className="w-3.5 h-3.5" /> : "2"}
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      activeStep === 2 ? "text-blue-600" : "text-slate-900"
                    }`}
                  >
                    Your details
                  </span>
                </div>
                <div
                  className={`h-1 w-full rounded-full transition-all ${
                    activeStep === 2 ? "bg-blue-600" : activeStep > 2 ? "bg-emerald-600" : "bg-slate-100"
                  }`}
                />
              </button>

              {/* Stage 3: Confirmation */}
              <div
                className={`text-left transition-all ${
                  activeStep === 3 ? "opacity-100" : "opacity-40"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      activeStep === 3
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {activeStep === 3 ? <Check className="w-3.5 h-3.5" /> : "3"}
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      activeStep === 3 ? "text-emerald-700" : "text-slate-900"
                    }`}
                  >
                    Confirmation
                  </span>
                </div>
                <div
                  className={`h-1 w-full rounded-full transition-all ${
                    activeStep === 3 ? "bg-emerald-600" : "bg-slate-100"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* STAGE 1: Choose a Time (Faithful to Reference Design in Image) */}
          {activeStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
              
              {/* Left Column: Calendar & Integrated Timezone Picker */}
              <div className="lg:col-span-6 space-y-6">
                <div>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                    Select a Date &amp; Time
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    45-minute live coding lesson with a dedicated mentor.
                  </p>
                </div>

                {/* Monthly Calendar Component */}
                <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 sm:p-5">
                  {/* Calendar Month Header with Prev/Next Controls */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      disabled={!canGoPrevMonth}
                      className="p-2 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-bold text-slate-900 text-sm sm:text-base">
                      {monthName}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      disabled={!canGoNextMonth}
                      className="p-2 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
                      aria-label="Next month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Weekday Labels (SUN, MON, TUE, WED, THU, FRI, SAT) */}
                  <div className="grid grid-cols-7 mb-2 text-center">
                    {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
                      <span key={day} className="text-[10px] sm:text-[11px] font-bold text-slate-400 tracking-wider">
                        {day}
                      </span>
                    ))}
                  </div>

                  {/* Month Day Grid */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                    {calendarDays.map((d) => {
                      if (!d.dayNum) {
                        return <div key={d.key} className="h-9 sm:h-10" />;
                      }

                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => {
                            if (d.isAvailable) setSelectedDate(d.dateStr);
                          }}
                          disabled={!d.isAvailable}
                          className={`h-9 sm:h-10 rounded-full text-xs font-semibold flex items-center justify-center transition-all relative ${
                            d.isSelected
                              ? "bg-blue-600 text-white font-bold shadow-sm scale-105 z-10"
                              : d.isAvailable
                              ? "bg-blue-50/70 text-blue-700 hover:bg-blue-100 hover:text-blue-800 cursor-pointer"
                              : "text-slate-300 cursor-not-allowed"
                          }`}
                        >
                          <span>{d.dayNum}</span>
                          {d.isToday && !d.isSelected && (
                            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Integrated Timezone Picker at Bottom of Calendar */}
                <div className="relative pt-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Time zone
                  </label>
                  <button
                    ref={tzTriggerRef}
                    type="button"
                    onClick={() => setShowTzDropdown(!showTzDropdown)}
                    aria-expanded={showTzDropdown}
                    aria-haspopup="dialog"
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="truncate">
                        {selectedTzObj.label} ({currentTimeInZone})
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                        showTzDropdown ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Portal-rendered Timezone Popover (Unclipped, Dynamic Direction, Stationary Search) */}
                  {showTzDropdown && isMounted && createPortal(
                    <div
                      ref={tzDropdownRef}
                      style={{
                        position: "fixed",
                        ...(tzDropdownCoords.openUpward
                          ? { bottom: tzDropdownCoords.bottom }
                          : { top: tzDropdownCoords.top }),
                        left: tzDropdownCoords.left,
                        width: tzDropdownCoords.width,
                        maxHeight: tzDropdownCoords.maxHeight,
                        zIndex: 9999,
                      }}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col text-xs overflow-hidden"
                    >
                      {/* Stationary Header Section: Popular Regions & Search Input */}
                      <div className="p-3 pb-2.5 space-y-2.5 bg-white border-b border-slate-100 shrink-0">
                        {/* Popular Quick Select */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Popular Regions
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {POPULAR_TIMEZONES.map((tz) => (
                              <button
                                key={tz.value}
                                type="button"
                                onClick={() => {
                                  setSelectedTimezone(tz.value);
                                  setShowTzDropdown(false);
                                  setTzSearchQuery("");
                                  tzTriggerRef.current?.focus();
                                }}
                                className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition-all text-left truncate cursor-pointer ${
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

                        {/* Search Bar */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Search Any Global Timezone
                          </span>
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              ref={tzSearchInputRef}
                              type="text"
                              placeholder="Type city or country, e.g. London, New York, Dubai..."
                              value={tzSearchQuery}
                              onChange={(e) => setTzSearchQuery(e.target.value)}
                              className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                            />
                            {tzSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setTzSearchQuery("")}
                                aria-label="Clear search"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Independently Scrollable Results List */}
                      <div className="flex-1 overflow-y-auto min-h-[90px] divide-y divide-slate-100 p-2 pr-1.5">
                        {filteredTimezones.length === 0 ? (
                          <div className="py-6 text-center text-slate-400 text-xs">
                            No matching timezones found
                          </div>
                        ) : (
                          filteredTimezones.slice(0, 50).map((tz) => (
                            <button
                              key={tz.value}
                              type="button"
                              onClick={() => {
                                setSelectedTimezone(tz.value);
                                setShowTzDropdown(false);
                                setTzSearchQuery("");
                                tzTriggerRef.current?.focus();
                              }}
                              className={`w-full text-left px-2.5 py-2 flex items-center justify-between hover:bg-blue-50/60 rounded-md transition-all cursor-pointer ${
                                selectedTimezone === tz.value ? "bg-blue-50 text-blue-800 font-bold" : "text-slate-700"
                              }`}
                            >
                              <span className="truncate">{tz.flag} {tz.label}</span>
                              <span className="text-[10px] text-slate-400 font-mono ml-2 shrink-0">{tz.value}</span>
                            </button>
                          ))
                        )}
                      </div>

                      {/* Stationary Footer */}
                      <div className="p-2.5 px-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
                        <span>Selected: <code className="font-bold text-slate-800">{selectedTimezone}</code></span>
                        <span className="text-emerald-600 font-bold">✓ DST Aware</span>
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              </div>

              {/* Right Column: Time Slot Selection (Faithful to Reference Image) */}
              <div className="lg:col-span-6 border-t lg:border-t-0 lg:border-l border-slate-200/80 pt-6 lg:pt-0 lg:pl-8 flex flex-col justify-between min-h-[480px]">
                <div className="space-y-4">
                  {/* Header: Selected Date & 12h/24h toggle */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h4 className="text-base sm:text-lg font-bold text-slate-900">
                        {formattedSelectedDate}
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        All times shown in your local timezone ({selectedTzObj.label})
                      </span>
                    </div>

                    {/* 12h / 24h Toggle */}
                    <div className="bg-slate-100 p-0.5 rounded-lg flex text-xs font-semibold shrink-0">
                      <button
                        type="button"
                        onClick={() => setTimeFormat("12h")}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          timeFormat === "12h" ? "bg-white text-blue-700 shadow-xs" : "text-slate-500"
                        }`}
                      >
                        12h
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimeFormat("24h")}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          timeFormat === "24h" ? "bg-white text-blue-700 shadow-xs" : "text-slate-500"
                        }`}
                      >
                        24h
                      </button>
                    </div>
                  </div>

                  {/* Slot Period Quick Filter Tabs */}
                  {slots.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Filter:</span>
                      {(["all", "morning", "afternoon", "evening"] as const).map((period) => (
                        <button
                          key={period}
                          type="button"
                          onClick={() => setSlotPeriodFilter(period)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                            slotPeriodFilter === period
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Conflict Notice if redirected or user returns */}
                  {bookingFailure?.type === "conflict" && (
                    <div
                      role="alert"
                      aria-live="polite"
                      className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-2.5 shadow-2xs"
                    >
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-amber-900">{bookingFailure.message}</p>
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          We&apos;ve refreshed available slots below. Please choose another time slot to continue.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBookingFailure(null)}
                        aria-label="Dismiss alert"
                        className="p-1 text-amber-500 hover:text-amber-800 rounded-md transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Slot Fetch Error Notice */}
                  {slotFetchError && (
                    <div
                      role="alert"
                      aria-live="polite"
                      className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <span>{slotFetchError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => refreshSlots()}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Time Slots Area */}
                  <div className="min-h-[280px]">
                    {loadingSlots ? (
                      <div className="grid grid-cols-2 gap-2.5 py-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
                        ))}
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="py-12 text-center bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 p-6">
                        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                        <h4 className="text-sm font-bold text-slate-800">No Mentors Available on this Date</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                          Mentors are off schedule or their 2-session daily capacity is reached. Please pick another date on the calendar.
                        </p>
                      </div>
                    ) : filteredSlots.length === 0 ? (
                      <div className="py-10 text-center bg-slate-50/60 rounded-xl p-4 text-xs text-slate-500">
                        No slots available for the selected period ({slotPeriodFilter}). Switch to &ldquo;all&rdquo; to see all available slots.
                      </div>
                    ) : (
                      /* Time Slot Buttons (Faithful to Reference Image: Clean Outlined Buttons) */
                      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 max-h-[340px] overflow-y-auto pr-1">
                        {filteredSlots.map((slot) => {
                          const isSelected =
                            selectedSlot?.slotStartTime === slot.slotStartTime &&
                            selectedSlot?.slotDate === slot.slotDate;

                          return (
                            <button
                              key={slot.slotStartTime}
                              type="button"
                              onClick={() => {
                                setSelectedSlot(slot);
                                if (bookingFailure) setBookingFailure(null);
                              }}
                              className={`py-3 px-3.5 rounded-xl font-bold text-xs transition-all flex flex-col items-center justify-center cursor-pointer ${
                                isSelected
                                  ? "bg-blue-600 text-white border border-blue-600 shadow-md shadow-blue-600/20 scale-[1.02]"
                                  : "bg-white hover:bg-blue-50/40 text-blue-700 border border-blue-200/90 hover:border-blue-500 shadow-2xs"
                              }`}
                            >
                              <span className="text-sm tracking-tight font-bold">
                                {formatTimeDisplay(slot.slotStartTime)}
                              </span>
                              <span
                                className={`text-[10px] font-medium mt-0.5 ${
                                  isSelected ? "text-blue-100" : "text-slate-400"
                                }`}
                              >
                                {slot.availableMentorCount} mentor{slot.availableMentorCount > 1 ? "s" : ""} available
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="pt-4 border-t border-slate-100 mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs">
                    {selectedSlot ? (
                      <span className="text-slate-700">
                        Selected: <strong className="text-blue-700">{formatTimeDisplay(selectedSlot.slotStartTime)}</strong> on <strong className="text-slate-900">{formattedSelectedDate}</strong>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">
                        Click a time slot above to proceed
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!selectedSlot}
                    onClick={() => {
                      if (selectedSlot) setActiveStep(2);
                    }}
                    className="w-full sm:w-auto px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>Continue to Your Details</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 2: Parent and Student Details */}
          {activeStep === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
              {/* Left Column: Input Form */}
              <div className="lg:col-span-8 space-y-6">
                <div>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                    Student &amp; Parent Details
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Help us personalize the trial class to your student&apos;s grade and coding experience.
                  </p>
                </div>

                {bookingFailure && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className={`p-4 rounded-xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs ${
                      bookingFailure.type === "conflict"
                        ? "bg-amber-50 border-amber-300 text-amber-900"
                        : bookingFailure.type === "validation"
                        ? "bg-red-50 border-red-200 text-red-800"
                        : bookingFailure.type === "rate_limit"
                        ? "bg-amber-50 border-amber-300 text-amber-900"
                        : "bg-red-50 border-red-200 text-red-800"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertCircle
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          bookingFailure.type === "conflict" || bookingFailure.type === "rate_limit"
                            ? "text-amber-600"
                            : "text-red-500"
                        }`}
                      />
                      <div>
                        <p className="font-semibold text-xs leading-relaxed">{bookingFailure.message}</p>
                        {bookingFailure.type === "conflict" && (
                          <p className="text-[11px] text-amber-700 mt-0.5">
                            Your contact and student profile details are safely saved.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      {bookingFailure.type === "conflict" ? (
                        <button
                          type="button"
                          onClick={() => setActiveStep(1)}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
                        >
                          Choose another time
                        </button>
                      ) : bookingFailure.retryable ? (
                        <button
                          type="button"
                          onClick={() => {
                            const form = document.getElementById("booking-form") as HTMLFormElement | null;
                            if (form) form.requestSubmit();
                          }}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
                        >
                          Try again
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setBookingFailure(null)}
                        aria-label="Dismiss alert"
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <form id="booking-form" onSubmit={handleBookingSubmit} className="space-y-5">
                  {/* Parent Information Group */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                      1. Parent Contact Information
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Parent Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Sarah Jenkins"
                          value={parentName}
                          onChange={(e) => {
                            setParentName(e.target.value);
                            if (fieldErrors.parentName) {
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next.parentName;
                                return next;
                              });
                            }
                          }}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 bg-white ${
                            fieldErrors.parentName ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-600"
                          }`}
                        />
                        {fieldErrors.parentName && (
                          <span className="text-[10px] text-red-600 mt-0.5 block">{fieldErrors.parentName}</span>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Parent Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          placeholder="e.g. sarah.jenkins@example.com"
                          value={parentEmail}
                          onChange={(e) => {
                            setParentEmail(e.target.value);
                            if (fieldErrors.parentEmail) {
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next.parentEmail;
                                return next;
                              });
                            }
                          }}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 bg-white ${
                            fieldErrors.parentEmail ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-600"
                          }`}
                        />
                        {fieldErrors.parentEmail && (
                          <span className="text-[10px] text-red-600 mt-0.5 block">{fieldErrors.parentEmail}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Student Information Group */}
                  <div className="pt-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                      2. Student Learning Profile
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Student Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Leo Jenkins"
                          value={studentName}
                          onChange={(e) => {
                            setStudentName(e.target.value);
                            if (fieldErrors.studentName) {
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next.studentName;
                                return next;
                              });
                            }
                          }}
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 bg-white ${
                            fieldErrors.studentName ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-600"
                          }`}
                        />
                        {fieldErrors.studentName && (
                          <span className="text-[10px] text-red-600 mt-0.5 block">{fieldErrors.studentName}</span>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Student Grade
                        </label>
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

                    <div className="mt-3.5">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Learning Track / Topic of Interest
                      </label>
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
                  </div>

                  {/* Reminder Preferences */}
                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 text-xs">
                      <input
                        type="checkbox"
                        checked={notifyReminder}
                        onChange={(e) => setNotifyReminder(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <span>Send an email reminder 24 hours in advance with the class link</span>
                    </label>
                  </div>

                  {/* Form Action Buttons */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveStep(1)}
                      className="px-5 py-3 text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      ← Back to Time
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting || !selectedSlot}
                      className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Confirming...</span>
                        </>
                      ) : (
                        <>
                          <span>Confirm Trial Class</span>
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Compact Session Summary */}
              <div className="lg:col-span-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Session Summary
                  </h4>
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Change Time
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Session Type</span>
                    <strong className="text-slate-900 font-bold">1:1 Live Coding Trial Class</strong>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Date</span>
                    <strong className="text-slate-900 font-bold">{formattedSelectedDate}</strong>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Time</span>
                    {selectedSlot ? (
                      <strong className="text-blue-700 font-bold text-sm">
                        {formatTimeDisplay(selectedSlot.slotStartTime)} – {formatTimeDisplay(selectedSlot.slotEndTime)}
                      </strong>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-amber-700 font-semibold text-xs">No time slot selected</span>
                        <button
                          type="button"
                          onClick={() => setActiveStep(1)}
                          className="text-[11px] text-blue-600 font-bold underline cursor-pointer"
                        >
                          Choose time
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Timezone</span>
                    <span className="font-mono text-slate-700 font-semibold">{selectedTimezone}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80">
                    <span className="text-[11px] text-slate-400 block font-medium">Total Cost</span>
                    <span className="text-emerald-600 font-extrabold text-sm">$0 Free Trial</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 space-y-1.5 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Dedicated 1:1 certified mentor</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>No credit card required</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 3: Confirmation */}
          {activeStep === 3 && confirmedBooking && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Success Banner */}
              <div className="text-center space-y-2 pb-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Trial Class Confirmed!
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                  Your trial class is booked and a dedicated mentor has been assigned. We look forward to meeting you!
                </p>
              </div>

              {/* Session Information Grid */}
              <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold text-[11px]">Assigned Mentor</span>
                  <strong className="text-sm font-extrabold text-slate-900 block mt-0.5">
                    {confirmedBooking.mentorName}
                  </strong>
                  <span className="text-slate-500">{confirmedBooking.mentorEmail}</span>
                </div>

                <div>
                  <span className="text-slate-400 block font-semibold text-[11px]">Registered Student / Parent</span>
                  <strong className="text-sm font-extrabold text-slate-900 block mt-0.5">
                    {studentName ? `${studentName} (Parent: ${confirmedBooking.parentName})` : confirmedBooking.parentName}
                  </strong>
                  <span className="text-slate-500">{confirmedBooking.parentEmail}</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                  <span className="text-blue-700 font-bold block mb-0.5 text-[11px]">
                    Parent Time ({confirmedBooking.parentTimezone})
                  </span>
                  <span className="font-extrabold text-slate-900 text-xs">
                    {confirmedBooking.parentLocalStart} – {confirmedBooking.parentLocalEnd}
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                  <span className="text-slate-600 font-bold block mb-0.5 text-[11px]">
                    Mentor Time ({confirmedBooking.mentorTimezone})
                  </span>
                  <span className="font-extrabold text-slate-900 text-xs">
                    {confirmedBooking.mentorLocalStart} – {confirmedBooking.mentorLocalEnd}
                  </span>
                </div>
              </div>

              {/* Dedicated Classroom Link */}
              <div className="bg-blue-50/60 border border-blue-200/80 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="font-bold text-slate-900 block text-xs">Verified Classroom Link</strong>
                    <span className="font-mono text-[11px] text-slate-600 break-all">{confirmedBooking.meetingLink}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg flex items-center gap-1.5 transition-all text-xs cursor-pointer shadow-2xs"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? "Copied" : "Copy"}</span>
                  </button>
                  <a
                    href={confirmedBooking.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs whitespace-nowrap text-xs transition-colors"
                  >
                    <span>Enter Classroom</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Calendar Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-bold flex items-center gap-1">
                    <CalendarPlus className="w-3.5 h-3.5 text-blue-600" />
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
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg flex items-center gap-1.5 transition-all text-xs"
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
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg flex items-center gap-1.5 transition-all text-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    <span>Apple / Outlook (.ics)</span>
                  </button>
                </div>

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
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Book Another Class
                </button>
              </div>

              {/* Transactional Outbox Notifications Preview */}
              {notifications.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Confirmation Emails Queued (Transactional Outbox)
                  </h5>
                  <div className="space-y-2">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
                        <div>
                          <strong className="text-slate-800">{n.subject}</strong>
                          <span className="text-slate-500 block text-[11px]">{n.recipientEmail} ({n.recipientType})</span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">
                          {n.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Bento Section: Why Parents Choose Codeyoung */}
      
      <section
      id="why-us"
      className="w-full bg-white px-4 py-20 sm:px-6 sm:py-24">
      
      <div className="mx-auto max-w-6xl">
      {/* Section heading */}
      <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-14">
      <span className="mb-3 inline-block text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
        Proven STEM Excellence
      </span>

      <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
        Why Parents Choose Codeyoung
      </h2>

      <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
        Designed for real learning outcomes with individualized attention
        and globally accessible online learning.
      </p>
    </div>

    {/* Photographic Bento grid */}
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {/* Card 1 — Featured */}
      <article className="relative isolate min-h-[360px] overflow-hidden rounded-3xl bg-slate-900 md:col-span-2 md:min-h-[420px]">
        <img
          src="/images/photo-1.jpg"
          alt="A student learning coding with an online mentor"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          loading="lazy"
        />

        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/90 via-slate-900/25 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-9">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-white backdrop-blur-md">
            <Globe className="h-5 w-5" />
          </div>

          <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Zero Timezone Confusion
          </h3>

          <p className="mt-3 max-w-lg text-sm leading-6 text-white/85 sm:text-base">
            Automated IANA timezone conversions and DST transition
            handling prevent double-bookings and mismatched appointment
            times.
          </p>

          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white">
            Scheduling across timezones
            <span aria-hidden="true">↗</span>
          </span>
        </div>
      </article>

      {/* Card 2 — Global mentors */}
      <article className="relative isolate min-h-[320px] overflow-hidden rounded-3xl bg-slate-900 md:min-h-0">
        <img
          src="/images/photo-2.jpg"
          alt="A mentor ready to teach an online coding class"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          loading="lazy"
        />

        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/90 via-slate-900/25 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-6">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white backdrop-blur-md">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <h3 className="text-xl font-bold text-white">
            Top 1% Global Mentors
          </h3>

          <p className="mt-2 text-sm leading-6 text-white/85">
            Every mentor is capped at a maximum of two demo classes
            per day to support attentive, high-quality instruction.
          </p>
        </div>
      </article>

      {/* Card 3 — Hands-on projects */}
      <article className="relative isolate min-h-[320px] overflow-hidden rounded-3xl bg-slate-900 md:min-h-[340px]">
        <img
          src="/images/photo-3.jpg"
          alt="A child exploring coding and creative technology"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          loading="lazy"
        />

        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/90 via-slate-900/25 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-6">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white backdrop-blur-md">
            <Code2 className="h-5 w-5" />
          </div>

          <h3 className="text-xl font-bold text-white">
            Hands-On Projects
          </h3>

          <p className="mt-2 text-sm leading-6 text-white/85">
            Students build games, AI models, mobile apps, and
            animations from their very first 45-minute demo session.
          </p>
        </div>
      </article>

      {/* Card 4 — Dedicated classroom */}
      <article className="relative isolate min-h-[320px] overflow-hidden rounded-3xl bg-slate-900 md:col-span-2 md:min-h-[340px]">
        <img
          src="/images/photo-4.jpg"
          alt="A laptop prepared for an online learning session"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          loading="lazy"
        />

        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/90 via-slate-900/25 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white backdrop-blur-md">
            <Video className="h-5 w-5" />
          </div>

          <h3 className="text-xl font-bold text-white sm:text-2xl">
            Instant Dedicated Room
          </h3>

          <p className="mt-2 max-w-xl text-sm leading-6 text-white/85 sm:text-base">
            Unique, collision-free meeting rooms and transactional
            email notifications for parents and mentors help ensure
            a seamless class experience.
          </p>
        </div>
      </article>
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
