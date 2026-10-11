import { describe, it, expect } from "vitest";
import {
  handleBookingResponseError,
  handleBookingNetworkError,
} from "@/shared/errors/booking-error-handler";

describe("Frontend Booking Failure and Conflict Handling", () => {
  it("handles HTTP 409 Conflict with friendly message, non-retryable without slot reselection", () => {
    const error = handleBookingResponseError(409, {
      success: false,
      error: { code: "CONFLICT", message: "Mentor already booked" },
    });

    expect(error.type).toBe("conflict");
    expect(error.message).toBe(
      "This time slot is no longer available. Another parent may have booked it. Please select another time."
    );
    expect(error.retryable).toBe(false);
  });

  it("handles HTTP 400/422 Validation errors with field issue mapping and retryable state", () => {
    const error = handleBookingResponseError(400, {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid email format",
        issues: [
          { field: "parentEmail", message: "Must be a valid email address" },
          { field: "parentName", message: "Name is required" },
        ],
      },
    });

    expect(error.type).toBe("validation");
    expect(error.message).toBe("Invalid email format");
    expect(error.fieldErrors).toEqual({
      parentEmail: "Must be a valid email address",
      parentName: "Name is required",
    });
    expect(error.retryable).toBe(true);
  });

  it("handles general HTTP 400 validation error without field issues", () => {
    const error = handleBookingResponseError(400, {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request payload validation failed",
      },
    });

    expect(error.type).toBe("validation");
    expect(error.message).toBe("Request payload validation failed");
    expect(error.fieldErrors).toBeUndefined();
    expect(error.retryable).toBe(true);
  });

  it("handles HTTP 429 Rate Limit gracefully", () => {
    const error = handleBookingResponseError(429, {
      success: false,
      error: { code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded" },
    });

    expect(error.type).toBe("rate_limit");
    expect(error.message).toBe(
      "Too many booking attempts were made. Please wait a few moments and try again."
    );
    expect(error.retryable).toBe(true);
  });

  it("handles HTTP 500 or unexpected server errors without exposing internal stack traces", () => {
    const error = handleBookingResponseError(500, {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Database connection failed at pg_connect()",
        stack: "Error: at Query.run (/var/server/db.ts:124)",
      },
    });

    expect(error.type).toBe("server");
    expect(error.message).toBe(
      "Something went wrong while confirming your trial class. Please try again."
    );
    // Verifies technical stack trace or DB errors are never leaked
    expect(error.message).not.toContain("pg_connect");
    expect(error.message).not.toContain("stack");
    expect(error.retryable).toBe(true);
  });

  it("handles Network errors with connection guidance", () => {
    const error = handleBookingNetworkError();

    expect(error.type).toBe("network");
    expect(error.message).toBe(
      "We couldn’t connect. Please check your connection and try again."
    );
    expect(error.retryable).toBe(true);
  });
});
