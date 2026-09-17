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

export const CUSTOMER_ADMIN_NOTES_MAX_LENGTH = 8000;

export const CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS = {
  firstName: "First Name",
  lastName: "Last Name",
  phone: "Mobile Phone",
  email: "Email",
} as const;

export function missingCustomerProfileFieldLabels(input: {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
}): string[] {
  const missing: string[] = [];
  if (!input.firstName?.trim()) {
    missing.push(CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS.firstName);
  }
  if (!input.lastName?.trim()) {
    missing.push(CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS.lastName);
  }
  if (input.email !== undefined && !input.email?.trim()) {
    missing.push(CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS.email);
  }
  if (!input.phone?.trim()) {
    missing.push(CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS.phone);
  }
  return missing;
}

export function formatMissingProfileFieldsMessage(missing: string[]) {
  if (missing.length === 0) return null;
  return `This profile cannot be saved until you complete: ${missing.join(", ")}.`;
}

export function validateCustomerId(id: string | undefined): string {
  if (!id || !UUID_PATTERN.test(id)) {
    throw new ProfileValidationError("Invalid customer id.");
  }
  return id;
}

export function validateCustomerAdminNotes(body: unknown): string {
  const record = assertPlainObject(body);
  const notes = record.notes;
  if (notes == null) return "";
  if (typeof notes !== "string") {
    throw new ProfileValidationError("Notes must be text.", "notes");
  }
  if (notes.length > CUSTOMER_ADMIN_NOTES_MAX_LENGTH) {
    throw new ProfileValidationError("Notes are too long.", "notes");
  }
  return notes;
}

export function validateProfileWriteInput(body: unknown): CustomerProfileWriteInput {
  const record = assertPlainObject(body);
  const missing = missingCustomerProfileFieldLabels({
    firstName: typeof record.firstName === "string" ? record.firstName : "",
    lastName: typeof record.lastName === "string" ? record.lastName : "",
    phone: typeof record.phone === "string" ? record.phone : "",
  });
  const incompleteMessage = formatMissingProfileFieldsMessage(missing);
  if (incompleteMessage) {
    const firstField =
      missing[0] === CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS.firstName
        ? "firstName"
        : missing[0] === CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS.lastName
          ? "lastName"
          : "phone";
    throw new ProfileValidationError(incompleteMessage, firstField);
  }

  const firstName = readRequiredName(record, "firstName", "First Name");
  const lastName = readRequiredName(record, "lastName", "Last Name");
  const phoneRaw = readOptionalText(record, "phone", 32);
  if (!phoneRaw) {
    throw new ProfileValidationError(
      formatMissingProfileFieldsMessage([
        CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS.phone,
      ]) ?? "Mobile Phone is required.",
      "phone",
    );
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
