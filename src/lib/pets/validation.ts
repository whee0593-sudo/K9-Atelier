import { parseDateOfBirth } from "@/lib/pet-age";
import {
  PET_SEX_OPTIONS,
  type PetWriteInput,
} from "@/lib/pets/types";

export class PetValidationError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "PetValidationError";
    this.field = field;
  }
}

const CREATE_FIELDS = [
  "name",
  "breed",
  "weightLbs",
  "dateOfBirth",
  "approximateAgeYears",
  "sex",
  "temperamentNotes",
  "healthComfortNotes",
  "groomingPreferences",
] as const;

const UPDATE_FIELDS = [...CREATE_FIELDS] as const;

const MAX_NAME_LENGTH = 80;
const MAX_BREED_LENGTH = 80;
const MAX_NOTES_LENGTH = 2000;
const MAX_WEIGHT_LBS = 200;
const MIN_WEIGHT_LBS = 0.1;
const MAX_APPROX_AGE_YEARS = 30;
const MIN_APPROX_AGE_YEARS = 0.1;

function assertPlainObject(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new PetValidationError("Invalid request body.");
  }
  return value as Record<string, unknown>;
}

export function assertKnownPetInputKeys(
  body: unknown,
  mode: "create" | "update",
): void {
  const record = assertPlainObject(body);
  const allowed = new Set<string>(
    mode === "create" ? CREATE_FIELDS : UPDATE_FIELDS,
  );

  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      throw new PetValidationError(`Unknown field: ${key}`, key);
    }
  }
}

function normalizeOptionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new PetValidationError(`${field} must be text.`, field);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new PetValidationError(
      `${field} must be ${maxLength} characters or fewer.`,
      field,
    );
  }
  return trimmed;
}

function normalizeRequiredText(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new PetValidationError(`${field} is required.`, field);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new PetValidationError(`${field} is required.`, field);
  }
  if (trimmed.length > maxLength) {
    throw new PetValidationError(
      `${field} must be ${maxLength} characters or fewer.`,
      field,
    );
  }
  return trimmed;
}

function normalizeWeightLbs(value: unknown): number {
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new PetValidationError("Weight must be a number.", "weightLbs");
    }
    value = parsed;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PetValidationError("Weight is required.", "weightLbs");
  }
  if (value <= 0 || value > MAX_WEIGHT_LBS) {
    throw new PetValidationError(
      `Weight must be greater than 0 and at most ${MAX_WEIGHT_LBS} lbs.`,
      "weightLbs",
    );
  }
  return Math.round(value * 10) / 10;
}

function normalizeDateOfBirth(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new PetValidationError("Date of birth must be a date string.", "dateOfBirth");
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = parseDateOfBirth(trimmed);
  if (!date) {
    throw new PetValidationError("Date of birth is invalid.", "dateOfBirth");
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() > today.getTime()) {
    throw new PetValidationError("Date of birth cannot be in the future.", "dateOfBirth");
  }
  return trimmed;
}

function normalizeApproximateAgeYears(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new PetValidationError(
        "Approximate age must be a number.",
        "approximateAgeYears",
      );
    }
    value = parsed;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PetValidationError(
      "Approximate age must be a number.",
      "approximateAgeYears",
    );
  }
  if (value < MIN_APPROX_AGE_YEARS || value > MAX_APPROX_AGE_YEARS) {
    throw new PetValidationError(
      `Approximate age must be between ${MIN_APPROX_AGE_YEARS} and ${MAX_APPROX_AGE_YEARS} years.`,
      "approximateAgeYears",
    );
  }
  return Math.round(value * 10) / 10;
}

function normalizeSex(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new PetValidationError("Sex must be a supported value.", "sex");
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!PET_SEX_OPTIONS.includes(trimmed as (typeof PET_SEX_OPTIONS)[number])) {
    throw new PetValidationError("Sex must be a supported value.", "sex");
  }
  return trimmed;
}

function assertBirthStrategy(
  dateOfBirth: string | null,
  approximateAgeYears: number | null,
): void {
  if (dateOfBirth && approximateAgeYears != null) {
    throw new PetValidationError(
      "Provide either date of birth or approximate age, not both.",
    );
  }
}

function validateWriteFields(
  body: Record<string, unknown>,
  mode: "create" | "update",
): PetWriteInput | Partial<PetWriteInput> {
  assertKnownPetInputKeys(body, mode);

  const required = mode === "create";
  const name =
    body.name !== undefined || required
      ? normalizeRequiredText(body.name, "name", MAX_NAME_LENGTH)
      : undefined;
  const breed =
    body.breed !== undefined || required
      ? normalizeRequiredText(body.breed, "breed", MAX_BREED_LENGTH)
      : undefined;
  const weightLbs =
    body.weightLbs !== undefined || required
      ? normalizeWeightLbs(body.weightLbs)
      : undefined;

  const dateOfBirth =
    body.dateOfBirth !== undefined
      ? normalizeDateOfBirth(body.dateOfBirth)
      : undefined;
  const approximateAgeYears =
    body.approximateAgeYears !== undefined
      ? normalizeApproximateAgeYears(body.approximateAgeYears)
      : undefined;

  const sex = body.sex !== undefined ? normalizeSex(body.sex) : undefined;
  const temperamentNotes =
    body.temperamentNotes !== undefined
      ? normalizeOptionalText(body.temperamentNotes, "temperamentNotes", MAX_NOTES_LENGTH)
      : undefined;
  const healthComfortNotes =
    body.healthComfortNotes !== undefined
      ? normalizeOptionalText(body.healthComfortNotes, "healthComfortNotes", MAX_NOTES_LENGTH)
      : undefined;
  const groomingPreferences =
    body.groomingPreferences !== undefined
      ? normalizeOptionalText(body.groomingPreferences, "groomingPreferences", MAX_NOTES_LENGTH)
      : undefined;

  const resolvedDate =
    dateOfBirth !== undefined ? dateOfBirth : mode === "create" ? null : undefined;
  const resolvedApprox =
    approximateAgeYears !== undefined
      ? approximateAgeYears
      : mode === "create"
        ? null
        : undefined;

  if (resolvedDate !== undefined && resolvedApprox !== undefined) {
    assertBirthStrategy(resolvedDate ?? null, resolvedApprox ?? null);
  }

  if (mode === "create") {
    assertBirthStrategy(resolvedDate ?? null, resolvedApprox ?? null);
    return {
      name: name!,
      breed: breed!,
      weightLbs: weightLbs!,
      dateOfBirth: resolvedDate ?? null,
      approximateAgeYears: resolvedApprox ?? null,
      sex: sex ?? null,
      temperamentNotes: temperamentNotes ?? null,
      healthComfortNotes: healthComfortNotes ?? null,
      groomingPreferences: groomingPreferences ?? null,
    };
  }

  if (
    name === undefined &&
    breed === undefined &&
    weightLbs === undefined &&
    dateOfBirth === undefined &&
    approximateAgeYears === undefined &&
    sex === undefined &&
    temperamentNotes === undefined &&
    healthComfortNotes === undefined &&
    groomingPreferences === undefined
  ) {
    throw new PetValidationError("No valid fields provided to update.");
  }

  const partial: Partial<PetWriteInput> = {};
  if (name !== undefined) partial.name = name;
  if (breed !== undefined) partial.breed = breed;
  if (weightLbs !== undefined) partial.weightLbs = weightLbs;
  if (dateOfBirth !== undefined) partial.dateOfBirth = dateOfBirth;
  if (approximateAgeYears !== undefined) {
    partial.approximateAgeYears = approximateAgeYears;
  }
  if (sex !== undefined) partial.sex = sex;
  if (temperamentNotes !== undefined) partial.temperamentNotes = temperamentNotes;
  if (healthComfortNotes !== undefined) {
    partial.healthComfortNotes = healthComfortNotes;
  }
  if (groomingPreferences !== undefined) {
    partial.groomingPreferences = groomingPreferences;
  }

  return partial as PetWriteInput;
}

export function validateCreatePetInput(body: unknown): PetWriteInput {
  return validateWriteFields(assertPlainObject(body), "create") as PetWriteInput;
}

export function validateUpdatePetInput(body: unknown): Partial<PetWriteInput> {
  return validateWriteFields(assertPlainObject(body), "update");
}

export function validatePetId(petId: string | undefined): string {
  if (!petId || !/^[0-9a-f-]{36}$/i.test(petId)) {
    throw new PetValidationError("Pet not found.");
  }
  return petId;
}
