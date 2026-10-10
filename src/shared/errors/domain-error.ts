export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST", details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class DstTransitionError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "DST_TRANSITION_ERROR", details);
    this.name = "DstTransitionError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 404, "NOT_FOUND", details);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, "SLOT_CONFLICT", details);
    this.name = "ConflictError";
  }
}

export class DailyQuotaExceededError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, "DAILY_QUOTA_EXCEEDED", details);
    this.name = "DailyQuotaExceededError";
  }
}

export class NoMentorAvailableError extends AppError {
  constructor(message = "No eligible mentors are available for the selected slot.", details?: unknown) {
    super(message, 409, "NO_MENTOR_AVAILABLE", details);
    this.name = "NoMentorAvailableError";
  }
}
