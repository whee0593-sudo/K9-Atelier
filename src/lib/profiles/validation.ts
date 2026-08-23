import {
  EMERGENCY_RELATIONSHIP_OPTIONS,
  PREFERRED_CONTACT_OPTIONS,
  type CustomerProfileWriteInput,
} from "@/lib/profiles/types";
import { normalizePhoneToE164 } from "@/lib/sms/phone";

export class ProfileValidationError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "ProfileValidationError";
    this.field = field;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function readOptionalText(record: Record<string, unknown>, key: string, maxLength: number) {
  const value = record[key];
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export function validateCustomerId(id: string | undefined): string {
  if (!id || !UUID_PATTERN.test(id)) {
    throw new ProfileValidationError("Invalid customer id.");
  }
  return id;
}

export function validateProfileWriteInput(body: unknown): CustomerProfileWriteInput {
  const record = assertPlainObject(body);
  const firstName = readRequiredName(record, "firstName", "First name");
  const lastName = readRequiredName(record, "lastName", "Last name");
  const phoneRaw = readOptionalText(record, "phone", 32);
  if (!phoneRaw) {
    throw new ProfileValidationError("Mobile phone is required.", "phone");
  }
  const phone = normalizePhoneToE164(phoneRaw);
  if (!phone) {
    throw new ProfileValidationError("Please enter a valid US mobile number.", "phone");
  }

  const preferredContact = readOptionalText(record, "preferredContact", 40);
  if (
    preferredContact &&
    !PREFERRED_CONTACT_OPTIONS.includes(
      preferredContact as (typeof PREFERRED_CONTACT_OPTIONS)[number],
    )
  ) {
    throw new ProfileValidationError("Preferred contact method is invalid.", "preferredContact");
  }

  const emergencyContactRelationship = readOptionalText(
    record,
    "emergencyContactRelationship",
    40,
  );
  if (
    emergencyContactRelationship &&
    !EMERGENCY_RELATIONSHIP_OPTIONS.includes(
      emergencyContactRelationship as (typeof EMERGENCY_RELATIONSHIP_OPTIONS)[number],
    )
  ) {
    throw new ProfileValidationError(
      "Relationship is invalid.",
      "emergencyContactRelationship",
    );
  }

  return {
    firstName,
    lastName,
    phone,
    preferredContact,
    emergencyContactName: readOptionalText(record, "emergencyContactName", 80),
    emergencyContactPhone: readOptionalText(record, "emergencyContactPhone", 32),
    emergencyContactRelationship,
  };
}
