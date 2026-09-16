import type { CustomerProfile } from "@/lib/profiles/types";
import { centsToDollars } from "@/lib/referrals/eligible";

export type AccountNavSummaryKey =
  | "overview"
  | "profile"
  | "addresses"
  | "pets"
  | "payment"
  | "referrals"
  | "bookings"
  | "password";

export type AccountNavSummaries = Record<AccountNavSummaryKey, string | null>;

export type AccountNavAppointmentInput = {
  appointmentDate: string;
  status: string;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressZip?: string | null;
};

export function emptyAccountNavSummaries(): AccountNavSummaries {
  return {
    overview: null,
    profile: null,
    addresses: null,
    pets: null,
    payment: null,
    referrals: null,
    bookings: null,
    password: null,
  };
}

export function isCustomerProfileComplete(
  profile: Pick<CustomerProfile, "firstName" | "lastName" | "email" | "phone">,
) {
  return Boolean(
    profile.firstName.trim() &&
      profile.lastName.trim() &&
      profile.email.trim() &&
      profile.phone.trim(),
  );
}

export function formatCompletionStatus(complete: boolean) {
  return complete ? "Completed" : "Incomplete";
}

export function formatReferralCodeSummary(codes: string[]) {
  const code = codes.map((value) => value.trim()).find(Boolean);
  if (!code) return null;
  return `Referral code: ${code}`;
}

export function formatReferralRewardsSummary(creditCents: number) {
  return `$${centsToDollars(creditCents).toFixed(2)}`;
}

export function formatPetNamesSummary(names: string[]) {
  const cleaned = names.map((name) => name.trim()).filter(Boolean);
  if (cleaned.length === 0) return "None";
  return cleaned.join(", ");
}

export function formatAccountDate(iso: string) {
  const date = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function todayIsoDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function pickLastAppointmentDate(
  appointments: AccountNavAppointmentInput[],
  today = todayIsoDate(),
) {
  const active = appointments.filter(
    (appointment) =>
      appointment.status !== "cancelled" && appointment.appointmentDate,
  );
  if (active.length === 0) return null;

  const pastOrToday = active.filter(
    (appointment) => appointment.appointmentDate <= today,
  );
  const pool = pastOrToday.length > 0 ? pastOrToday : active;
  const pickLatest = pastOrToday.length > 0;

  return pool.reduce((current, appointment) => {
    if (pickLatest) {
      return appointment.appointmentDate > current
        ? appointment.appointmentDate
        : current;
    }
    return appointment.appointmentDate < current
      ? appointment.appointmentDate
      : current;
  }, pool[0].appointmentDate);
}

export function hasCompletedServiceAddress(
  appointments: AccountNavAppointmentInput[],
) {
  return appointments.some(
    (appointment) =>
      appointment.status !== "cancelled" &&
      Boolean(appointment.addressStreet?.trim()) &&
      Boolean(appointment.addressCity?.trim()) &&
      Boolean(appointment.addressZip?.trim()),
  );
}

export function buildAccountNavSummaries(input: {
  profile?: Pick<
    CustomerProfile,
    "firstName" | "lastName" | "email" | "phone"
  > | null;
  pets?: Array<{ name: string }> | null;
  paymentMethodCount?: number | null;
  appointments?: AccountNavAppointmentInput[] | null;
  referralCodes?: string[] | null;
  availableCreditCents?: number | null;
  today?: string;
}): AccountNavSummaries {
  const summaries = emptyAccountNavSummaries();

  if (input.referralCodes) {
    summaries.overview = formatReferralCodeSummary(input.referralCodes);
  }

  if (input.profile) {
    summaries.profile = formatCompletionStatus(
      isCustomerProfileComplete(input.profile),
    );
  }

  if (input.appointments) {
    summaries.addresses = formatCompletionStatus(
      hasCompletedServiceAddress(input.appointments),
    );
    const lastDate = pickLastAppointmentDate(
      input.appointments,
      input.today ?? todayIsoDate(),
    );
    summaries.bookings = lastDate ? formatAccountDate(lastDate) : "None";
  }

  if (input.pets) {
    summaries.pets = formatPetNamesSummary(input.pets.map((pet) => pet.name));
  }

  if (input.paymentMethodCount != null) {
    summaries.payment = formatCompletionStatus(input.paymentMethodCount > 0);
  }

  if (input.availableCreditCents != null) {
    summaries.referrals = formatReferralRewardsSummary(
      input.availableCreditCents,
    );
  }

  return summaries;
}
