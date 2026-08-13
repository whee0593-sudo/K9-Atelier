import { MAX_VACCINATION_FILE_BYTES } from "@/lib/vaccinations/types";

export class VaccinationValidationError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "VaccinationValidationError";
    this.field = field;
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateVaccinationExpirationDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    throw new VaccinationValidationError(
      "Enter a valid expiration date (YYYY-MM-DD).",
      "expirationDate",
    );
  }
  return value;
}

export function validateVaccinationFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    throw new VaccinationValidationError(
      "Choose a vaccination file to upload.",
      "file",
    );
  }
  if (size > MAX_VACCINATION_FILE_BYTES) {
    throw new VaccinationValidationError(
      "File must be 4 MB or smaller.",
      "file",
    );
  }
}

export function sanitizeOriginalFilename(name: string) {
  const base = name.split(/[/\\]/).pop()?.trim() ?? "vaccination";
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
  return cleaned || "vaccination";
}
