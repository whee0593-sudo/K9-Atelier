import { dollarsToCents } from "@/lib/charges/money";
import type { ChargeLineItem, ReferralChargeCategory } from "@/lib/charges/types";

export const NEW_CLIENT_DISCOUNT_BPS = 1000;

export const REFERRAL_CATEGORIES: ReferralChargeCategory[] = [
  "eligible_service",
  "travel_fee",
  "special_handling",
  "gratuity",
  "other_ineligible",
];

const CATALOG_CATEGORY: Record<string, ReferralChargeCategory> = {
  "travel-fee": "travel_fee",
  "behavior-fee": "special_handling",
  "flea-tick-fee": "special_handling",
  "no-show": "other_ineligible",
};

export function referralCategoryFromCatalogId(
  catalogId?: string | null,
): ReferralChargeCategory | null {
  if (!catalogId) return null;
  if (CATALOG_CATEGORY[catalogId]) return CATALOG_CATEGORY[catalogId];
  if (catalogId === "travel-fee") return "travel_fee";
  return "eligible_service";
}

export function resolveReferralCategory(item: {
  catalogId?: string;
  referralCategory?: ReferralChargeCategory;
}): ReferralChargeCategory {
  if (item.referralCategory) return item.referralCategory;
  if (item.catalogId) {
    return referralCategoryFromCatalogId(item.catalogId) ?? "other_ineligible";
  }
  return "other_ineligible";
}

export function isEligibleReferralLine(item: {
  catalogId?: string;
  referralCategory?: ReferralChargeCategory;
}) {
  return resolveReferralCategory(item) === "eligible_service";
}

export function eligibleServiceCents(items: ChargeLineItem[]) {
  return items.reduce((sum, item) => {
    if (!isEligibleReferralLine(item)) return sum;
    return sum + dollarsToCents(item.amount);
  }, 0);
}

export function excludedFeeCents(items: ChargeLineItem[]) {
  return items.reduce((sum, item) => {
    if (isEligibleReferralLine(item)) return sum;
    return sum + dollarsToCents(item.amount);
  }, 0);
}

export function newClientDiscountCents(eligibleCents: number) {
  return Math.floor((eligibleCents * NEW_CLIENT_DISCOUNT_BPS) / 10_000);
}

export type ReferralApplyMode = "full" | "custom" | "none";

export function quoteReferralApplication(input: {
  lineItems: ChargeLineItem[];
  tipAmount: number;
  availableCreditCents: number;
  mode: ReferralApplyMode;
  customDollars?: number;
  applyNewClientDiscount: boolean;
}) {
  const eligibleCents = eligibleServiceCents(input.lineItems);
  const excludedCents = excludedFeeCents(input.lineItems);
  const tipCents = dollarsToCents(input.tipAmount);
  const discountCents = input.applyNewClientDiscount
    ? newClientDiscountCents(eligibleCents)
    : 0;
  const creditEligibleCents = Math.max(0, eligibleCents - discountCents);
  const requestedCents =
    input.mode === "none"
      ? 0
      : input.mode === "full"
        ? input.availableCreditCents
        : dollarsToCents(Math.max(0, input.customDollars ?? 0));
  const creditCents = input.applyNewClientDiscount
    ? 0
    : Math.min(requestedCents, input.availableCreditCents, creditEligibleCents);

  let dueCents = excludedCents + tipCents + creditEligibleCents - creditCents;
  if (dueCents > 0 && dueCents < 50 && creditCents > 0) {
    const reduce = 50 - dueCents;
    return {
      availableCreditCents: input.availableCreditCents,
      eligibleCents,
      excludedCents,
      tipCents,
      discountCents,
      creditCents: Math.max(0, creditCents - reduce),
      dueCents: 50,
      originalCents: eligibleCents + excludedCents + tipCents,
    };
  }

  return {
    availableCreditCents: input.availableCreditCents,
    eligibleCents,
    excludedCents,
    tipCents,
    discountCents,
    creditCents,
    dueCents: Math.max(0, dueCents),
    originalCents: eligibleCents + excludedCents + tipCents,
  };
}

export function centsToDollars(cents: number) {
  return Math.round(cents) / 100;
}
