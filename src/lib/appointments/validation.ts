import { guestBookingSelectionError, bookingMoney } from "@/lib/booking-price";
import { canonicalServiceId } from "@/lib/service-catalog";
import { spaGoalsForService } from "@/lib/spa-goals";
import {
  CREATIVE_ACCENT_COLORING_ID,
  CUSTOM_CREATIVE_DESIGN_GUEST_MESSAGE,
  isCustomCreativeDesignOption,
  isCustomCreativeDesignSelection,
} from "@/lib/services";
import type { AppointmentWriteInput } from "@/lib/appointments/types";
import { isBookingStartInFuture, isDateBookable, parseDateValue } from "@/lib/booking-slots";
import {
  isWithinServiceDay,
  preferenceFromStart,
} from "@/lib/booking-schedule";
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

  const serviceId = canonicalServiceId(
    readString(record, "serviceId", "Service", 120),
  );
  const spaGoals = spaGoalsForService(serviceId, record.spaGoals);
  if (!spaGoals.ok) {
    throw new AppointmentValidationError(spaGoals.message, "spaGoals");
  }
  const serviceName = readString(record, "serviceName", "Service", 200);
  const appointmentDate = readString(
    record,
    "appointmentDate",
    "Appointment date",
    10,
  );
  const appointmentTimeRaw = record.appointmentTime;
  const appointmentTime =
    typeof appointmentTimeRaw === "string" ? appointmentTimeRaw.trim() : "";

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

  const slotStartRaw = record.slotStartMinutes;
  const slotStartMinutes =
    typeof slotStartRaw === "number"
      ? slotStartRaw
      : typeof slotStartRaw === "string"
        ? Number(slotStartRaw)
        : NaN;
  if (
    !Number.isInteger(slotStartMinutes) ||
    !isWithinServiceDay(slotStartMinutes)
  ) {
    throw new AppointmentValidationError(
      "Please choose an available start time.",
      "slotStartMinutes",
    );
  }
  if (!isBookingStartInFuture(appointmentDate, slotStartMinutes)) {
    throw new AppointmentValidationError("Please choose a start time that has not passed.", "slotStartMinutes");
  }
  const timePreferenceRaw = preferenceFromStart(slotStartMinutes);

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

  // The browser still sends these numbers. They are not the service-area
  // decision and they are not stored. createAppointment measures the address
  // and prices the visit from that distance.
  const travelDistanceMiles = readNumber(
    record,
    "travelDistanceMiles",
    "Travel distance",
  );
  const travelFee = readNumber(record, "travelFee", "Travel fee");
  if (
    isCustomCreativeDesignSelection(serviceId, addOnOptions[serviceId]) ||
    isCustomCreativeDesignOption(addOnOptions[CREATIVE_ACCENT_COLORING_ID])
  ) {
    throw new AppointmentValidationError(
      CUSTOM_CREATIVE_DESIGN_GUEST_MESSAGE,
      "serviceId",
    );
  }

  const selectionError = guestBookingSelectionError({
    serviceId,
    addOnIds,
    addOnOptions,
  });
  if (selectionError) {
    throw new AppointmentValidationError(
      selectionError.message,
      selectionError.code === "invalid_addon" ? "addOnIds" : "serviceId",
    );
  }

  const submittedTotal = readNumber(record, "estimatedTotal", "Estimated total");
  // The confirmed total is checked against the catalog after the pet weight
  // and the measured driving distance are loaded. Do not rebuild it from the
  // browser's service price or travel fee.
  const estimatedTotal = bookingMoney(submittedTotal);
  const idempotencyKey = readString(
    record,
    "idempotencyKey",
    "Confirmation",
    80,
  );
  if (!UUID_PATTERN.test(idempotencyKey)) {
    throw new AppointmentValidationError(
      "Please review this appointment and confirm again.",
      "idempotencyKey",
    );
  }
  const customerFirstName = readString(
    record,
    "customerFirstName",
    "First Name",
    80,
  );
  const customerLastName = readString(
    record,
    "customerLastName",
    "Last Name",
    80,
  );
  const customerPhone = normalizePhoneToE164(
    readString(record, "customerPhone", "Mobile phone", 32),
  );
  if (!customerPhone) {
    throw new AppointmentValidationError(
      "Please enter a valid US mobile number so we can text appointment updates.",
      "customerPhone",
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

  return {
    petId,
    serviceId,
    serviceName,
    addOnIds,
    addOnOptions,
    spaGoals: spaGoals.goals,
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
    slotStartMinutes,
    timePreference: timePreferenceRaw,
    addressLat,
    addressLon,
    estimatedTotal,
    paymentMethodId,
    customerPhone,
    customerFirstName,
    customerLastName,
    idempotencyKey,
    referralCode:
      typeof record.referralCode === "string"
        ? record.referralCode.trim()
        : undefined,
  };
}
