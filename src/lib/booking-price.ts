import { fixedPriceForService, type FixedServicePrices } from "@/lib/pets/fixed-prices";
import { formatPrice } from "@/lib/business";
import { calculateTravelFee } from "@/lib/travel";
import {
  CREATIVE_ACCENT_COLORING_ID,
  CUSTOM_CREATIVE_DESIGN_GUEST_MESSAGE,
  GENTLE_DEMATTING_EXCLUSION_NOTE,
  getAddOnService,
  bookingSelectionAvailability,
  getServicePriceEstimate,
  isCustomCreativeDesignOption,
  isCustomCreativeDesignSelection,
  isServiceAvailableForPet,
  resolveAddOnCharges,
  unavailableReason,
  allBookableServices,
} from "@/lib/services";
import { getServiceDisplayName } from "@/lib/service-display";
import { canonicalServiceId } from "@/lib/service-catalog";

export const BOOKING_PRICE_DISCLAIMER =
  "Your estimated total is based on your dog's weight and selected services. Final pricing may vary depending on coat condition, matting, additional handling needs, and any adjustments discussed with your groomer.";

export const PRICE_CHANGED_CODE = "price_changed";

export const PRICE_CHANGED_MESSAGE =
  "The estimated total changed. Review the latest price, then confirm again.";

export const FULL_GROOM_ESTIMATE_NOTE =
  "This estimate reflects the starting coat price for your dog's weight. The price may vary based on your dog's coat situation, which will be discussed with you before your appointment.";

export const HAND_STRIPPING_ESTIMATE_NOTE =
  "Hand Stripping is shown from the hourly rate. That rate is included once in this estimate and is not a fixed final price.";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type BookingPriceAddOn = {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
};

export type BookingAssessedAddOn = {
  id: string;
  name: string;
  note: string;
};

export type BookingPricingBasis = "starting" | "hourly" | "fixed";

export type BookingPriceQuote = {
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  servicePriceLabel: string;
  estimateNote: string | null;
  pricingBasis: BookingPricingBasis;
  addOns: BookingPriceAddOn[];
  assessedAddOns: BookingAssessedAddOn[];
  assessmentExclusionNote: string | null;
  addOnPrice: number;
  addOnLabel: string;
  travelDistanceMiles: number;
  travelFee: number;
  travelFeeLabel: string;
  estimatedServicePrice: number;
  estimatedTotal: number;
  totalLabel: string;
};

export type BookingPriceFailureCode =
  | "invalid_service"
  | "invalid_addon"
  | "weight_limit"
  | "unpriced"
  | "outside_area"
  | typeof PRICE_CHANGED_CODE;

type SelectionInput = {
  serviceId: string;
  addOnIds: string[];
  addOnOptions: Record<string, string>;
};

export function formatBookingDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return iso;
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

export function bookingMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function formatReviewMoney(amount: number) {
  return `$${bookingMoney(amount).toFixed(2)}`;
}

export function bookingTravelAreaCopy(zone: string, showPrices: boolean) {
  if (zone === "complimentary") {
    return {
      heading: "Your Address Is Within Our Service Area",
      body: "Your address is within our service area.",
      showFee: false,
    };
  }
  return {
    heading: "Extended Service Area",
    body: showPrices
      ? "An extended travel fee applies to this location."
      : "An extended travel fee applies. The fee will appear on Review & Confirm.",
    showFee: showPrices,
  };
}

function bookingCents(amount: number) {
  return Math.round(amount * 100);
}

export function guestBookingSelectionError(
  input: SelectionInput,
): { code: "invalid_service" | "invalid_addon"; message: string } | null {
  const service = allBookableServices().find(
    (item) => item.id === canonicalServiceId(input.serviceId),
  );
  if (
    !service ||
    !service.bookableAsPrimary ||
    service.id === CREATIVE_ACCENT_COLORING_ID
  ) {
    return {
      code: "invalid_service",
      message: "That service cannot be booked.",
    };
  }

  if (
    isCustomCreativeDesignSelection(
      input.serviceId,
      input.addOnOptions[input.serviceId],
    )
  ) {
    return {
      code: "invalid_service",
      message: CUSTOM_CREATIVE_DESIGN_GUEST_MESSAGE,
    };
  }

  if (new Set(input.addOnIds).size !== input.addOnIds.length) {
    return {
      code: "invalid_addon",
      message: "That add-on cannot be booked with this service.",
    };
  }

  const creativeChoices = input.addOnIds.filter((id) => getAddOnService(id)?.categoryId === CREATIVE_ACCENT_COLORING_ID);
  if (creativeChoices.length > 1) return { code: "invalid_addon", message: "Choose only one creative color option." };

  for (const id of input.addOnIds) {
    const addOn = getAddOnService(id);
    if (addOn?.categoryId === "bath-show-spa" || addOn?.categoryId === "full-grooming") {
      return { code: "invalid_service", message: "Choose only one bath or grooming service." };
    }
    const availability = bookingSelectionAvailability(service.id, input.addOnIds, id);
    if (!addOn || id === service.id || availability === "unavailable") {
      return {
        code: "invalid_addon",
        message: "That add-on cannot be booked with this service.",
      };
    }
    const optionName = input.addOnOptions[id];
    if (
      isCustomCreativeDesignSelection(id, optionName) ||
      isCustomCreativeDesignOption(optionName)
    ) {
      return {
        code: "invalid_addon",
        message: CUSTOM_CREATIVE_DESIGN_GUEST_MESSAGE,
      };
    }
    if (addOn.options?.length) {
      const option = addOn.options.find((item) => item.name === optionName);
      if (!option || option.consultationRequired || option.priceFrom == null) {
        return {
          code: "invalid_addon",
          message: "Choose an available option for each add-on.",
        };
      }
    }
  }

  return null;
}

export function quoteGuestBooking(input: {
  serviceId: string;
  weightLbs: number;
  addOnIds: string[];
  addOnOptions: Record<string, string>;
  distanceMiles: number;
  coatType?: string | null;
  fixedServicePrices?: FixedServicePrices;
}):
  | { ok: true; quote: BookingPriceQuote }
  | { ok: false; code: Exclude<BookingPriceFailureCode, "price_changed">; message: string } {
  const selection = guestBookingSelectionError(input);
  if (selection) return { ok: false, ...selection };

  const service = allBookableServices().find(
    (item) => item.id === canonicalServiceId(input.serviceId),
  );
  if (!service) {
    return { ok: false, code: "invalid_service", message: "That service cannot be booked." };
  }

  if (!isServiceAvailableForPet(service.id, input.weightLbs)) {
    return {
      ok: false,
      code: "weight_limit",
      message:
        unavailableReason(service.id, input.weightLbs) ??
        "That service is not available for this dog's weight.",
    };
  }

  for (const id of input.addOnIds) {
    const extra = getAddOnService(id);
    if (extra?.bookableAsPrimary && extra.categoryId !== CREATIVE_ACCENT_COLORING_ID && !isServiceAvailableForPet(extra.id, input.weightLbs)) {
      return { ok: false, code: "weight_limit", message: unavailableReason(extra.id, input.weightLbs) ?? "That service is not available for this dog's weight." };
    }
  }
  const travel = calculateTravelFee(input.distanceMiles);
  if (!travel.withinServiceArea) {
    return {
      ok: false,
      code: "outside_area",
      message: "Address is outside the service area.",
    };
  }

  const serviceEstimate = getServicePriceEstimate(
    service,
    input.weightLbs,
    undefined,
    input.coatType,
  );
  const fixedPrice = fixedPriceForService(input.fixedServicePrices, service.id);
  if (serviceEstimate == null && fixedPrice == null) {
    return {
      ok: false,
      code: "unpriced",
      message: "We could not price this service.",
    };
  }

  const resolvedAddOns = resolveAddOnCharges(
    service.id,
    input.addOnIds,
    input.weightLbs,
    input.addOnOptions,
  );
  if (resolvedAddOns.some((item) => item.kind === "unpriced")) {
    return {
      ok: false,
      code: "unpriced",
      message: "We could not price this add-on.",
    };
  }
  const addOns: BookingPriceAddOn[] = [];
  const assessedAddOns: BookingAssessedAddOn[] = [];
  for (const item of resolvedAddOns) {
    if (item.kind === "assessed") {
      assessedAddOns.push({ id: item.id, name: item.name, note: item.note });
      continue;
    }
    if (item.kind !== "priced") continue;
    addOns.push({
      id: item.id,
      name: item.name,
      price: bookingMoney(fixedPriceForService(input.fixedServicePrices, item.id) ?? item.amount),
      priceLabel: formatPrice(fixedPriceForService(input.fixedServicePrices, item.id) ?? item.amount),
    });
  }

  const servicePrice = bookingMoney(fixedPrice ?? serviceEstimate!.from);
  const addOnPrice = bookingMoney(
    addOns.reduce((sum, item) => sum + item.price, 0),
  );
  const travelFee = bookingMoney(travel.fee);
  const estimatedServicePrice = bookingMoney(servicePrice + addOnPrice);
  const estimatedTotal = bookingMoney(estimatedServicePrice + travelFee);
  const pricingBasis: BookingPricingBasis =
    fixedPrice != null ? "fixed" : service.pricingType === "hourly" ? "hourly" : "starting";
  const hourlyLabel = `From ${formatPrice(servicePrice)}/hour`;
  const servicePriceLabel =
    fixedPrice != null ? formatPrice(servicePrice) : service.pricingType === "free"
      ? "Complimentary"
      : pricingBasis === "hourly"
        ? hourlyLabel
        : `From ${formatPrice(servicePrice)}`;
  const totalLabel =
    fixedPrice != null ? formatPrice(estimatedTotal) : service.pricingType === "free"
      ? estimatedTotal === 0
        ? "Complimentary"
        : formatPrice(estimatedTotal)
      : pricingBasis === "hourly"
        ? travelFee === 0 && addOnPrice === 0
          ? hourlyLabel
          : `From ${formatPrice(estimatedTotal)}`
        : `From ${formatPrice(estimatedTotal)}`;

  return {
    ok: true,
    quote: {
      serviceId: service.id,
      serviceName: getServiceDisplayName(service.id, service.name),
      servicePrice,
      servicePriceLabel,
      estimateNote:
        fixedPrice != null ? null : service.id === "custom-full-haircut"
          ? FULL_GROOM_ESTIMATE_NOTE
          : service.id === "hand-stripping"
            ? HAND_STRIPPING_ESTIMATE_NOTE
            : null,
      pricingBasis,
      addOns,
      assessedAddOns,
      assessmentExclusionNote:
        assessedAddOns.length > 0 ? GENTLE_DEMATTING_EXCLUSION_NOTE : null,
      addOnPrice,
      addOnLabel:
        addOns.length + assessedAddOns.length === 0
          ? "None"
          : [
              ...addOns.map((item) => `${item.name} · ${item.priceLabel}`),
              ...assessedAddOns.map((item) => item.name),
            ].join(", "),
      travelDistanceMiles: travel.distanceMiles,
      travelFee,
      travelFeeLabel: travelFee === 0 ? "Complimentary" : formatPrice(travelFee),
      estimatedServicePrice,
      estimatedTotal,
      totalLabel,
    },
  };
}

export function evaluateSubmittedBookingPrice(
  input: SelectionInput & {
    distanceMiles: number;
    estimatedTotal: number;
  },
  weightLbs: number,
  fixedServicePrices?: FixedServicePrices,
):
  | { ok: true; quote: BookingPriceQuote }
  | {
      ok: false;
      code: BookingPriceFailureCode;
      message: string;
      quote?: BookingPriceQuote;
    } {
  const quoted = quoteGuestBooking({
    serviceId: input.serviceId,
    weightLbs,
    addOnIds: input.addOnIds,
    addOnOptions: input.addOnOptions,
    distanceMiles: input.distanceMiles,
    fixedServicePrices,
  });
  if (!quoted.ok) return quoted;
  if (bookingCents(input.estimatedTotal) !== bookingCents(quoted.quote.estimatedTotal)) {
    return {
      ok: false,
      code: PRICE_CHANGED_CODE,
      message: PRICE_CHANGED_MESSAGE,
      quote: quoted.quote,
    };
  }
  return quoted;
}

/** Hand Stripping copy for confirmation email. Other services return null. */
export function confirmationEstimateLabel(
  serviceId: string,
  estimatedTotal: number,
  travelFee: number,
) {
  if (serviceId !== "hand-stripping") return null;
  const hourly = allBookableServices().find((item) => item.id === serviceId)
    ?.hourlyRate;
  if (hourly == null) return null;
  if (travelFee === 0 && estimatedTotal === hourly) {
    return `From ${formatPrice(hourly)}/hour`;
  }
  return `From ${formatPrice(estimatedTotal)} (from ${formatPrice(hourly)}/hour)`;
}

/** One in-flight confirm. A second click while the first is running does nothing. */
export function createSubmitGuard() {
  let active = false;
  return {
    start() {
      if (active) return false;
      active = true;
      return true;
    },
    end() {
      active = false;
    },
  };
}
