import type { BookableService, ServiceOption, ServiceTier } from "@/lib/services";
import { coloringOptionDisplayNote } from "@/lib/service-page";

/**
 * Guests browsing Services do not receive the menu price table.
 * Duration and descriptions stay so the cards still render.
 */
export function serviceWithoutMenuPrices(service: BookableService): BookableService {
  const tiers = service.tiers?.map((tier) => {
    const { priceFrom: _priceFrom, ...rest } = tier;
    return rest as ServiceTier;
  });
  const options = service.options?.map((option) => {
    const { priceFrom: _priceFrom, note, ...rest } = option;
    const displayNote = coloringOptionDisplayNote(note);
    return {
      ...rest,
      ...(displayNote ? { note: displayNote } : {}),
    } as ServiceOption;
  });
  const next: BookableService = {
    ...service,
    ...(tiers ? { tiers } : {}),
    ...(options ? { options } : {}),
  };
  delete next.hourlyRate;
  delete next.flatRate;
  delete next.addOnMin;
  delete next.coatTypePrices;
  delete next.pricingNote;
  return next;
}
