import { formatPrice } from "@/lib/business";
import { calculateTravelFee } from "@/lib/travel";
import {
  CREATIVE_ACCENT_COLORING_ID,
  CUSTOM_CREATIVE_DESIGN_GUEST_MESSAGE,
  getAddOnService,
  getAvailableAddOns,
  getServicePriceEstimate,
  isCustomCreativeDesignOption,
  isCustomCreativeDesignSelection,
  isServiceAvailableForPet,
  unavailableReason,
  allBookableServices,
  type BookableService,
} from "@/lib/services";
import { getServiceDisplayName } from "@/lib/service-display";
import { canonicalServiceId } from "@/lib/service-catalog";

export const BOOKING_PRICE_DISCLAIMER =
  "Your estimated total is based on the selected services and available pet information. Final pricing may vary depending on coat condition, time required, or additional care. Any additional charges will be discussed before proceeding.";

export const PRICE_CHANGED_CODE = "price_changed";

export const PRICE_CHANGED_MESSAGE =
  "The estimated total changed. Review the latest price, then confirm again.";

export const FULL_GROOM_ESTIMATE_NOTE =
  "Full Groom is estimated at the starting price for this weight, using the lowest coat type. Coat type is confirmed with you before the visit.";

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

export type BookingPricingBasis = "starting" | "hourly";

export type BookingPriceQuote = {
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  servicePriceLabel: string;
  estimateNote: string | null;
  pricingBasis: BookingPricingBasis;
  addOns: BookingPriceAddOn[];
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

  const available = new Set(
    getAvailableAddOns(service.categoryId, service.id).map((item) => item.id),
  );

  for (const id of input.addOnIds) {
    const addOn = getAddOnService(id);
    if (!addOn || !available.has(id)) {
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

function addOnAmount(
  addOn: BookableService,
  weightLbs: number,
  optionName: string | undefined,
) {
  if (addOn.options?.length) {
    const option = addOn.options.find((item) => item.name === optionName);
    if (!option || option.priceFrom == null) return null;
    return option.priceFrom;
  }
  return getServicePriceEstimate(addOn, weightLbs)?.from ?? null;
}

export function quoteGuestBooking(input: {
  serviceId: string;
  weightLbs: number;
  addOnIds: string[];
  addOnOptions: Record<string, string>;
  distanceMiles: number;
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

  const travel = calculateTravelFee(input.distanceMiles);
  if (!travel.withinServiceArea) {
    return {
      ok: false,
      code: "outside_area",
      message: "Address is outside the service area.",
    };
  }

  const serviceEstimate = getServicePriceEstimate(service, input.weightLbs);
  if (serviceEstimate == null) {
    return {
      ok: false,
      code: "unpriced",
      message: "We could not price this service.",
    };
  }

  const addOns: BookingPriceAddOn[] = [];
  for (const id of input.addOnIds) {
    const addOn = getAddOnService(id);
    if (!addOn) {
      return {
        ok: false,
        code: "invalid_addon",
        message: "That add-on cannot be booked with this service.",
      };
    }
    const price = addOnAmount(addOn, input.weightLbs, input.addOnOptions[id]);
    if (price == null) {
      return {
        ok: false,
        code: "unpriced",
        message: "We could not price this add-on.",
      };
    }
    addOns.push({
      id,
      name: getServiceDisplayName(addOn.id, addOn.name),
      price: bookingMoney(price),
      priceLabel: formatPrice(price),
    });
  }

  const servicePrice = bookingMoney(serviceEstimate.from);
  const addOnPrice = bookingMoney(
    addOns.reduce((sum, item) => sum + item.price, 0),
  );
  const travelFee = bookingMoney(travel.fee);
  const estimatedServicePrice = bookingMoney(servicePrice + addOnPrice);
  const estimatedTotal = bookingMoney(estimatedServicePrice + travelFee);
  const pricingBasis: BookingPricingBasis =
    service.pricingType === "hourly" ? "hourly" : "starting";
  const hourlyLabel = `From ${formatPrice(servicePrice)}/hour`;
  const servicePriceLabel =
    service.pricingType === "free"
      ? "Complimentary"
      : pricingBasis === "hourly"
        ? hourlyLabel
        : `From ${formatPrice(servicePrice)}`;
  const totalLabel =
    service.pricingType === "free"
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
        service.id === "custom-full-haircut"
          ? FULL_GROOM_ESTIMATE_NOTE
          : service.id === "hand-stripping"
            ? HAND_STRIPPING_ESTIMATE_NOTE
            : null,
      pricingBasis,
      addOns,
      addOnPrice,
      addOnLabel:
        addOns.length === 0
          ? "None"
          : addOns.map((item) => `${item.name} · ${item.priceLabel}`).join(", "),
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
