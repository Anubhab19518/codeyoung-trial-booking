-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Mentor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mentor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorWorkingHour" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startLocalTime" TEXT NOT NULL,
    "endLocalTime" TEXT NOT NULL,

    CONSTRAINT "MentorWorkingHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "parentEmail" TEXT NOT NULL,
    "parentTimezone" TEXT NOT NULL,
    "startTimeUtc" TIMESTAMP(3) NOT NULL,
    "endTimeUtc" TIMESTAMP(3) NOT NULL,
    "mentorLocalDate" TEXT NOT NULL,
    "meetingLink" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mentor_email_key" ON "Mentor"("email");

-- CreateIndex
CREATE INDEX "Mentor_isActive_idx" ON "Mentor"("isActive");

-- CreateIndex
CREATE INDEX "MentorWorkingHour_mentorId_dayOfWeek_idx" ON "MentorWorkingHour"("mentorId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "MentorWorkingHour_mentorId_dayOfWeek_startLocalTime_endLoca_key" ON "MentorWorkingHour"("mentorId", "dayOfWeek", "startLocalTime", "endLocalTime");

-- CreateIndex
CREATE INDEX "Booking_mentorId_startTimeUtc_endTimeUtc_idx" ON "Booking"("mentorId", "startTimeUtc", "endTimeUtc");

-- CreateIndex
CREATE INDEX "Booking_mentorId_mentorLocalDate_status_idx" ON "Booking"("mentorId", "mentorLocalDate", "status");

-- CreateIndex
CREATE INDEX "Booking_parentEmail_idx" ON "Booking"("parentEmail");

-- CreateIndex
CREATE INDEX "NotificationOutbox_status_scheduledFor_idx" ON "NotificationOutbox"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "NotificationOutbox_bookingId_idx" ON "NotificationOutbox"("bookingId");

-- AddForeignKey
ALTER TABLE "MentorWorkingHour" ADD CONSTRAINT "MentorWorkingHour_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Mentor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable btree_gist extension for GiST index on text/UUID + timestamp range
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Partial exclusion constraint preventing overlapping confirmed bookings for the same mentor
ALTER TABLE "Booking"
ADD CONSTRAINT no_overlapping_confirmed_bookings
EXCLUDE USING gist (
  "mentorId" WITH =,
  tsrange("startTimeUtc", "endTimeUtc") WITH &&
)
WHERE ("status" = 'CONFIRMED');

