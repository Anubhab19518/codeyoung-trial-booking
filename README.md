# Codeyoung — Modular Monolith Trial-Class Booking Platform

A timezone-aware, concurrency-safe trial-class booking platform built for Codeyoung using **Next.js 16 (App Router & Turbopack)**, **React 19**, **TypeScript**, **PostgreSQL**, **Prisma ORM**, and a strict **Modular Monolith Architecture**.

The application allows parents to book a 45-minute trial coding class, automatically assigns an eligible mentor, handles timezone and Daylight Saving Time (DST) differences, and generates a dummy meeting link.

---

## 1. Documentation

| Document | Description |
|---|---|
| [Architecture.md](Architecture.md) | System architecture, module boundaries, engineering decisions, concurrency protections, timezone handling, and design trade-offs |
| [API.md](API.md) | Complete API endpoint documentation, request schemas, response formats, error handling, and client recovery guidelines |
| [TRANSCRIPT.md](TRANSCRIPT.md) | AI-assisted development transcript containing the actual prompts and agent responses |

## 2. High-Level Architecture

The application follows a **Modular Monolith Architecture**. Business domains have separate responsibilities and public interfaces while running within a single Next.js application.

![Codeyoung Trial-Class Booking Platform Architecture](docs/architecture.png)

For the detailed architecture and the reasoning behind the design decisions, see [Architecture.md](Architecture.md).

### Core Modules

- **`src/modules/mentors`** — Mentor profiles, working schedules in mentor-local time, and eligibility information.
- **`src/modules/scheduling`** — Dynamic slot generation, timezone-aware availability, collision handling, and daily capacity calculations.
- **`src/modules/bookings`** — Server-authoritative booking validation, mentor assignment, transactional booking creation, and concurrency protection.
- **`src/modules/notifications`** — Transactional outbox processing, notification status management, and retry scheduling.
- **`src/shared/`** — Shared infrastructure, Prisma client, timezone utilities, and typed errors.

---

## 3. Architectural Highlights

### Modular Monolith Architecture

The application uses a single deployable application with explicitly separated business modules and public interfaces. This keeps the codebase maintainable without introducing the deployment and networking complexity of microservices.

### Concurrency and Database Integrity

**PostgreSQL exclusion constraint**

A custom SQL migration uses `btree_gist` and a partial exclusion constraint to prevent overlapping confirmed bookings for the same mentor.

**Transaction-scoped advisory locks**

The booking transaction serializes capacity checks for a mentor and mentor-local calendar date. The system enforces a maximum of **two confirmed trial classes per mentor per mentor-local day**.

**Server-authoritative validation**

Availability is revalidated when a booking is submitted. The backend does not rely on the browser's previously displayed slots as proof that a booking is still available.

### Timezone and Daylight Saving Time

- Validates IANA timezone identifiers such as `Asia/Kolkata`, `America/New_York`, `America/Los_Angeles`, and `Europe/London`.
- Detects nonexistent local times during spring-forward transitions.
- Detects ambiguous local times during fall-back transitions.
- Stores booking instants in UTC and converts them to the appropriate local times for parents and mentors.
- Evaluates mentor daily capacity using the mentor's local calendar date, including cross-midnight timezone differences.

### Reliable Notification Processing

The transactional outbox pattern separates booking confirmation from notification delivery. Booking and notification-outbox records are persisted atomically, and failed notification work can be retried without invalidating the confirmed booking.

The assignment uses dummy meeting links and does not require integration with a live video-meeting provider.

---

## 4. Technology Stack

| Component | Technology |
|---|---|
| Framework | Next.js 16.4.0 — App Router and Turbopack |
| UI library | React 19.3.0 and React DOM 19.3.0 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL 16 |
| ORM | Prisma ORM 5.22 |
| Validation | Zod 3.24 |
| Timezone utilities | Luxon 3.5 and ECMAScript `Intl` |
| Linting | ESLint 9.39 with Flat Config |
| Testing | Vitest 2.1 |
| Local infrastructure | Docker Compose |

---

## 5. Quickstart Guide

### Prerequisites

- Node.js `v20+` or `v22+`
- Docker and Docker Compose
- npm

### Step 1 — Start PostgreSQL

```bash
docker compose up -d
```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Configure environment variables

Configure the database connection and any other required environment variables using the project's environment configuration.

If an `.env.example` file is provided, use it as a reference. Do not commit secrets or production credentials.

### Step 4 — Apply migrations and seed mentors

```bash
npx prisma migrate dev
npm run prisma:seed
```

This prepares the database and mentor data required to exercise the scheduling and booking workflow.

### Step 5 — Run the automated tests

```bash
npm test
```

### Step 6 — Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. Automated Test Matrix

Run the automated test suite using:

```bash
npm test
```

### Timezone utilities

File: `tests/unit/timezone-utils.test.ts`

- Canonical IANA timezone validation.
- US spring-forward nonexistent-time detection, including March 8, 2026.
- UK spring-forward nonexistent-time detection, including March 29, 2026.
- US fall-back ambiguous-time detection, including November 1, 2026.
- UK fall-back ambiguous-time detection, including October 25, 2026.
- Cross-midnight mentor-local date calculations across IST, EST, PST, and GMT.

### Booking concurrency

File: `tests/integration/booking-concurrency.test.ts`

- PostgreSQL exclusion-constraint violation testing for overlapping confirmed bookings.
- Ten parallel attempts to book the same slot, with one expected success and nine rejected attempts.
- Concurrent enforcement of the maximum of two confirmed bookings per mentor-local calendar day.

### Notification resilience

File: `tests/integration/outbox-resilience.test.ts`

- Atomic creation of booking and notification-outbox records.
- Outbox worker processing and notification status transitions.
- Resilience to notification-processing failures.

---

## 7. Project Structure

The following is a representative overview of the repository:

```text
CodeYoung/
├── docs/
│   └── architecture.png
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── public/
├── src/
│   ├── modules/
│   │   ├── mentors/
│   │   ├── scheduling/
│   │   ├── bookings/
│   │   └── notifications/
│   └── shared/
├── tests/
│   ├── unit/
│   └── integration/
├── Architecture.md
├── API.md
├── README.md
├── TRANSCRIPT.md
├── docker-compose.yml
└── package.json
```

Refer to the repository for the complete source tree.

---

## 8. Assignment Scope and Limitations

The implementation focuses on the parent booking experience, automatic mentor assignment, timezone correctness, concurrency-safe capacity enforcement, and reliable notification processing.

- The application generates a dummy meeting link as permitted by the assignment.
- A live meeting-room provider integration is outside the assignment scope.
- Notification queuing and retry handling do not, by themselves, guarantee that an external email provider delivers every message.
- Production deployment, monitoring, and operational configuration are separate from the local development setup described above.

---

## 9. Engineering Principles

1. **Correctness over optimistic UI checks** — booking integrity is enforced by the backend and database.
2. **Explicit module boundaries** — business logic is separated from HTTP handlers and presentation.
3. **Timezone correctness** — local-time interpretation and DST edge cases are handled explicitly.
4. **Transactional consistency** — booking persistence and notification enqueueing are coordinated atomically.
5. **Graceful failure recovery** — conflicts and notification failures are handled without misleading users.
6. **Appropriate complexity** — a modular monolith provides maintainable boundaries without unnecessary distributed services.

---

Built as part of the **Codeyoung Full-Stack Development Assignment — 2027 graduating batch**.