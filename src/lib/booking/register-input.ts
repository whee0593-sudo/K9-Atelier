import {
  MIN_CUSTOMER_PASSWORD_LENGTH,
  ProfileValidationError,
  missingCustomerProfileFieldLabels,
  validateEmailAddress,
} from "@/lib/profiles/validation";
import { normalizePhoneToE164 } from "@/lib/sms/phone";

export type BookingRegisterInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
};

function assertPlainObject(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new ProfileValidationError("Invalid request body.");
  }
  return value as Record<string, unknown>;
}

function readRequiredName(record: Record<string, unknown>, key: string, field: string) {
  const value = record[key];
  if (typeof value !== "string") {
    throw new ProfileValidationError(`${field} is required.`, field);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) {
    throw new ProfileValidationError(`${field} is required.`, field);
  }
  return trimmed;
}

export function validateBookingPassword(value: unknown): string {
  if (typeof value !== "string" || value.length < MIN_CUSTOMER_PASSWORD_LENGTH) {
    throw new ProfileValidationError(
      `Use at least ${MIN_CUSTOMER_PASSWORD_LENGTH} characters for your password.`,
      "password",
    );
  }
  if (value.length > 72) {
    throw new ProfileValidationError("Password is too long.", "password");
  }
  return value;
}

export function validateBookingRegisterInput(body: unknown): BookingRegisterInput {
  const record = assertPlainObject(body);
  const firstName = readRequiredName(record, "firstName", "First Name");
  const lastName = readRequiredName(record, "lastName", "Last Name");
  const email = validateEmailAddress(record.email);
  const password = validateBookingPassword(record.password);

  const missing = missingCustomerProfileFieldLabels({
    firstName,
    lastName,
    phone: typeof record.phone === "string" ? record.phone : "",
    email,
  });
  if (missing.length > 0) {
    throw new ProfileValidationError(
      `Please complete: ${missing.join(", ")}.`,
      missing[0] === "Mobile Phone" ? "phone" : "email",
    );
  }

  const phone = normalizePhoneToE164(
    typeof record.phone === "string" ? record.phone : "",
  );
  if (!phone) {
    throw new ProfileValidationError(
      "Please enter a valid US mobile number so we can text appointment updates.",
      "phone",
    );
  }

  return { email, password, firstName, lastName, phone };
}
