import { bookingCareChoicesForService, getBookingCareCategories, toggleBookingServiceIds } from "@/lib/booking-flow";
import { quoteGuestBooking } from "@/lib/booking-price";
import { creativeSelectionId, getAddOnService, isCreativeColoringCategory, isCustomCreativeDesignSelection, type BookableService } from "@/lib/services";
import type { FixedServicePrices } from "@/lib/pets/fixed-prices";

export type BookingServiceSelection = { serviceId: string; addOnIds: string[]; addOnOptions: Record<string, string> };
export function emptyBookingServiceSelection(): BookingServiceSelection {
  return { serviceId: "", addOnIds: [], addOnOptions: {} };
}

/** Shared by the main booking and add-dog flows: one primary, one color option, and compatible care extras. */
export function toggleBookingServiceSelection(current: BookingServiceSelection, service: BookableService, optionName?: string): BookingServiceSelection {
  if (isCustomCreativeDesignSelection(service.id, optionName)) return current;
  const id = optionName && isCreativeColoringCategory(service.categoryId) ? creativeSelectionId(optionName) : service.id;
  const ids = [...(current.serviceId ? [current.serviceId] : []), ...current.addOnIds];
  const removing = ids.includes(id) && (!optionName || current.addOnOptions[id] === optionName);
  const nextIds = toggleBookingServiceIds(ids, id);
  const primary = nextIds.map(getAddOnService).find(item => item?.bookableAsPrimary && !isCreativeColoringCategory(item.categoryId));
  const addOnOptions = Object.fromEntries(Object.entries(current.addOnOptions).filter(([key]) => nextIds.includes(key)));
  if (removing) delete addOnOptions[id];
  else if (optionName) addOnOptions[id] = optionName;
  return { serviceId: primary?.id ?? "", addOnIds: nextIds.filter(key => key !== primary?.id), addOnOptions };
}

/** Apply the same visible categories and pricing rules to submitted add-dog selections. */
export function quoteAddedDogServices(selection: BookingServiceSelection, weightLbs: number, fixedServicePrices?: FixedServicePrices) {
  const available = new Set(getBookingCareCategories(weightLbs, {includeMembersOnly:true}).flatMap(category =>
    category.services.flatMap(service => bookingCareChoicesForService(service).map(choice => choice.optionName ? creativeSelectionId(choice.optionName) : service.id)),
  ));
  if (!available.has(selection.serviceId) || selection.addOnIds.some(id => !available.has(id))) {
    return { ok: false as const, code: "invalid_service" as const, message: "Choose services available for this dog's weight." };
  }
  return quoteGuestBooking({ ...selection, weightLbs, distanceMiles: 0, fixedServicePrices });
}
