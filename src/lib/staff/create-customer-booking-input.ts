import { isDateBookable, parseDateValue } from "@/lib/booking-slots";
import { isWithinServiceDay } from "@/lib/booking-schedule";
import { isOwnerEmail, normalizeStaffEmail } from "@/lib/staff/owner";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import {
  allBookableServices,
  isServiceAvailableForPet,
} from "@/lib/services";
import {
  PetValidationError,
  validateCreatePetInput,
  validatePetId,
} from "@/lib/pets/validation";
import type { PetWriteInput } from "@/lib/pets/types";

export class StaffBookingValidationError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "StaffBookingValidationError";
    this.field = field;
  }
}

export type StaffCustomerBookingAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

export type StaffBookingPetInput = PetWriteInput & {
  id: string | null;
  /** First selected service. Kept so a single-service booking stays easy to read. */
  serviceId: string | null;
  serviceIds: string[];
};

export type StaffCustomerBookingInput = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  notifyEmail: boolean;
  notifySms: boolean;
  mode: "invite" | "booking";
  pets: StaffBookingPetInput[];
  serviceId: string | null;
  serviceName: string | null;
  addOnIds: string[];
  appointmentDate: string | null;
  slotStartMinutes: number | null;
  address: StaffCustomerBookingAddress | null;
  verbalConsent: boolean;
};

function resolveBookableService(serviceIdRaw: string, field: string) {
  if (!serviceIdRaw) return null;
  const service = allBookableServices().find((entry) => entry.id === serviceIdRaw);
  if (!service || !service.bookableAsPrimary) {
    throw new StaffBookingValidationError(
      "Choose a bookable grooming service.",
      field,
    );
  }
  return service;
}

function readServiceIdValue(
  value: unknown,
  field: string,
): string {
  if (value == null || value === "") return "";
  if (typeof value !== "string") {
    throw new StaffBookingValidationError("Service must be text.", field);
  }
  const trimmed = value.trim();
  if (trimmed.length > 120) {
    throw new StaffBookingValidationError(
      "Service must be 120 characters or fewer.",
      field,
    );
  }
  return trimmed;
}

function readPetServiceIds(record: Record<string, unknown>, index: number) {
  const raw = record.serviceIds;
  const ids: string[] = [];
  if (raw != null) {
    if (!Array.isArray(raw)) {
      throw new StaffBookingValidationError(
        "Services must be a list.",
        `pets[${index}].serviceIds`,
      );
    }
    raw.forEach((value, serviceIndex) => {
      const serviceId = readServiceIdValue(
        value,
        `pets[${index}].serviceIds[${serviceIndex}]`,
      );
      if (serviceId) ids.push(serviceId);
    });
  }
  if (ids.length === 0) {
    const single = readServiceIdValue(
      record.serviceId,
      `pets[${index}].serviceId`,
    );
    if (single) ids.push(single);
  }
  const seen = new Set<string>();
  for (const serviceId of ids) {
    if (seen.has(serviceId)) {
      throw new StaffBookingValidationError(
        "Choose a different service for this dog.",
        `pets[${index}].serviceIds`,
      );
    }
    seen.add(serviceId);
  }
  return ids;
}

const MAX_STAFF_BOOKING_PETS = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertPlainObject(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new StaffBookingValidationError("Invalid request body.");
  }
  return value as Record<string, unknown>;
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
  field: string,
  maxLength: number,
): string {
  const value = record[key];
  if (value == null || value === "") return "";
  if (typeof value !== "string") {
    throw new StaffBookingValidationError(`${field} must be text.`, field);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new StaffBookingValidationError(
      `${field} must be ${maxLength} characters or fewer.`,
      field,
    );
  }
  return trimmed;
}

function readString(
  record: Record<string, unknown>,
  key: string,
  field: string,
  maxLength: number,
): string {
  const trimmed = readOptionalString(record, key, field, maxLength);
  if (!trimmed) {
    throw new StaffBookingValidationError(`${field} is required.`, field);
  }
  return trimmed;
}

function readBoolean(record: Record<string, unknown>, key: string) {
  return record[key] === true;
}

function readOptionalPetId(record: Record<string, unknown>, index: number) {
  const value = record.id;
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new StaffBookingValidationError("Pet not found.", `pets[${index}].id`);
  }
  try {
    return validatePetId(value);
  } catch (error) {
    if (error instanceof PetValidationError) {
      throw new StaffBookingValidationError(
        error.message,
        `pets[${index}].id`,
      );
    }
    throw error;
  }
}

function isBlankPetBody(petBody: unknown) {
  if (petBody == null || typeof petBody !== "object" || Array.isArray(petBody)) {
    return true;
  }
  const pet = petBody as Record<string, unknown>;
  const name = typeof pet.name === "string" ? pet.name.trim() : "";
  const breed = typeof pet.breed === "string" ? pet.breed.trim() : "";
  const weight =
    typeof pet.weightLbs === "number"
      ? pet.weightLbs
      : typeof pet.weightLbs === "string"
        ? Number(pet.weightLbs)
        : NaN;
  return !name && !breed && !(Number.isFinite(weight) && weight > 0);
}

export function staffCreatedAccountBlockReason(email: string) {
  if (isOwnerEmail(email)) {
    return "Use a customer email, not the owner account.";
  }
  return null;
}

export function validateStaffCustomerBookingInput(
  body: unknown,
): StaffCustomerBookingInput {
  const record = assertPlainObject(body);

  const firstName = readOptionalString(record, "firstName", "First name", 80);
  const lastName = readOptionalString(record, "lastName", "Last name", 80);

  const emailRaw = readOptionalString(record, "email", "Email", 200);
  const email = emailRaw ? normalizeStaffEmail(emailRaw) : null;
  if (emailRaw && (!email || !EMAIL_PATTERN.test(email))) {
    throw new StaffBookingValidationError(
      "Enter a valid customer email address.",
      "email",
    );
  }
  if (email) {
    const ownerBlock = staffCreatedAccountBlockReason(email);
    if (ownerBlock) {
      throw new StaffBookingValidationError(ownerBlock, "email");
    }
  }

  const phoneRaw = readOptionalString(record, "phone", "Mobile phone", 32);
  const phone = phoneRaw ? normalizePhoneToE164(phoneRaw) : null;
  if (phoneRaw && !phone) {
    throw new StaffBookingValidationError(
      "Enter a valid US mobile number.",
      "phone",
    );
  }

  if (!email && !phone) {
    throw new StaffBookingValidationError(
      "Enter a customer email or mobile phone number.",
      "contact",
    );
  }

  let notifyEmail = readBoolean(record, "notifyEmail");
  let notifySms = readBoolean(record, "notifySms");
  if (!notifyEmail && !notifySms) {
    notifyEmail = Boolean(email);
    notifySms = Boolean(phone);
  }
  if (notifyEmail && !email) notifyEmail = false;
  if (notifySms && !phone) notifySms = false;
  if (!notifyEmail && !notifySms) {
    throw new StaffBookingValidationError(
      "Enter a customer email or mobile phone number to send the booking link.",
      "contact",
    );
  }

  const verbalConsent = record.verbalConsent === true;

  const petsBody = Array.isArray(record.pets)
    ? record.pets
    : record.pet != null
      ? [record.pet]
      : [];
  const filledPetBodies = petsBody.filter((petBody) => !isBlankPetBody(petBody));
  if (filledPetBodies.length > MAX_STAFF_BOOKING_PETS) {
    throw new StaffBookingValidationError(
      `You can add up to ${MAX_STAFF_BOOKING_PETS} dogs on one booking.`,
      "pets",
    );
  }

  const serviceIdRaw = readOptionalString(record, "serviceId", "Service", 120);
  const sharedService = resolveBookableService(serviceIdRaw, "serviceId");
  const pets: StaffBookingPetInput[] = filledPetBodies.map((petBody, index) => {
    try {
      const petRecord = assertPlainObject(petBody);
      const id = readOptionalPetId(petRecord, index);
      const requestedServiceIds = readPetServiceIds(petRecord, index);
      const rest = { ...petRecord };
      delete rest.id;
      delete rest.serviceId;
      delete rest.serviceIds;
      const pet = validateCreatePetInput(rest);
      const chosenIds =
        requestedServiceIds.length > 0
          ? requestedServiceIds
          : sharedService
            ? [sharedService.id]
            : [];
      const serviceIds = chosenIds.map((serviceId, serviceIndex) => {
        const chosen = resolveBookableService(
          serviceId,
          requestedServiceIds.length > 0
            ? `pets[${index}].serviceIds[${serviceIndex}]`
            : "serviceId",
        );
        if (!chosen) {
          throw new StaffBookingValidationError(
            "Choose a bookable grooming service.",
            "serviceId",
          );
        }
        if (!isServiceAvailableForPet(chosen.id, pet.weightLbs)) {
          throw new StaffBookingValidationError(
            filledPetBodies.length > 1
              ? `That service is not available for dog ${index + 1}'s weight.`
              : "That service is not available for this dog's weight.",
            requestedServiceIds.length > 0
              ? `pets[${index}].serviceIds[${serviceIndex}]`
              : "serviceId",
          );
        }
        return chosen.id;
      });
      return {
        ...pet,
        id,
        serviceId: serviceIds[0] ?? null,
        serviceIds,
      };
    } catch (error) {
      if (error instanceof StaffBookingValidationError) throw error;
      if (error instanceof PetValidationError) {
        throw new StaffBookingValidationError(
          error.message,
          error.field ? `pets[${index}].${error.field}` : `pets[${index}]`,
        );
      }
      throw error;
    }
  });
  const primaryService =
    allBookableServices().find((entry) => entry.id === pets[0]?.serviceId) ??
    null;

  const appointmentDateRaw = readOptionalString(
    record,
    "appointmentDate",
    "Appointment date",
    10,
  );
  let appointmentDate: string | null = null;
  if (appointmentDateRaw) {
    if (!DATE_PATTERN.test(appointmentDateRaw)) {
      throw new StaffBookingValidationError(
        "Appointment date must be YYYY-MM-DD.",
        "appointmentDate",
      );
    }
    if (!isDateBookable(parseDateValue(appointmentDateRaw))) {
      throw new StaffBookingValidationError(
        "That date is not available for booking.",
        "appointmentDate",
      );
    }
    appointmentDate = appointmentDateRaw;
  }

  const slotStartRaw = record.slotStartMinutes;
  let slotStartMinutes: number | null = null;
  if (slotStartRaw != null && slotStartRaw !== "") {
    const parsed =
      typeof slotStartRaw === "number"
        ? slotStartRaw
        : typeof slotStartRaw === "string"
          ? Number(slotStartRaw)
          : NaN;
    if (!isWithinServiceDay(parsed)) {
      throw new StaffBookingValidationError(
        "Please choose an available start time.",
        "slotStartMinutes",
      );
    }
    slotStartMinutes = parsed;
  }

  const addressRecord = record.address;
  let address: StaffCustomerBookingAddress | null = null;
  if (
    addressRecord != null &&
    typeof addressRecord === "object" &&
    !Array.isArray(addressRecord)
  ) {
    const addressObj = addressRecord as Record<string, unknown>;
    const street = readOptionalString(addressObj, "street", "Street", 200);
    const city = readOptionalString(addressObj, "city", "City", 120);
    const state = readOptionalString(addressObj, "state", "State", 40);
    const zip = readOptionalString(addressObj, "zip", "ZIP code", 20);
    if (street || city || state || zip) {
      if (!street || !city || !state || !zip) {
        throw new StaffBookingValidationError(
          "Complete the street, city, state, and ZIP, or leave the address blank.",
          "address",
        );
      }
      address = { street, city, state, zip };
    }
  }

  const addOnIds = Array.isArray(record.addOnIds)
    ? record.addOnIds.filter((id): id is string => typeof id === "string")
    : [];

  const hasCompleteBooking = Boolean(
    pets.length > 0 &&
      pets.every((pet) => pet.serviceIds.length > 0) &&
      appointmentDate &&
      slotStartMinutes != null &&
      address,
  );

  return {
    firstName,
    lastName,
    email,
    phone,
    notifyEmail,
    notifySms,
    mode: hasCompleteBooking ? "booking" : "invite",
    pets,
    serviceId: primaryService?.id ?? null,
    serviceName: primaryService?.name ?? null,
    addOnIds,
    appointmentDate,
    slotStartMinutes,
    address,
    verbalConsent,
  };
}

const PAYMENT_METHOD_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateCustomerConfirmInput(body: unknown): {
  token: string;
  password: string | null;
  acceptPolicies: true;
  paymentMethodId: string | null;
} {
  const record = assertPlainObject(body);
  const token = readString(record, "token", "Confirmation link", 200);
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    throw new StaffBookingValidationError(
      "This confirmation link is not valid.",
      "token",
    );
  }

  if (record.acceptPolicies !== true) {
    throw new StaffBookingValidationError(
      "Please confirm this appointment and agree to the service policies.",
      "acceptPolicies",
    );
  }

  const passwordRaw = record.password;
  const paymentRaw = record.paymentMethodId;
  let paymentMethodId: string | null = null;
  if (paymentRaw != null && paymentRaw !== "") {
    if (typeof paymentRaw !== "string" || !PAYMENT_METHOD_ID_PATTERN.test(paymentRaw)) {
      throw new StaffBookingValidationError(
        "Select a saved card for this appointment.",
        "paymentMethodId",
      );
    }
    paymentMethodId = paymentRaw;
  }

  if (passwordRaw == null || passwordRaw === "") {
    return { token, password: null, acceptPolicies: true, paymentMethodId };
  }
  if (typeof passwordRaw !== "string") {
    throw new StaffBookingValidationError("Enter a password.", "password");
  }
  if (passwordRaw.length < 8) {
    throw new StaffBookingValidationError(
      "Use at least 8 characters for the password.",
      "password",
    );
  }
  return { token, password: passwordRaw, acceptPolicies: true, paymentMethodId };
}
