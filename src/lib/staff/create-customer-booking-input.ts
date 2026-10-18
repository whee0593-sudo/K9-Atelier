import { isDateBookable, parseDateValue } from "@/lib/booking-slots";
import { isWithinServiceDay } from "@/lib/booking-schedule";
import { isOwnerEmail, normalizeStaffEmail } from "@/lib/staff/owner";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import {
  allBookableServices,
  CREATIVE_ACCENT_COLORING_ID,
  getAddOnService,
  getAvailableAddOns,
  getServicePriceEstimate,
  isCustomCreativeDesignSelection,
  MINI_TRIM_ALREADY_INCLUDED_MESSAGE,
  parseEnteredServicePrice,
  selectionRepeatsIncludedMiniTrim,
} from "@/lib/services";
import {
  parseStaffServiceSelection,
  staffMenuAllows,
} from "@/lib/staff/service-choice";
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
  /** Parallel to serviceIds. Set when a service has its own styles, such as coloring. */
  serviceOptionNames: (string | null)[];
  /** Parallel to serviceIds. Set when staff type a price for Custom Creative Design. */
  servicePrices: (number | null)[];
  /** Add-ons for this dog only. They are not copied onto the other dogs. */
  addOnIds: string[];
  addOnOptions: Record<string, string>;
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
  acknowledgeScheduleConflict: boolean;
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

function readAddOnIdList(value: unknown, field: string) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new StaffBookingValidationError("Add-ons must be a list.", field);
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    if (typeof item !== "string" || !item.trim() || item.trim().length > 120) {
      throw new StaffBookingValidationError(
        "Choose a valid add-on.",
        `${field}[${index}]`,
      );
    }
    const id = item.trim();
    const addOn = getAddOnService(id);
    if (
      !addOn ||
      (addOn.bookableAsPrimary && addOn.id !== CREATIVE_ACCENT_COLORING_ID)
    ) {
      throw new StaffBookingValidationError(
        "That add-on cannot be booked with this service.",
        `${field}[${index}]`,
      );
    }
    if (seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  });
  return ids;
}

function readAddOnOptions(value: unknown, field: string) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new StaffBookingValidationError("Add-on options must be a list of choices.", field);
  }
  const options: Record<string, string> = {};
  for (const [key, option] of Object.entries(value)) {
    if (key.startsWith("__")) continue;
    if (typeof option !== "string" || !option.trim()) continue;
    options[key] = option.trim();
  }
  return options;
}

function readOptionalMoney(value: unknown, field: string) {
  if (value == null || value === "") return null;
  const amount = parseEnteredServicePrice(value);
  if (amount == null || amount > 100000) {
    throw new StaffBookingValidationError("Enter a valid price.", field);
  }
  return amount;
}

function assertPricedAddOns(pet: StaffBookingPetInput, index: number) {
  if (pet.addOnIds.length === 0) return;
  const primaryId = pet.serviceIds[0] ?? pet.serviceId;
  if (!primaryId) return;
  const primary = allBookableServices().find((entry) => entry.id === primaryId);
  const available = new Set(
    getAvailableAddOns(primary?.categoryId ?? "", primaryId).map(
      (addOn) => addOn.id,
    ),
  );
  const serviceIds = new Set(pet.serviceIds);
  pet.addOnIds.forEach((id, addOnIndex) => {
    if (serviceIds.has(id) || !available.has(id)) {
      throw new StaffBookingValidationError(
        "That add-on cannot be booked with this service.",
        `pets[${index}].addOnIds`,
      );
    }
    const addOn = getAddOnService(id);
    const optionName = pet.addOnOptions[id];
    if (addOn?.options?.length) {
      const option = addOn.options.find((entry) => entry.name === optionName);
      if (!option || option.priceFrom == null) {
        throw new StaffBookingValidationError(
          "Choose an add-on style.",
          `pets[${index}].addOnOptions`,
        );
      }
    }
    if (
      !addOn ||
      getServicePriceEstimate(addOn, pet.weightLbs, optionName) == null
    ) {
      throw new StaffBookingValidationError(
        "We could not price this add-on.",
        `pets[${index}].addOnIds[${addOnIndex}]`,
      );
    }
  });
}

function readPetServicePrices(
  record: Record<string, unknown>,
  count: number,
  index: number,
) {
  const raw = record.servicePrices;
  if (raw == null) return Array.from({ length: count }, () => null);
  if (!Array.isArray(raw)) {
    throw new StaffBookingValidationError(
      "Prices must be a list.",
      `pets[${index}].servicePrices`,
    );
  }
  return Array.from({ length: count }, (_, serviceIndex) =>
    readOptionalMoney(
      raw[serviceIndex],
      `pets[${index}].servicePrices[${serviceIndex}]`,
    ),
  );
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
  const acknowledgeScheduleConflict = record.acknowledgeScheduleConflict === true;

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
  const addOnSpecified: boolean[] = [];
  const pets: StaffBookingPetInput[] = filledPetBodies.map((petBody, index) => {
    try {
      const petRecord = assertPlainObject(petBody);
      const id = readOptionalPetId(petRecord, index);
      const requestedServiceIds = readPetServiceIds(petRecord, index);
      const requestedPrices = readPetServicePrices(
        petRecord,
        requestedServiceIds.length,
        index,
      );
      const addOnIdsSpecified = Object.prototype.hasOwnProperty.call(
        petRecord,
        "addOnIds",
      );
      const petAddOnIds = addOnIdsSpecified
        ? readAddOnIdList(petRecord.addOnIds, `pets[${index}].addOnIds`)
        : [];
      const petAddOnOptions = readAddOnOptions(
        petRecord.addOnOptions,
        `pets[${index}].addOnOptions`,
      );
      const rest = { ...petRecord };
      delete rest.id;
      delete rest.serviceId;
      delete rest.serviceIds;
      delete rest.servicePrices;
      delete rest.addOnIds;
      delete rest.addOnOptions;
      const pet = validateCreatePetInput(rest);
      const chosenIds =
        requestedServiceIds.length > 0
          ? requestedServiceIds
          : sharedService
            ? [sharedService.id]
            : [];
      const selections = chosenIds.map((serviceId, serviceIndex) => {
        const field =
          requestedServiceIds.length > 0
            ? `pets[${index}].serviceIds[${serviceIndex}]`
            : "serviceId";
        const chosen = parseStaffServiceSelection(serviceId);
        if (!chosen) {
          throw new StaffBookingValidationError(
            "Choose a bookable grooming service.",
            field,
          );
        }
        if (!staffMenuAllows(chosen.serviceId, pet.weightLbs)) {
          throw new StaffBookingValidationError(
            filledPetBodies.length > 1
              ? `That service is not available for dog ${index + 1}'s weight.`
              : "That service is not available for this dog's weight.",
            field,
          );
        }
        return chosen;
      });
      if (
        selectionRepeatsIncludedMiniTrim(
          selections.map((selection) => selection.serviceId),
        )
      ) {
        throw new StaffBookingValidationError(
          MINI_TRIM_ALREADY_INCLUDED_MESSAGE,
          `pets[${index}].serviceIds`,
        );
      }
      const servicePrices = selections.map((selection, serviceIndex) =>
        isCustomCreativeDesignSelection(
          selection.serviceId,
          selection.optionName,
        )
          ? (requestedPrices[serviceIndex] ?? null)
          : null,
      );
      addOnSpecified.push(addOnIdsSpecified);
      return {
        ...pet,
        id,
        serviceId: selections[0]?.serviceId ?? null,
        serviceIds: selections.map((selection) => selection.serviceId),
        serviceOptionNames: selections.map((selection) => selection.optionName),
        servicePrices,
        addOnIds: petAddOnIds,
        addOnOptions: petAddOnOptions,
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
  const primaryLabel = parseStaffServiceSelection(
    pets[0]?.serviceOptionNames[0]
      ? `${pets[0]?.serviceId}::${pets[0]?.serviceOptionNames[0]}`
      : (pets[0]?.serviceId ?? ""),
  )?.label;

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

  const sharedAddOnIds = readAddOnIdList(record.addOnIds, "addOnIds");
  if (sharedAddOnIds.length > 0 && pets.length > 1) {
    throw new StaffBookingValidationError(
      "Choose add-ons for each dog. Add-ons are not applied to every dog.",
      "addOnIds",
    );
  }
  const resolvedPets = pets.map((pet, index) => {
    const ownList = addOnSpecified[index] === true;
    const addOnIds =
      ownList || pets.length !== 1 ? pet.addOnIds : sharedAddOnIds;
    const serviceIds =
      pet.serviceIds.length > 0
        ? pet.serviceIds
        : pet.serviceId
          ? [pet.serviceId]
          : [];
    if (selectionRepeatsIncludedMiniTrim(serviceIds, addOnIds)) {
      throw new StaffBookingValidationError(
        MINI_TRIM_ALREADY_INCLUDED_MESSAGE,
        ownList || pets.length !== 1 ? `pets[${index}].addOnIds` : "addOnIds",
      );
    }
    return { ...pet, addOnIds };
  });

  const hasCompleteBooking = Boolean(
    pets.length > 0 &&
      pets.every((pet) => pet.serviceIds.length > 0) &&
      appointmentDate &&
      slotStartMinutes != null &&
      address,
  );

  if (hasCompleteBooking) {
    resolvedPets.forEach((pet, petIndex) => {
      pet.serviceIds.forEach((serviceId, serviceIndex) => {
        if (
          !isCustomCreativeDesignSelection(
            serviceId,
            pet.serviceOptionNames[serviceIndex],
          )
        ) {
          return;
        }
        if (pet.servicePrices[serviceIndex] == null) {
          throw new StaffBookingValidationError(
            "Enter a price for Custom Creative Design.",
            `pets[${petIndex}].servicePrices[${serviceIndex}]`,
          );
        }
      });
      assertPricedAddOns(pet, petIndex);
    });
  }

  return {
    firstName,
    lastName,
    email,
    phone,
    notifyEmail,
    notifySms,
    mode: hasCompleteBooking ? "booking" : "invite",
    pets: resolvedPets,
    serviceId: primaryService?.id ?? null,
    serviceName: primaryLabel ?? primaryService?.name ?? null,
    addOnIds: sharedAddOnIds,
    appointmentDate,
    slotStartMinutes,
    address,
    verbalConsent,
    acknowledgeScheduleConflict,
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
