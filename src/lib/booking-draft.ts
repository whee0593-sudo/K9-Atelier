import type { PetProfile } from "@/lib/pets";
import type { BookableService } from "@/lib/services";
import type { ServiceAddress, TravelQuote } from "@/lib/travel";
import type { TimePreference } from "@/lib/booking-schedule";
import type { PaymentMethodRecord } from "@/lib/payments/types";

export const BOOKING_DRAFT_SESSION_KEY = "k9-booking-draft";

/** Mirrors BookingOwnerDetails without importing a client component into lib. */
export type BookingDraftOwner = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  smsConsent: boolean;
  photoMarketingConsent: boolean;
  servicePoliciesConsent: boolean;
};

export type BookingDraftSnapshot = {
  v: 1;
  draftPet: PetProfile;
  selectedPet: PetProfile | null;
  selectedService: BookableService | null;
  serviceConfirmed: boolean;
  careOptionsConfirmed: boolean;
  selectedAddOnIds: string[];
  addOnOptions: Record<string, string>;
  address: ServiceAddress | null;
  travelQuote: TravelQuote | null;
  appointmentDate: string | null;
  appointmentTime: string | null;
  timePreference: TimePreference | null;
  slotStartMinutes: number | null;
  owner: BookingDraftOwner | null;
  paymentMethod: PaymentMethodRecord | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isPetProfile(value: unknown): value is PetProfile {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.breed === "string" &&
    typeof value.weightLbs === "number" &&
    typeof value.vaccineRecordUploaded === "boolean"
  );
}

export function readBookingDraftSnapshot(): BookingDraftSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(BOOKING_DRAFT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookingDraftSnapshot;
    if (parsed?.v !== 1 || !isPetProfile(parsed.draftPet)) return null;
    if (parsed.selectedPet != null && !isPetProfile(parsed.selectedPet)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeBookingDraftSnapshot(snapshot: BookingDraftSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      BOOKING_DRAFT_SESSION_KEY,
      JSON.stringify(snapshot),
    );
  } catch {
    // Quota / private mode — booking still works without persistence.
  }
}

export function clearBookingDraftSnapshot() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(BOOKING_DRAFT_SESSION_KEY);
  } catch {
    // ignore
  }
}
