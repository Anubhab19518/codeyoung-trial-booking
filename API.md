# Codeyoung Trial-Class Booking Platform
## API Documentation and Endpoint Audit

**Project:** Codeyoung — Full-Stack Development Assignment  
**Architecture:** Modular Monolith (Next.js App Router, TypeScript, Prisma, PostgreSQL)  
**Base URL:** `http://localhost:3000/api` (Local) / `/api` (Relative)

---

## 1. Architectural Overview & API Conventions

All API routes are implemented as Next.js App Router **Route Handlers** located under `src/app/api/`. They act as a thin transport layer between the client (or external consumers) and the isolated domain modules (`mentors`, `scheduling`, `bookings`, `notifications`).

### Key Design Principles:
1. **Server-Authoritative Trust Boundary:** The client never assigns mentors, generates meeting links, or claims availability without server-side validation and database transactions.
2. **Consistent Response Envelope:** All successful responses return `{ success: true, data: ..., message?: string }`.
3. **Structured Error Handling:** All errors pass through the centralized `handleApiError` utility (`src/shared/errors/error-handler.ts`), returning `{ success: false, error: { code, message, issues?, details? } }`.
4. **Dynamic Execution:** All endpoints enforce `export const dynamic = "force-dynamic"` to prevent stale caching of appointment availability or booking states.

---

## 2. Standard Response & Error Envelopes

### 2.1 Standard Success Envelope
```json
{
  "success": true,
  "message": "Optional human-readable confirmation message",
  "data": { ... }
}
```

### 2.2 Zod Validation Failure (`400 Bad Request`)
Triggered when request query parameters or JSON body payloads violate schema constraints.
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request payload validation failed.",
    "issues": [
      {
        "field": "parentName",
        "message": "Parent name must be at least 2 characters"
      }
    ]
  }
}
```

### 2.3 Domain Error (`4xx` / `5xx`)
Triggered when business rules or scheduling invariants are violated (e.g. DST ambiguities, slot collisions, capacity limits).
```json
{
  "success": false,
  "error": {
    "code": "SLOT_CONFLICT",
    "message": "This time slot is no longer available. Another parent may have booked it. Please select another time.",
    "details": null
  }
}
```

### 2.4 Internal Server Error (`500 Internal Server Error`)
Triggered upon uncaught exceptions or database connection failures.
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected internal server error occurred."
  }
}
```

---

## 3. Route Audit & Endpoint Reference

### Summary Matrix

| Method | Endpoint | Domain Module | Primary Purpose |
|---|---|---|---|
| `GET` | `/api/mentors` | `mentors` | Fetch all active mentors and their weekly local working hours |
| `GET` | `/api/slots` | `scheduling` | Dynamically calculate free 45-min slots for a given date and timezone |
| `POST` | `/api/bookings` | `bookings` | Atomically reserve a slot, balance load, assign mentor, and enqueue emails |
| `GET` | `/api/bookings` | `bookings` | Audit recent confirmed bookings (up to 50 records) |
| `GET` | `/api/notifications` | `notifications` | Inspect transactional outbox email queue status and retry logs |
| `POST` | `/api/notifications` | `notifications` | Trigger asynchronous outbox worker to dispatch pending messages |

---

### 3.1 `GET /api/mentors`

#### Purpose
Retrieves all active mentors in the system along with their configured working hour windows. Used to display mentor profiles and verify roster availability across India (`Asia/Kolkata`), United Kingdom (`Europe/London`), and the United States (`America/New_York`, `America/Los_Angeles`).

#### Request
- **Method:** `GET`
- **URL:** `/api/mentors`
- **Headers:** `Accept: application/json`
- **Query Parameters:** None
- **Body:** None

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "cm1mentor0001",
      "name": "Aarav Sharma",
      "email": "aarav.sharma@codeyoung.com",
      "timezone": "Asia/Kolkata",
      "isActive": true,
      "workingHours": [
        {
          "id": "cm1wh0001",
          "dayOfWeek": 1,
          "startLocalTime": "14:00",
          "endLocalTime": "20:00"
        },
        {
          "id": "cm1wh0002",
          "dayOfWeek": 2,
          "startLocalTime": "14:00",
          "endLocalTime": "20:00"
        }
      ]
    }
  ]
}
```

#### Expected Errors
| Status | Code | Condition |
|---|---|---|
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Database connectivity failure or unexpected query exception. |

---

### 3.2 `GET /api/slots`

#### Purpose
Calculates dynamic, real-time trial-class availability for a parent's requested date and local timezone. It translates the requested calendar day into UTC, matches it against all mentor working schedules, subtracts existing booking collisions, and excludes mentors who have already hit their maximum daily quota (2 trial classes per mentor-local calendar day).

#### Request
- **Method:** `GET`
- **URL:** `/api/slots`
- **Headers:** `Accept: application/json`
- **Query Parameters:**
  - `date` (string, **required**): Local calendar date in `YYYY-MM-DD` format (e.g., `2026-10-15`).
  - `timezone` (string, **required**): Valid IANA timezone identifier (e.g., `America/New_York`, `Asia/Kolkata`, `Europe/London`).
  - `durationMinutes` (number, *optional*): Slot duration in minutes. Default: `45`. Permitted range: `15` to `120`.

**Validation Schema (`GetSlotsQuerySchema`):**
```typescript
z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date parameter must be in YYYY-MM-DD format"),
  timezone: z.string().min(1, "timezone parameter is required"),
  durationMinutes: z.coerce.number().int().min(15).max(120).optional().default(45),
})
```

#### Example Request
```http
GET /api/slots?date=2026-10-15&timezone=America/New_York&durationMinutes=45 HTTP/1.1
Host: localhost:3000
Accept: application/json
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "date": "2026-10-15",
    "timezone": "America/New_York",
    "slotCount": 4,
    "slots": [
      {
        "slotDate": "2026-10-15",
        "slotStartTime": "09:00",
        "slotEndTime": "09:45",
        "parentLocalStart": "2026-10-15T09:00:00.000-04:00",
        "parentLocalEnd": "2026-10-15T09:45:00.000-04:00",
        "utcStart": "2026-10-15T13:00:00.000Z",
        "utcEnd": "2026-10-15T13:45:00.000Z",
        "availableMentorCount": 2
      },
      {
        "slotDate": "2026-10-15",
        "slotStartTime": "09:45",
        "slotEndTime": "10:30",
        "parentLocalStart": "2026-10-15T09:45:00.000-04:00",
        "parentLocalEnd": "2026-10-15T10:30:00.000-04:00",
        "utcStart": "2026-10-15T13:45:00.000Z",
        "utcEnd": "2026-10-15T14:30:00.000Z",
        "availableMentorCount": 1
      }
    ]
  }
}
```

#### Expected Errors
| Status | Code | Condition | Example Response |
|---|---|---|---|
| `400 Bad Request` | `VALIDATION_ERROR` | Missing or malformed `date` (not `YYYY-MM-DD`), empty `timezone`, or `durationMinutes` outside `15..120`. | `{"success":false,"error":{"code":"VALIDATION_ERROR","message":"Request payload validation failed.","issues":[{"field":"date","message":"date parameter must be in YYYY-MM-DD format"}]}}` |
| `400 Bad Request` | `DST_TRANSITION_ERROR` | The requested local date/time lies in an unresolvable DST transition (e.g. nonexistent spring-forward hour). | `{"success":false,"error":{"code":"DST_TRANSITION_ERROR","message":"Nonexistent local time due to DST spring-forward."}}` |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Unhandled database or timezone conversion error. | Standard 500 error envelope. |

---

### 3.3 `POST /api/bookings`

#### Purpose
Validates and executes an atomic trial-class booking request.
The server performs:
1. Local-to-UTC conversion with Daylight Saving Time validation.
2. Filtering active mentors working at the requested time.
3. Pre-filtering mentors with remaining daily quota (`< 2` on their mentor-local calendar date).
4. Deterministic load-balancing (mentors with fewer classes scheduled on that day are tried first).
5. Transactional execution with PostgreSQL **advisory locks** (`pg_advisory_xact_lock`) and database-enforced interval exclusion constraints (`btree_gist`).
6. Generating a unique dummy classroom link (`https://meet.codeyoung.com/room/...`).
7. Transactional insertion of the booking and enqueuing of parent and mentor confirmation notifications into the outbox in the same database transaction.
8. Asynchronous background notification worker trigger.

#### Request
- **Method:** `POST`
- **URL:** `/api/bookings`
- **Headers:** `Content-Type: application/json`
- **Request Body (JSON):**

| Field | Type | Required | Constraints / Description |
|---|---|---|---|
| `parentName` | `string` | **Yes** | Min length 2, Max length 100. Standard parent full name. |
| `parentEmail` | `string` | **Yes** | Valid RFC-compliant email address. |
| `parentTimezone` | `string` | **Yes** | Valid IANA timezone identifier (e.g., `America/New_York`). |
| `slotDate` | `string` | **Yes** | Date string in `YYYY-MM-DD` format. |
| `slotStartTime` | `string` | **Yes** | Time string in `HH:mm` 24-hour format (e.g., `14:00`). |
| `slotDurationMinutes` | `number` | *Optional* | Integer between 15 and 120. Defaults to `45`. |

**Validation Schema (`CreateBookingSchema`):**
```typescript
z.object({
  parentName: z.string().min(2, "Parent name must be at least 2 characters").max(100),
  parentEmail: z.string().email("Please provide a valid email address"),
  parentTimezone: z.string().min(1, "Parent timezone is required"),
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "slotDate must be in YYYY-MM-DD format"),
  slotStartTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "slotStartTime must be in HH:mm 24-hour format"),
  slotDurationMinutes: z.number().int().min(15).max(120).optional().default(45),
})
```

#### Example Request
```http
POST /api/bookings HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "parentName": "Sarah Jenkins",
  "parentEmail": "sarah.jenkins@example.com",
  "parentTimezone": "America/New_York",
  "slotDate": "2026-10-15",
  "slotStartTime": "14:00",
  "slotDurationMinutes": 45
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "message": "Trial class successfully confirmed and mentor assigned.",
  "data": {
    "id": "cm1book0001",
    "mentorId": "cm1mentor0001",
    "mentorName": "Aarav Sharma",
    "mentorEmail": "aarav.sharma@codeyoung.com",
    "mentorTimezone": "Asia/Kolkata",
    "parentName": "Sarah Jenkins",
    "parentEmail": "sarah.jenkins@example.com",
    "parentTimezone": "America/New_York",
    "startTimeUtc": "2026-10-15T18:00:00.000Z",
    "endTimeUtc": "2026-10-15T18:45:00.000Z",
    "parentLocalStart": "2026-10-15 14:00",
    "parentLocalEnd": "2026-10-15 14:45",
    "mentorLocalStart": "2026-10-15 23:30",
    "mentorLocalEnd": "2026-10-16 00:15",
    "mentorLocalDate": "2026-10-15",
    "meetingLink": "https://meet.codeyoung.com/room/meet-1791702033-a8f9d2",
    "status": "CONFIRMED",
    "createdAt": "2026-10-11T09:44:00.000Z"
  }
}
```

#### Expected Errors
| Status | Code | Condition | Example Response | Client Action |
|---|---|---|---|---|
| `400 Bad Request` | `VALIDATION_ERROR` | Schema validation fails on input fields (e.g. invalid email format, `parentName` length `< 2` or `> 100`, invalid date/time format). | `{"success":false,"error":{"code":"VALIDATION_ERROR","message":"Request payload validation failed.","issues":[{"field":"parentEmail","message":"Please provide a valid email address"}]}}` | Display inline field error under the specific input without clearing user input. |
| `400 Bad Request` | `DST_TRANSITION_ERROR` | The requested local time falls into a DST clock change void or ambiguity. | `{"success":false,"error":{"code":"DST_TRANSITION_ERROR","message":"The selected time is nonexistent due to a Daylight Saving Time spring-forward transition."}}` | Prompt parent to select an adjacent time slot. |
| `409 Conflict` | `NO_MENTOR_AVAILABLE` | No mentor is scheduled at the requested time, or all candidate mentors became unavailable due to collisions or quota limits. | `{"success":false,"error":{"code":"NO_MENTOR_AVAILABLE","message":"No eligible mentors are available for the selected slot."}}` | Inform user that slot was taken; refresh slot availability; retain parent form details. |
| `409 Conflict` | `SLOT_CONFLICT` | A concurrent booking reserved the exact mentor interval simultaneously (caught by collision check or PostgreSQL exclusion constraint). | `{"success":false,"error":{"code":"SLOT_CONFLICT","message":"This time slot is no longer available. Another parent may have booked it. Please select another time."}}` | Reset selected slot, refresh slots query, and display friendly conflict banner. |
| `422 Unprocessable Entity` | `DAILY_QUOTA_EXCEEDED` | The mentor reached their strict 2-classes-per-day quota while the transaction was being processed. | `{"success":false,"error":{"code":"DAILY_QUOTA_EXCEEDED","message":"Mentor has already reached the maximum of 2 demo classes for this day."}}` | Automatically try next candidate mentor or request alternate time slot. |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Unexpected database error, deadlock timeout, or server malfunction. | Standard 500 error envelope. | Display retryable general error banner. |

---

### 3.4 `GET /api/bookings`

#### Purpose
Fetches the most recent trial-class bookings (up to 50 records) ordered chronologically descending. Used for auditing, verification testing, and confirmation validation without exposing internal database tables.

#### Request
- **Method:** `GET`
- **URL:** `/api/bookings`
- **Headers:** `Accept: application/json`
- **Query Parameters:** None
- **Body:** None

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "cm1book0001",
      "mentorId": "cm1mentor0001",
      "mentorName": "Aarav Sharma",
      "mentorEmail": "aarav.sharma@codeyoung.com",
      "mentorTimezone": "Asia/Kolkata",
      "parentName": "Sarah Jenkins",
      "parentEmail": "sarah.jenkins@example.com",
      "parentTimezone": "America/New_York",
      "startTimeUtc": "2026-10-15T18:00:00.000Z",
      "endTimeUtc": "2026-10-15T18:45:00.000Z",
      "parentLocalStart": "2026-10-15 14:00",
      "parentLocalEnd": "2026-10-15 14:45",
      "mentorLocalStart": "2026-10-15 23:30",
      "mentorLocalEnd": "2026-10-16 00:15",
      "mentorLocalDate": "2026-10-15",
      "meetingLink": "https://meet.codeyoung.com/room/meet-1791702033-a8f9d2",
      "status": "CONFIRMED",
      "createdAt": "2026-10-11T09:44:00.000Z"
    }
  ]
}
```

#### Expected Errors
| Status | Code | Condition |
|---|---|---|
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Database connectivity failure. |

---

### 3.5 `GET /api/notifications`

#### Purpose
Retrieves the most recent records from the `NotificationOutbox` table (up to 50 records). Provides complete transparency into parent and mentor email generation, delivery status (`PENDING`, `PROCESSING`, `SENT`, `FAILED`), retry attempts, failure errors, and HTML email templates.

#### Request
- **Method:** `GET`
- **URL:** `/api/notifications`
- **Headers:** `Accept: application/json`
- **Query Parameters:** None
- **Body:** None

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "cm1notif0001",
      "bookingId": "cm1book0001",
      "recipientType": "PARENT",
      "recipientEmail": "sarah.jenkins@example.com",
      "recipientName": "Sarah Jenkins",
      "subject": "Confirmed: Codeyoung Trial Class with Aarav Sharma",
      "contentHtml": "<div style=\"font-family: sans-serif;\">...</div>",
      "status": "SENT",
      "retryCount": 0,
      "maxRetries": 3,
      "lastError": null,
      "scheduledFor": "2026-10-11T09:44:00.000Z",
      "sentAt": "2026-10-11T09:44:02.000Z",
      "createdAt": "2026-10-11T09:44:00.000Z"
    },
    {
      "id": "cm1notif0002",
      "bookingId": "cm1book0001",
      "recipientType": "MENTOR",
      "recipientEmail": "aarav.sharma@codeyoung.com",
      "recipientName": "Aarav Sharma",
      "subject": "New Demo Class Scheduled: Sarah Jenkins",
      "contentHtml": "<div style=\"font-family: sans-serif;\">...</div>",
      "status": "SENT",
      "retryCount": 0,
      "maxRetries": 3,
      "lastError": null,
      "scheduledFor": "2026-10-11T09:44:00.000Z",
      "sentAt": "2026-10-11T09:44:02.000Z",
      "createdAt": "2026-10-11T09:44:00.000Z"
    }
  ]
}
```

#### Expected Errors
| Status | Code | Condition |
|---|---|---|
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Database query failure. |

---

### 3.6 `POST /api/notifications`

#### Purpose
Executes the asynchronous Transactional Outbox worker manually. Pulls up to 20 `PENDING` notifications scheduled for now or earlier, attempts email dispatch via the `emailAdapter`, updates statuses to `SENT` or `FAILED`, and computes exponential backoff retry schedules for transient failures.

#### Request
- **Method:** `POST`
- **URL:** `/api/notifications`
- **Headers:** `Accept: application/json`
- **Query Parameters:** None
- **Body:** None

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Outbox worker processed pending notifications.",
  "data": {
    "processed": 2,
    "sent": 2,
    "failed": 0
  }
}
```

#### Expected Errors
| Status | Code | Condition |
|---|---|---|
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Outbox repository database failure. |

---

## 4. Frontend Integration Guidelines

1. **Handling `400` / `VALIDATION_ERROR`:**
   - Check if `error.issues` exists.
   - Map each `issue.field` directly to the corresponding form field error state (e.g., `fieldErrors.parentName = issue.message`).
   - Do **not** render a generic red banner if field-specific issues are present.
   - Clear the field error immediately when the user edits the input.

2. **Handling `409` / `SLOT_CONFLICT` or `NO_MENTOR_AVAILABLE`:**
   - Clear the currently selected slot (`selectedSlot = null`).
   - Re-fetch available slots using `GET /api/slots?date=...&timezone=...`.
   - Display a friendly inline alert: *"This time slot is no longer available. Another parent may have booked it. Please select another time."*
   - Retain all entered parent and student details so the user does not need to retype them.

3. **Handling Network or `500` Server Errors:**
   - Present a retryable alert banner: *"We couldn’t connect. Please check your connection and try again."* or *"Something went wrong while confirming your trial class. Please try again."*
   - Preserve all entered form values.
