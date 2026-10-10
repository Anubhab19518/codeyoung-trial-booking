import { SlotCalculatorService } from "./slot-calculator.service";
import { AvailableSlotDTO, GetAvailableSlotsParams } from "./scheduling.types";
import { GetSlotsQuerySchema, GetSlotsQueryParams } from "./scheduling.validator";

export type { AvailableSlotDTO, GetAvailableSlotsParams, GetSlotsQueryParams };
export { GetSlotsQuerySchema };

export const schedulingModule = new SlotCalculatorService();
