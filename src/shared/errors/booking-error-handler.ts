export interface BookingFailure {
  type: "conflict" | "validation" | "rate_limit" | "network" | "server";
  message: string;
  fieldErrors?: Record<string, string>;
  retryable: boolean;
}

export function handleBookingResponseError(status: number, json: any): BookingFailure {
  if (status === 409) {
    return {
      type: "conflict",
      message: "This time slot is no longer available. Another parent may have booked it. Please select another time.",
      retryable: false,
    };
  }

  if (status === 400 || status === 422) {
    const fieldErrors: Record<string, string> = {};
    if (json?.error?.issues && Array.isArray(json.error.issues)) {
      for (const issue of json.error.issues) {
        if (issue.field) {
          fieldErrors[issue.field] = issue.message;
        }
      }
    }
    const hasFieldErrors = Object.keys(fieldErrors).length > 0;
    return {
      type: "validation",
      message: json?.error?.message || "Please check your details and try again.",
      fieldErrors: hasFieldErrors ? fieldErrors : undefined,
      retryable: true,
    };
  }

  if (status === 429) {
    return {
      type: "rate_limit",
      message: "Too many booking attempts were made. Please wait a few moments and try again.",
      retryable: true,
    };
  }

  return {
    type: "server",
    message: "Something went wrong while confirming your trial class. Please try again.",
    retryable: true,
  };
}

export function handleBookingNetworkError(): BookingFailure {
  return {
    type: "network",
    message: "We couldn’t connect. Please check your connection and try again.",
    retryable: true,
  };
}
