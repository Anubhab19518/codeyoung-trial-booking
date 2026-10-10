import { NotificationService, BookingNotificationContext } from "./notification.service";
import { OutboxNotificationDTO, OutboxStatus } from "./notification.types";

export type { OutboxNotificationDTO, OutboxStatus, BookingNotificationContext };

export const notificationsModule = new NotificationService();
