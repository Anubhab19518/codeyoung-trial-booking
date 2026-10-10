# Codeyoung — Modular Monolith Trial Class Booking Platform

A timezone-aware, concurrency-safe trial-class booking platform built for Codeyoung with **Next.js 16 (App Router & Turbopack)**, **React 19**, **TypeScript**, **PostgreSQL**, **Prisma ORM**, and a strict **Modular Monolith Architecture**.

---

## 1. Architectural Highlights

### 🏛️ Modular Monolith Architecture
Business domains are partitioned into isolated, bounded modules with private internal repositories and strict public interfaces:
- **`src/modules/mentors`**: Mentor profiles, working schedules (in mentor's local timezone), and availability lookup.
- **`src/modules/scheduling`**: Dynamic slot generation across timezone shifts, mentor active duty filters, collision deductions, and daily capacity calculations.
- **`src/modules/bookings`**: Server-authoritative slot resolution, candidate mentor load balancing, atomic booking transactions with PostgreSQL locks, and outbox event dispatch.
- **`src/modules/notifications`**: Transactional outbox event processor with exponential backoff retry scheduling, ensuring email failure never rolls back a confirmed booking.
- **`src/shared/`**: Non-domain infrastructure including singleton Prisma client, IANA timezone engine, and typed domain errors.

### 🛡️ Concurrency & Database Integrity Protections
1. **PostgreSQL Partial Exclusion Constraint (`btree_gist`)**:
   Enforced at the storage layer via a custom migration:
   ```sql
   ALTER TABLE "Booking"
   ADD CONSTRAINT no_overlapping_confirmed_bookings
   EXCLUDE USING gist (
     "mentorId" WITH =,
     tsrange("startTimeUtc", "endTimeUtc") WITH &&
   )
   WHERE ("status" = 'CONFIRMED');
   ```
   Mathematically prevents double-booking for the same mentor under high-concurrency race conditions.
2. **Transaction-Scoped Advisory Locks**:
   Before evaluating quota or assigning a mentor, the booking transaction acquires:
   ```sql
   SELECT pg_advisory_xact_lock(hashtext(concat($mentorId, ':', $mentorLocalDate)));
   ```
   Strictly serializes capacity checks and guarantees that no mentor can exceed the **maximum of 2 demo classes per mentor-local calendar day**.

### 🌐 Timezone & Daylight Saving Time (DST) Precision
- Validates canonical IANA timezone identifiers (e.g. `Asia/Kolkata`, `America/New_York`, `America/Los_Angeles`, `Europe/London`).
- **Spring-Forward Gap Detection**: Rejects nonexistent local wall-clock times during 1-hour forward transitions.
- **Fall-Back Ambiguity Detection**: Detects and rejects ambiguous wall-clock times that repeat during 1-hour back transitions.
- Accurately computes mentor-local calendar dates and day-of-week across cross-midnight UTC boundaries.

---

## 2. Tech Stack

- **Framework**: Next.js 16.4.0 (App Router, Turbopack)
- **UI Library**: React 19.3.0 & React DOM 19.3.0
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL 16 (via Docker Compose)
- **ORM**: Prisma ORM 5.22 with version-controlled migrations
- **Validation**: Zod 3.24
- **Timezone Engine**: Luxon 3.5 & ECMAScript `Intl`
- **Linting**: ESLint 9.39 with native Flat Config (`eslint.config.mjs`)
- **Testing**: Vitest 2.1 (unit + concurrency integration suites)

---

## 3. Quickstart Guide

### Prerequisites
- Node.js `v20+` or `v22+`
- Docker & Docker Compose

### 1. Start PostgreSQL
```bash
docker compose up -d
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Apply Migrations & Seed Mentors
```bash
npx prisma migrate dev
npm run prisma:seed
```

### 4. Run Automated Test Suite
```bash
npm test
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. Automated Test Matrix

Run all tests via Vitest:
```bash
npm test
```
The test suite covers:
1. `tests/unit/timezone-utils.test.ts`:
   - Canonical IANA validation
   - US Spring-Forward nonexistent time detection (March 8, 2026 at 02:30 EDT)
   - UK Spring-Forward nonexistent time detection (March 29, 2026 at 01:30 BST)
   - US Fall-Back ambiguous time detection (November 1, 2026 at 01:30 EST)
   - UK Fall-Back ambiguous time detection (October 25, 2026 at 01:30 GMT)
   - Cross-midnight mentor-local day projections (IST, EST, PST, GMT)
2. `tests/integration/booking-concurrency.test.ts`:
   - Direct PostgreSQL `no_overlapping_confirmed_bookings` exclusion constraint violation test
   - 10 parallel booking race conditions on a single slot $\rightarrow$ strictly 1 fulfilled, 9 rejected
   - Concurrent daily quota enforcement $\rightarrow$ strictly caps at 2 confirmed bookings per mentor-local day
3. `tests/integration/outbox-resilience.test.ts`:
   - Atomic creation of booking and outbox notifications
   - Asynchronous outbox worker processing and status transitions
