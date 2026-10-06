import { householdVisitKey } from "@/lib/referrals/address";
import {
  addDaysToIsoDate,
  hourInBusinessTimezone,
  todayInBusinessTimezone,
} from "@/lib/sms/schedule";

/**
 * A completed visit can receive each follow-up channel on the next three
 * business-calendar days. Monday's groom stays eligible Tuesday, Wednesday,
 * and Thursday. Friday no longer selects it.
 */
export const FOLLOW_UP_RETRY_DAYS = 3;

/** Follow-up cron may send from 10:00 onward in America/New_York, not only at 10:00. */
export const FOLLOW_UP_EARLIEST_HOUR = 10;

const MONEY_EPSILON = 0.009;

export type FollowUpCharge = {
  appointmentId: string;
  kind: string;
  status: string;
  total: number;
  refundedAmount: number;
};

export type FollowUpPet = {
  id: string;
  customerId: string;
  petName: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string;
  customerPhone: string | null;
  appointmentDate: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  status: string;
  serviceEndedAt: string | null;
  followupEmailSentAt: string | null;
  followupSmsSentAt: string | null;
  followupEmailClaimedAt: string | null;
  followupSmsClaimedAt: string | null;
};

export function isFollowUpSendHour(now: Date) {
  return hourInBusinessTimezone(now) >= FOLLOW_UP_EARLIEST_HOUR;
}

export function followUpServiceDateWindow(now: Date) {
  const today = todayInBusinessTimezone(now);
  return {
    start: addDaysToIsoDate(today, -FOLLOW_UP_RETRY_DAYS),
    end: addDaysToIsoDate(today, -1),
  };
}

export function followUpVisitKey(pet: FollowUpPet) {
  return householdVisitKey({
    customerId: pet.customerId,
    appointmentDate: pet.appointmentDate,
    addressStreet: pet.addressStreet,
    addressCity: pet.addressCity,
    addressState: pet.addressState,
    addressZip: pet.addressZip,
  });
}

export function isNoShowAppointment(charges: FollowUpCharge[]) {
  return charges.some(
    (charge) => charge.kind === "no_show" && charge.status === "paid",
  );
}

/** True when every paid service charge with a balance was refunded in full. */
export function isFullyRefundedServiceVisit(charges: FollowUpCharge[]) {
  const paidService = charges.filter(
    (charge) =>
      charge.kind === "service" &&
      charge.status === "paid" &&
      charge.total > MONEY_EPSILON,
  );
  if (paidService.length === 0) return false;
  return paidService.every(
    (charge) => charge.refundedAmount + MONEY_EPSILON >= charge.total,
  );
}

export function isHouseholdFollowUpPetEligible(
  pet: FollowUpPet,
  charges: FollowUpCharge[],
) {
  if (pet.status === "cancelled") return false;
  if (!pet.serviceEndedAt) return false;
  const mine = charges.filter((charge) => charge.appointmentId === pet.id);
  if (isNoShowAppointment(mine)) return false;
  if (isFullyRefundedServiceVisit(mine)) return false;
  return true;
}

export function groupHouseholdVisits(pets: FollowUpPet[]) {
  const groups = new Map<string, FollowUpPet[]>();
  for (const pet of pets) {
    const key = followUpVisitKey(pet);
    const current = groups.get(key);
    if (current) current.push(pet);
    else groups.set(key, [pet]);
  }
  return groups;
}

export function eligibleVisitPets(pets: FollowUpPet[], charges: FollowUpCharge[]) {
  return pets
    .filter((pet) => isHouseholdFollowUpPetEligible(pet, charges))
    .sort(
      (left, right) =>
        left.petName.localeCompare(right.petName) ||
        left.id.localeCompare(right.id),
    );
}

export function channelSentAt(pet: FollowUpPet, channel: "email" | "sms") {
  return channel === "email" ? pet.followupEmailSentAt : pet.followupSmsSentAt;
}
