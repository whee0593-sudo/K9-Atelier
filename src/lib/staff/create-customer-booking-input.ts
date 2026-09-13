import { isDateBookable, parseDateValue } from "@/lib/booking-slots";
import { listHourlyStartMinutes } from "@/lib/booking-schedule";
import { isOwnerEmail, normalizeStaffEmail } from "@/lib/staff/owner";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import {
  allBookableServices,
  isServiceAvailableForPet,
} from "@/lib/services";
import {
  PetValidationError,
  validateCreatePetInput,
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

export type StaffCustomerBookingInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notifyEmail: boolean;
  notifySms: boolean;
  pet: PetWriteInput;
  serviceId: string;
  serviceName: string;
  addOnIds: string[];
  appointmentDate: string;
  slotStartMinutes: number;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  verbalConsent: true;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertPlainObject(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new StaffBookingValidationError("Invalid request body.");
  }
  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
  field: string,
  maxLength: number,
): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new StaffBookingValidationError(`${field} is required.`, field);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new StaffBookingValidationError(`${field} is required.`, field);
  }
  return trimmed;
}

function readBoolean(record: Record<string, unknown>, key: string) {
  return record[key] === true;
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

  const firstName = readString(record, "firstName", "First name", 80);
  const lastName = readString(record, "lastName", "Last name", 80);
  const email = normalizeStaffEmail(
    readString(record, "email", "Email", 200),
  );
  if (!EMAIL_PATTERN.test(email)) {
    throw new StaffBookingValidationError(
      "Enter a valid customer email address.",
      "email",
    );
  }

  const ownerBlock = staffCreatedAccountBlockReason(email);
  if (ownerBlock) {
    throw new StaffBookingValidationError(ownerBlock, "email");
  }

  const phone = normalizePhoneToE164(
    readString(record, "phone", "Mobile phone", 32),
  );
  if (!phone) {
    throw new StaffBookingValidationError(
      "Enter a valid US mobile number so we can text the confirmation link.",
      "phone",
    );
  }

  const notifyEmail = readBoolean(record, "notifyEmail");
  const notifySms = readBoolean(record, "notifySms");
  if (!notifyEmail && !notifySms) {
    throw new StaffBookingValidationError(
      "Choose email, text message, or both for the confirmation link.",
      "notify",
    );
  }

  if (record.verbalConsent !== true) {
    throw new StaffBookingValidationError(
      "Confirm that the customer agreed to the policies and to receive this link.",
      "verbalConsent",
    );
  }

  const petBody = record.pet;
  let pet: PetWriteInput;
  try {
    pet = validateCreatePetInput(petBody);
  } catch (error) {
    if (error instanceof PetValidationError) {
      throw new StaffBookingValidationError(
        error.message,
        error.field ? `pet.${error.field}` : "pet",
      );
    }
    throw error;
  }

  const serviceId = readString(record, "serviceId", "Service", 120);
  const service = allBookableServices().find((entry) => entry.id === serviceId);
  if (!service || !service.bookableAsPrimary) {
    throw new StaffBookingValidationError(
      "Choose a bookable grooming service.",
      "serviceId",
    );
  }
  if (!isServiceAvailableForPet(serviceId, pet.weightLbs)) {
    throw new StaffBookingValidationError(
      "That service is not available for this dog's weight.",
      "serviceId",
    );
  }

  const appointmentDate = readString(
    record,
    "appointmentDate",
    "Appointment date",
    10,
  );
  if (!DATE_PATTERN.test(appointmentDate)) {
    throw new StaffBookingValidationError(
      "Appointment date must be YYYY-MM-DD.",
      "appointmentDate",
    );
  }
  if (!isDateBookable(parseDateValue(appointmentDate))) {
    throw new StaffBookingValidationError(
      "That date is not available for booking.",
      "appointmentDate",
    );
  }

  const slotStartRaw = record.slotStartMinutes;
  const slotStartMinutes =
    typeof slotStartRaw === "number"
      ? slotStartRaw
      : typeof slotStartRaw === "string"
        ? Number(slotStartRaw)
        : NaN;
  if (
    !Number.isInteger(slotStartMinutes) ||
    !listHourlyStartMinutes().includes(slotStartMinutes)
  ) {
    throw new StaffBookingValidationError(
      "Please choose an available start time.",
      "slotStartMinutes",
    );
  }

  const addressRecord = record.address;
  if (
    addressRecord == null ||
    typeof addressRecord !== "object" ||
    Array.isArray(addressRecord)
  ) {
    throw new StaffBookingValidationError("Address is required.", "address");
  }
  const addressObj = addressRecord as Record<string, unknown>;

  const addOnIds = Array.isArray(record.addOnIds)
    ? record.addOnIds.filter((id): id is string => typeof id === "string")
    : [];

  return {
    firstName,
    lastName,
    email,
    phone,
    notifyEmail,
    notifySms,
    pet,
    serviceId,
    serviceName: service.name,
    addOnIds,
    appointmentDate,
    slotStartMinutes,
    address: {
      street: readString(addressObj, "street", "Street", 200),
      city: readString(addressObj, "city", "City", 120),
      state: readString(addressObj, "state", "State", 40),
      zip: readString(addressObj, "zip", "ZIP code", 20),
    },
    verbalConsent: true,
  };
}

export function validateCustomerConfirmInput(body: unknown): {
  token: string;
  password: string | null;
  acceptPolicies: true;
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
  if (passwordRaw == null || passwordRaw === "") {
    return { token, password: null, acceptPolicies: true };
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
  return { token, password: passwordRaw, acceptPolicies: true };
}
