import type { PetProfile } from "@/lib/pets";

const MAX_DOG_AGE_YEARS = 30;

export function parseDateOfBirth(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function getPetAge(
  dateOfBirth: string | null | undefined,
  referenceDate: Date = new Date(),
): number | null {
  const birth = parseDateOfBirth(dateOfBirth);
  if (!birth) return null;

  let age = referenceDate.getFullYear() - birth.getFullYear();
  const monthDiff = referenceDate.getMonth() - birth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && referenceDate.getDate() < birth.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

/** Authoritative age in whole years — exact DOB, approximate date, then legacy age fields. */
export function getPetAgeYears(
  pet: Pick<
    PetProfile,
    "dateOfBirth" | "approximateDateOfBirth" | "approximateAgeYears" | "ageYears"
  >,
  referenceDate: Date = new Date(),
): number | null {
  if (pet.dateOfBirth) {
    return getPetAge(pet.dateOfBirth, referenceDate);
  }
  if (pet.approximateDateOfBirth) {
    return getPetAge(pet.approximateDateOfBirth, referenceDate);
  }
  if (typeof pet.approximateAgeYears === "number") {
    return pet.approximateAgeYears;
  }
  if (typeof pet.ageYears === "number") {
    return pet.ageYears;
  }
  return null;
}

export function formatPetAgeLabel(years: number): string {
  return years === 1 ? "1 year" : `${years} years`;
}

export function formatDateOfBirthDisplay(
  dateOfBirth: string,
  locale?: string,
): string {
  const date = parseDateOfBirth(dateOfBirth);
  if (!date) return dateOfBirth;

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function validateDateOfBirth(
  value: string,
  label = "date of birth",
): string | null {
  if (!value.trim()) return `Please enter your dog's ${label}.`;

  const date = parseDateOfBirth(value);
  if (!date) return "Please enter a valid date.";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date.getTime() > today.getTime()) {
    return "Date cannot be in the future.";
  }

  const oldest = new Date(today);
  oldest.setFullYear(oldest.getFullYear() - MAX_DOG_AGE_YEARS);
  if (date.getTime() < oldest.getTime()) {
    return `Please enter a date within the last ${MAX_DOG_AGE_YEARS} years.`;
  }

  return null;
}

export function validateApproximateDateOfBirth(value: string): string | null {
  return validateDateOfBirth(value, "approximate date");
}

export function usesApproximateBirthDate(
  pet: Pick<
    PetProfile,
    "dateOfBirth" | "approximateDateOfBirth" | "approximateAgeYears" | "ageYears"
  >,
): boolean {
  if (pet.dateOfBirth) return false;
  return (
    !!pet.approximateDateOfBirth ||
    typeof pet.approximateAgeYears === "number" ||
    typeof pet.ageYears === "number"
  );
}

/** @deprecated Use usesApproximateBirthDate */
export function usesApproximateAge(
  pet: Pick<
    PetProfile,
    "dateOfBirth" | "approximateDateOfBirth" | "approximateAgeYears" | "ageYears"
  >,
): boolean {
  return usesApproximateBirthDate(pet);
}

export function getPetBirthDateLabel(pet: PetProfile): string | null {
  if (pet.dateOfBirth) return formatDateOfBirthDisplay(pet.dateOfBirth);
  if (pet.approximateDateOfBirth) {
    return formatDateOfBirthDisplay(pet.approximateDateOfBirth);
  }
  if (typeof pet.approximateAgeYears === "number") {
    return formatPetAgeLabel(pet.approximateAgeYears);
  }
  return null;
}

export function getPetBirthDateHeading(pet: PetProfile): string | null {
  if (pet.dateOfBirth) return "Birthday";
  if (pet.approximateDateOfBirth) return "Approximate Birthday";
  if (typeof pet.approximateAgeYears === "number") return "Approximate Age";
  return null;
}
