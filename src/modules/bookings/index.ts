import { BookingService } from "./booking.service";
import { BookingDTO, CreateBookingInput } from "./booking.types";
import { CreateBookingSchema, CreateBookingPayload } from "./booking.validator";

export type { BookingDTO, CreateBookingInput, CreateBookingPayload };
export { CreateBookingSchema };

export const bookingsModule = new BookingService();
