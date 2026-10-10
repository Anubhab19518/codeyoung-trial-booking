export type OutboxStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED";

export interface OutboxNotificationDTO {
  id: string;
  bookingId: string;
  recipientType: string; // "PARENT" | "MENTOR"
  recipientEmail: string;
  recipientName: string;
  subject: string;
  contentHtml: string;
  status: OutboxStatus;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  scheduledFor: Date;
  sentAt: Date | null;
  createdAt: Date;
}

export interface EnqueueNotificationParams {
  bookingId: string;
  recipientType: "PARENT" | "MENTOR";
  recipientEmail: string;
  recipientName: string;
  subject: string;
  contentHtml: string;
}
