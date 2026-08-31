import { business } from "@/lib/business";
import type { AppointmentWriteInput } from "@/lib/appointments/types";
import { isDateBookable, parseDateValue } from "@/lib/booking-slots";
import { normalizePhoneToE164 } from "@/lib/sms/phone";

export class AppointmentValidationError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "AppointmentValidationError";
    this.field = field;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertPlainObject(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new AppointmentValidationError("Invalid request body.");
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
    throw new AppointmentValidationError(`${field} is required.`, field);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new AppointmentValidationError(`${field} is required.`, field);
  }
  return trimmed;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
  field: string,
  min = 0,
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min) {
    throw new AppointmentValidationError(`${field} is invalid.`, field);
  }
  return value;
}

export function validateAppointmentId(id: string | undefined): string {
  if (!id || !UUID_PATTERN.test(id)) {
    throw new AppointmentValidationError("Invalid appointment id.");
  }
  return id;
}

export function validateCreateAppointmentInput(
  body: unknown,
): AppointmentWriteInput {
  const record = assertPlainObject(body);

  const petId = readString(record, "petId", "Pet", 80);
  if (!UUID_PATTERN.test(petId)) {
    throw new AppointmentValidationError("Invalid pet id.", "petId");
  }

  const serviceId = readString(record, "serviceId", "Service", 120);
  const serviceName = readString(record, "serviceName", "Service", 200);
  const appointmentDate = readString(
    record,
    "appointmentDate",
    "Appointment date",
    10,
  );
  const appointmentTime = readString(
    record,
    "appointmentTime",
    "Appointment time",
    40,
  );

  if (!DATE_PATTERN.test(appointmentDate)) {
    throw new AppointmentValidationError(
      "Appointment date must be YYYY-MM-DD.",
      "appointmentDate",
    );
  }

  if (!isDateBookable(parseDateValue(appointmentDate))) {
    throw new AppointmentValidationError(
      "That date is not available for booking.",
      "appointmentDate",
    );
  }

  const timePreferenceRaw = readString(
    record,
    "timePreference",
    "Time of day",
    20,
  );
  if (timePreferenceRaw !== "morning" && timePreferenceRaw !== "afternoon") {
    throw new AppointmentValidationError(
      "Please choose morning or afternoon.",
      "timePreference",
    );
  }

  const addressLat = readNumber(record, "addressLat", "Address location", -90);
  const addressLon = readNumber(record, "addressLon", "Address location", -180);
  if (addressLat < -90 || addressLat > 90 || addressLon < -180 || addressLon > 180) {
    throw new AppointmentValidationError(
      "We could not locate that address.",
      "address",
    );
  }

  const addressRecord = record.address;
  if (
    addressRecord == null ||
    typeof addressRecord !== "object" ||
    Array.isArray(addressRecord)
  ) {
    throw new AppointmentValidationError("Address is required.", "address");
  }

  const addressObj = addressRecord as Record<string, unknown>;

  const addOnIds = Array.isArray(record.addOnIds)
    ? record.addOnIds.filter((id): id is string => typeof id === "string")
    : [];

  const addOnOptions =
    record.addOnOptions != null &&
    typeof record.addOnOptions === "object" &&
    !Array.isArray(record.addOnOptions)
      ? Object.fromEntries(
          Object.entries(record.addOnOptions).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {};

  const travelDistanceMiles = readNumber(
    record,
    "travelDistanceMiles",
    "Travel distance",
  );
  const travelFee = readNumber(record, "travelFee", "Travel fee");
  const estimatedTotal = readNumber(record, "estimatedTotal", "Estimated total");
  const customerPhone = normalizePhoneToE164(
    readString(record, "customerPhone", "Mobile phone", 32),
  );
  if (!customerPhone) {
    throw new AppointmentValidationError(
      "Please enter a valid US mobile number so we can text appointment updates.",
      "customerPhone",
    );
  }
  if (record.smsConsent !== true) {
    throw new AppointmentValidationError(
      "Please confirm you agree to receive appointment text messages.",
      "smsConsent",
    );
  }
  if (record.photoMarketingConsent !== true) {
    throw new AppointmentValidationError(
      "Please confirm you consent to photographing and filming your pet for marketing.",
      "photoMarketingConsent",
    );
  }
  if (record.servicePoliciesConsent !== true) {
    throw new AppointmentValidationError(
      "Please confirm you have read and agree to the cancellation, rescheduling, payment, and incomplete service policies.",
      "servicePoliciesConsent",
    );
  }
  const paymentMethodId = readString(
    record,
    "paymentMethodId",
    "Payment method",
    80,
  );
  if (!UUID_PATTERN.test(paymentMethodId)) {
    throw new AppointmentValidationError(
      "Please select a saved payment method for this appointment.",
      "paymentMethodId",
    );
  }

  if (travelDistanceMiles > business.serviceArea.maxDistanceMiles) {
    throw new AppointmentValidationError(
      "Address is outside the service area.",
      "address",
    );
  }

  return {
    petId,
    serviceId,
    serviceName,
    addOnIds,
    addOnOptions,
    address: {
      street: readString(addressObj, "street", "Street", 200),
      city: readString(addressObj, "city", "City", 120),
      state: readString(addressObj, "state", "State", 40),
      zip: readString(addressObj, "zip", "ZIP code", 20),
    },
    travelDistanceMiles,
    travelFee,
    appointmentDate,
    appointmentTime,
    timePreference: timePreferenceRaw,
    addressLat,
    addressLon,
    estimatedTotal,
    paymentMethodId,
    customerPhone,
    referralCode:
      typeof record.referralCode === "string"
        ? record.referralCode.trim()
        : undefined,
  };
}
