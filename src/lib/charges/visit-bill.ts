import { randomUUID } from "crypto";
import type { ChargeLineItem } from "@/lib/charges/types";

export type VisitCheckoutPet = {
  appointmentId: string;
  petName: string;
  serviceName: string;
  /** Booking snapshot. Catalog price changes must not replace this. */
  servicePrice: number | null;
  status: string;
  serviceEndedAt: string | null;
  addOns?: Array<{ label: string; amount: number; catalogId?: string }>;
};

export type VisitBillInput = {
  visitId: string;
  customerName: string;
  serviceDate: string;
  arrivalLabel: string;
  /** Canonical travel fee from visits.travel_fee. */
  travelFee: number;
  pets: VisitCheckoutPet[];
};

export type VisitBillSnapshot = {
  version: 1;
  visitId: string;
  customerName: string;
  serviceDate: string;
  arrivalLabel: string;
  pets: Array<{
    appointmentId: string;
    petName: string;
    serviceName: string;
    amount: number;
  }>;
  travelFee: number;
  subtotal: number;
  discount: number;
  tip: number;
  total: number;
  paidAt?: string | null;
  paymentMethodLabel?: string | null;
};

export type VisitPaymentStatus = "unpaid" | "pending" | "paid" | "failed";

export type ExistingVisitCharge = {
  status: "pending" | "paid" | "failed";
  hasSnapshot: boolean;
  appointmentId: string;
  /** A full refund is no longer an active grooming payment. */
  fullyRefunded?: boolean;
};

export type VisitChargeDecision = "create" | "already_paid" | "in_progress" | "legacy_paid";

function money(amount: number) {
  return Math.round(amount * 100) / 100;
}

function serviceNameOnLine(item: ChargeLineItem) {
  const petName = item.petName?.trim();
  const prefix = petName ? `${petName} — ` : "";
  if (prefix && item.label.startsWith(prefix)) return item.label.slice(prefix.length);
  return item.label;
}

export function isCompletedVisitPet(
  pet: Pick<VisitCheckoutPet, "status" | "serviceEndedAt">,
) {
  return pet.status !== "cancelled" && Boolean(pet.serviceEndedAt);
}

/**
 * Normal grooming checkout includes only dogs whose service actually finished.
 * A dog that is still in progress blocks the whole visit so the bill cannot
 * quietly omit them. Cancelled dogs are left off the service bill.
 */
export function buildVisitBill(input: VisitBillInput) {
  const cancelledPets = input.pets.filter((pet) => pet.status === "cancelled");
  const incompletePets = input.pets.filter(
    (pet) => pet.status !== "cancelled" && !pet.serviceEndedAt,
  );
  const eligiblePets = input.pets.filter(isCompletedVisitPet);
  const blocked = incompletePets.length > 0 || eligiblePets.length === 0;
  const blockedMessage =
    incompletePets.length > 0
      ? `Finish service for ${incompletePets.map((pet) => pet.petName).join(", ")} before collecting this visit.`
      : eligiblePets.length === 0
        ? "No completed dogs on this visit."
        : null;

  const petLineItems: ChargeLineItem[] = [];
  for (const pet of eligiblePets) {
    const amount = money(pet.servicePrice ?? 0);
    petLineItems.push({
      id: randomUUID(),
      label: `${pet.petName} — ${pet.serviceName}`,
      amount,
      listAmount: amount,
      catalogId: "visit-pet-service",
      referralCategory: "eligible_service",
      appointmentId: pet.appointmentId,
      petName: pet.petName,
    });
    for (const addOn of pet.addOns ?? []) {
      const addOnAmount = money(addOn.amount);
      petLineItems.push({
        id: randomUUID(),
        label: `${pet.petName} — ${addOn.label}`,
        amount: addOnAmount,
        listAmount: addOnAmount,
        catalogId: addOn.catalogId,
        referralCategory: "eligible_service",
        appointmentId: pet.appointmentId,
        petName: pet.petName,
      });
    }
  }

  const travelFee = money(Math.max(0, input.travelFee || 0));
  const travelLineItem: ChargeLineItem | null =
    travelFee > 0
      ? {
          id: randomUUID(),
          label: "Travel fee",
          amount: travelFee,
          catalogId: "travel-fee",
          referralCategory: "travel_fee",
        }
      : null;

  const lineItems = travelLineItem
    ? [...petLineItems, travelLineItem]
    : petLineItems;
  const subtotal = money(lineItems.reduce((sum, item) => sum + item.amount, 0));

  return {
    visitId: input.visitId,
    customerName: input.customerName,
    serviceDate: input.serviceDate,
    arrivalLabel: input.arrivalLabel,
    eligiblePets,
    cancelledPets,
    incompletePets,
    blocked,
    blockedMessage,
    petLineItems,
    travelLineItem,
    lineItems,
    travelFee,
    subtotal,
    servicedDogCount: eligiblePets.length,
  };
}

/** Tip and visit-level discount are applied once to the whole bill. */
export function visitBillTotal(input: {
  subtotal: number;
  discount?: number;
  tip?: number;
}) {
  const discount = money(Math.max(0, input.discount ?? 0));
  const tip = money(Math.max(0, input.tip ?? 0));
  return money(Math.max(0, input.subtotal - discount + tip));
}

export function chargedVisitSnapshot(input: {
  bill: ReturnType<typeof buildVisitBill>;
  lineItems: ChargeLineItem[];
  discount?: number;
  tip?: number;
  total: number;
  paidAt?: string | null;
  paymentMethodLabel?: string | null;
}): VisitBillSnapshot {
  const pets = input.lineItems
    .filter((item) => item.appointmentId && item.catalogId !== "travel-fee")
    .map((item) => ({
      appointmentId: item.appointmentId as string,
      petName: item.petName || item.label,
      serviceName: serviceNameOnLine(item),
      amount: money(item.amount),
    }));
  const travelLine = input.lineItems.find((item) => item.catalogId === "travel-fee");
  return {
    version: 1,
    visitId: input.bill.visitId,
    customerName: input.bill.customerName,
    serviceDate: input.bill.serviceDate,
    arrivalLabel: input.bill.arrivalLabel,
    pets,
    travelFee: money(travelLine?.amount ?? input.bill.travelFee),
    subtotal: money(input.lineItems.reduce((sum, item) => sum + item.amount, 0)),
    discount: money(input.discount ?? 0),
    tip: money(input.tip ?? 0),
    total: money(input.total),
    paidAt: input.paidAt ?? null,
    paymentMethodLabel: input.paymentMethodLabel ?? null,
  };
}

export function buildVisitBillSnapshot(input: {
  bill: ReturnType<typeof buildVisitBill>;
  discount?: number;
  tip?: number;
  total: number;
  paidAt?: string | null;
  paymentMethodLabel?: string | null;
}): VisitBillSnapshot {
  return {
    version: 1,
    visitId: input.bill.visitId,
    customerName: input.bill.customerName,
    serviceDate: input.bill.serviceDate,
    arrivalLabel: input.bill.arrivalLabel,
    pets: input.bill.eligiblePets.map((pet) => ({
      appointmentId: pet.appointmentId,
      petName: pet.petName,
      serviceName: pet.serviceName,
      amount: money(pet.servicePrice ?? 0),
    })),
    travelFee: input.bill.travelFee,
    subtotal: input.bill.subtotal,
    discount: money(input.discount ?? 0),
    tip: money(input.tip ?? 0),
    total: money(input.total),
    paidAt: input.paidAt ?? null,
    paymentMethodLabel: input.paymentMethodLabel ?? null,
  };
}

/** Money still collected. A full refund leaves the row paid, but it is not an active bill. */
export function isFullyRefundedPayment(total: number, refundedAmount: number) {
  const totalCents = Math.round(total * 100);
  const refundedCents = Math.round(refundedAmount * 100);
  return totalCents > 0 && refundedCents >= totalCents;
}

/**
 * A new normal grooming payment has to name the visit and freeze the bill.
 * No-show and cancellation charges stay on the appointment alone.
 */
export function serviceChargeHasVisitBill(input: {
  kind: string;
  visitId: string | null;
  hasSnapshot: boolean;
}) {
  if (input.kind !== "service") return true;
  return Boolean(input.visitId) && input.hasSnapshot;
}

export function decideVisitServiceCharge(
  existing: ExistingVisitCharge[],
): VisitChargeDecision {
  const active = existing.filter((charge) => !charge.fullyRefunded);
  if (active.some((charge) => charge.status === "pending" && charge.hasSnapshot)) {
    return "in_progress";
  }
  if (active.some((charge) => charge.status === "paid" && charge.hasSnapshot)) {
    return "already_paid";
  }
  if (active.some((charge) => charge.status === "paid" && !charge.hasSnapshot)) {
    return "legacy_paid";
  }
  return "create";
}

export function visitPaymentStatus(
  existing: ExistingVisitCharge[],
): VisitPaymentStatus {
  const decision = decideVisitServiceCharge(existing);
  if (decision === "already_paid" || decision === "legacy_paid") return "paid";
  if (decision === "in_progress") return "pending";
  if (existing.some((charge) => charge.status === "failed")) return "failed";
  return "unpaid";
}

/** One visit charge covers every dog on that visit. Legacy charges cover one dog. */
export function appointmentIdsCoveredByServiceCharges(input: {
  appointmentIdsByVisitId: Record<string, string[]>;
  charges: Array<{
    appointmentId: string;
    visitId: string | null;
    lineItems?: Array<{ appointmentId?: string }>;
  }>;
}) {
  const covered = new Set<string>();
  for (const charge of input.charges) {
    covered.add(charge.appointmentId);
    if (charge.visitId) {
      for (const id of input.appointmentIdsByVisitId[charge.visitId] ?? []) {
        covered.add(id);
      }
    }
    for (const item of charge.lineItems ?? []) {
      if (item.appointmentId) covered.add(item.appointmentId);
    }
  }
  return covered;
}
