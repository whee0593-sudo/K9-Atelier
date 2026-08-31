import { phonesMatch } from "@/lib/sms/phone";
import {
  compareServiceAddresses,
  type AddressCompare,
} from "@/lib/referrals/address";

export type HouseholdIdentity = {
  customerId: string;
  email?: string | null;
  phone?: string | null;
  stripeCustomerId?: string | null;
};

export type HouseholdAddress = {
  street?: string | null;
  unit?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export type HouseholdMatchKind = "none" | "strong" | "weak";

export type HouseholdEligibility = {
  kind: HouseholdMatchKind;
  reason: string;
  eligibleForNewClientDiscount: boolean;
  reviewRequired: boolean;
};

export function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function identitiesStrongMatch(
  left: HouseholdIdentity,
  right: HouseholdIdentity,
) {
  if (left.customerId && left.customerId === right.customerId) return true;
  const leftEmail = normalizeEmail(left.email);
  const rightEmail = normalizeEmail(right.email);
  if (leftEmail && leftEmail === rightEmail) return true;
  if (phonesMatch(left.phone, right.phone)) return true;
  if (
    left.stripeCustomerId &&
    right.stripeCustomerId &&
    left.stripeCustomerId === right.stripeCustomerId
  ) {
    return true;
  }
  return false;
}

export function strongestAddressCompare(
  leftAddresses: HouseholdAddress[],
  rightAddresses: HouseholdAddress[],
): AddressCompare {
  let sawReview = false;
  for (const left of leftAddresses) {
    for (const right of rightAddresses) {
      const result = compareServiceAddresses(left, right);
      if (result === "same") return "same";
      if (result === "review") sawReview = true;
    }
  }
  return sawReview ? "review" : "different";
}

export function classifyHouseholdMatch(input: {
  current: HouseholdIdentity;
  currentAddresses: HouseholdAddress[];
  other: HouseholdIdentity;
  otherAddresses: HouseholdAddress[];
  otherHasPaidService: boolean;
}): HouseholdEligibility {
  if (identitiesStrongMatch(input.current, input.other)) {
    return {
      kind: "strong",
      reason: input.otherHasPaidService
        ? "strong_match_paid_history"
        : "strong_match",
      eligibleForNewClientDiscount: false,
      reviewRequired: false,
    };
  }

  const address = strongestAddressCompare(
    input.currentAddresses,
    input.otherAddresses,
  );
  if (address === "same" || address === "review") {
    return {
      kind: "weak",
      reason:
        address === "same"
          ? "full_address_match"
          : "address_unit_incomplete",
      eligibleForNewClientDiscount: false,
      reviewRequired: true,
    };
  }

  return {
    kind: "none",
    reason: "no_match",
    eligibleForNewClientDiscount: true,
    reviewRequired: false,
  };
}

export function reduceHouseholdEligibility(
  results: HouseholdEligibility[],
): HouseholdEligibility {
  const strongPaid = results.find(
    (row) => row.kind === "strong" && !row.eligibleForNewClientDiscount,
  );
  if (strongPaid) return strongPaid;
  const strong = results.find((row) => row.kind === "strong");
  if (strong) return strong;
  const weak = results.find((row) => row.kind === "weak");
  if (weak) return weak;
  return {
    kind: "none",
    reason: "no_match",
    eligibleForNewClientDiscount: true,
    reviewRequired: false,
  };
}
