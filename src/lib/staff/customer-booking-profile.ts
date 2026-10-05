import { phonesMatch } from "@/lib/sms/phone";

export type StaffBookingProfilePet = {
  id: string;
  name: string;
  breed: string;
  weightLbs: number;
};

export type StaffBookingProfileAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

export type StaffBookingProfile = {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  pets: StaffBookingProfilePet[];
  addresses: StaffBookingProfileAddress[];
};

export type BookingAddressStamp = StaffBookingProfileAddress & {
  createdAt: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isBookingCustomerId(value: string) {
  return UUID_PATTERN.test(value);
}

function samePhone(left: string, right: string) {
  const a = left.trim();
  const b = right.trim();
  if (a === b) return true;
  return phonesMatch(a, b);
}

/** Which customer file the booking form should load for the current contact fields. */
export function resolveBookingProfileQuery(input: {
  email: string;
  phone: string;
  prefillCustomerId?: string;
  prefillEmail?: string;
  prefillPhone?: string;
}): { customerId: string } | { email: string } | { phone: string } | null {
  const email = input.email.trim();
  const phone = input.phone.trim();
  const prefillEmail = input.prefillEmail?.trim() ?? "";
  const prefillPhone = input.prefillPhone?.trim() ?? "";
  const customerId = input.prefillCustomerId?.trim() ?? "";
  const contactUnchanged =
    email.toLowerCase() === prefillEmail.toLowerCase() &&
    samePhone(phone, prefillPhone);

  if (customerId && isBookingCustomerId(customerId) && contactUnchanged) {
    return { customerId };
  }
  if (EMAIL_PATTERN.test(email)) return { email };
  if (phone.replace(/\D/g, "").length >= 10) return { phone };
  return null;
}

export function bookingAddressKey(address: StaffBookingProfileAddress) {
  return [address.street, address.city, address.state, address.zip]
    .map((part) => part.trim().toLowerCase())
    .join("|");
}

export function formatBookingAddress(address: StaffBookingProfileAddress) {
  const cityLine = [address.city, address.state].filter(Boolean).join(", ");
  const withZip = [cityLine, address.zip].filter(Boolean).join(" ");
  return [address.street, withZip].filter(Boolean).join(", ");
}

export function bookingProfileStatusCopy(profile: {
  pets: unknown[];
  addresses: unknown[];
}) {
  const hasPets = profile.pets.length > 0;
  const hasAddress = profile.addresses.length > 0;
  if (hasPets && hasAddress) {
    return "Saved pets and address are filled in from this customer's file. You can edit them before sending.";
  }
  if (hasPets) {
    return "Saved pets are filled in from this customer's file. You can edit them before sending.";
  }
  if (hasAddress) {
    return "Saved address is filled in from this customer's file. You can edit it before sending.";
  }
  return null;
}

function hasAddressContent(address: StaffBookingProfileAddress) {
  return [address.street, address.city, address.state, address.zip].some(
    (part) => part.trim().length > 0,
  );
}

function toAddress(address: StaffBookingProfileAddress): StaffBookingProfileAddress {
  return {
    street: address.street.trim(),
    city: address.city.trim(),
    state: address.state.trim(),
    zip: address.zip.trim(),
  };
}

/**
 * Most recent visit address first, otherwise the newest saved address.
 * Remaining saved and visit addresses follow, without duplicates.
 */
export function orderBookingAddresses(
  saved: BookingAddressStamp[],
  visits: BookingAddressStamp[],
): StaffBookingProfileAddress[] {
  const byNewest = (left: BookingAddressStamp, right: BookingAddressStamp) =>
    right.createdAt.localeCompare(left.createdAt);
  const savedSorted = saved.filter(hasAddressContent).sort(byNewest);
  const visitSorted = visits.filter(hasAddressContent).sort(byNewest);
  const preferred = visitSorted[0] ?? savedSorted[0];
  if (!preferred) return [];

  const seen = new Set<string>();
  const ordered: StaffBookingProfileAddress[] = [];
  for (const address of [preferred, ...savedSorted, ...visitSorted]) {
    const next = toAddress(address);
    const key = bookingAddressKey(next);
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(next);
  }
  return ordered;
}

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

type PetRow = {
  id: string;
  name: string | null;
  breed: string | null;
  weight_lbs: number | string | null;
};

export function mapBookingProfile(input: {
  profile: ProfileRow;
  pets: PetRow[];
  savedAddresses: BookingAddressStamp[];
  visitAddresses: BookingAddressStamp[];
}): StaffBookingProfile {
  const pets: StaffBookingProfilePet[] = [];
  for (const pet of input.pets) {
    const name = pet.name?.trim() ?? "";
    const breed = pet.breed?.trim() ?? "";
    const weightLbs = Number(pet.weight_lbs);
    const weight = Number.isFinite(weightLbs) && weightLbs > 0 ? weightLbs : 0;
    if (!name && !breed && weight <= 0) continue;
    pets.push({
      id: pet.id,
      name,
      breed,
      weightLbs: weight,
    });
  }

  return {
    customerId: input.profile.id,
    firstName: input.profile.first_name?.trim() ?? "",
    lastName: input.profile.last_name?.trim() ?? "",
    email: input.profile.email?.trim() ?? "",
    phone: input.profile.phone?.trim() ?? "",
    pets,
    addresses: orderBookingAddresses(
      input.savedAddresses,
      input.visitAddresses,
    ),
  };
}
