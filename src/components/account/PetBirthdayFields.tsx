"use client";

import { useId, useState } from "react";
import type { PetProfile } from "@/lib/pets";
import {
  formatDateOfBirthDisplay,
  formatPetAgeLabel,
  getPetAgeYears,
  getPetBirthDateHeading,
  getPetBirthDateLabel,
  usesApproximateBirthDate,
  validateApproximateDateOfBirth,
  validateDateOfBirth,
} from "@/lib/pet-age";

type PetAgeFields = Pick<
  PetProfile,
  "dateOfBirth" | "approximateDateOfBirth" | "approximateAgeYears" | "ageYears"
>;

type Props = {
  pet: PetAgeFields;
  onChange: (updates: Partial<PetProfile>) => void;
  inputClassName?: string;
  labelClassName?: string;
  noteClassName?: string;
  showCalculatedAge?: boolean;
};

function defaultInputClass() {
  return "mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm text-text placeholder:text-text-muted/50 outline-none transition focus:border-gold/60 focus:ring-1 focus:ring-gold/30";
}

export function PetBirthdayFields({
  pet,
  onChange,
  inputClassName = defaultInputClass(),
  labelClassName = "block text-sm font-medium text-text",
  noteClassName = "mt-1.5 text-xs text-text-muted",
  showCalculatedAge = true,
}: Props) {
  const dobInputId = useId();
  const approximateInputId = useId();
  const unknownCheckboxId = useId();

  const [dobError, setDobError] = useState<string | null>(null);
  const [approxError, setApproxError] = useState<string | null>(null);
  const [unknownDob, setUnknownDob] = useState(() =>
    usesApproximateBirthDate(pet),
  );

  const calculatedAge = getPetAgeYears(pet);
  const activeBirthDate = unknownDob
    ? pet.approximateDateOfBirth
    : pet.dateOfBirth;

  function handleUnknownToggle(checked: boolean) {
    setUnknownDob(checked);
    setDobError(null);
    setApproxError(null);

    if (checked) {
      onChange({
        dateOfBirth: null,
        approximateDateOfBirth: pet.approximateDateOfBirth ?? null,
        approximateAgeYears: null,
        ageYears: undefined,
      });
      return;
    }

    onChange({
      dateOfBirth: pet.dateOfBirth ?? null,
      approximateDateOfBirth: null,
      approximateAgeYears: null,
    });
  }

  function handleExactDateChange(value: string) {
    if (!value) {
      setDobError(null);
      onChange({ dateOfBirth: null });
      return;
    }

    const error = validateDateOfBirth(value);
    setDobError(error);
    if (error) return;

    onChange({
      dateOfBirth: value,
      approximateDateOfBirth: null,
      approximateAgeYears: null,
      ageYears: undefined,
    });
  }

  function handleApproximateDateChange(value: string) {
    if (!value) {
      setApproxError(null);
      onChange({ approximateDateOfBirth: null });
      return;
    }

    const error = validateApproximateDateOfBirth(value);
    setApproxError(error);
    if (error) return;

    onChange({
      dateOfBirth: null,
      approximateDateOfBirth: value,
      approximateAgeYears: null,
      ageYears: undefined,
    });
  }

  return (
    <div className="space-y-5">
      {!unknownDob && (
        <div>
          <label htmlFor={dobInputId} className={labelClassName}>
            Date of Birth
          </label>
          <input
            id={dobInputId}
            type="date"
            value={pet.dateOfBirth ?? ""}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => handleExactDateChange(event.target.value)}
            className={inputClassName}
          />
          <p className={noteClassName}>
            Your dog&apos;s date of birth helps us personalize age-appropriate
            care and recognize important milestones.
          </p>
          {dobError && (
            <p className="mt-1.5 text-xs text-red-700" role="alert">
              {dobError}
            </p>
          )}
        </div>
      )}

      <label
        htmlFor={unknownCheckboxId}
        className="flex min-h-[44px] items-start gap-3 text-sm text-text"
      >
        <input
          id={unknownCheckboxId}
          type="checkbox"
          checked={unknownDob}
          onChange={(event) => handleUnknownToggle(event.target.checked)}
          className="mt-1 rounded border-lavender"
        />
        <span>I don&apos;t know the exact date</span>
      </label>

      {unknownDob && (
        <div>
          <label htmlFor={approximateInputId} className={labelClassName}>
            Approximate Date
          </label>
          <input
            id={approximateInputId}
            type="date"
            value={pet.approximateDateOfBirth ?? ""}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) =>
              handleApproximateDateChange(event.target.value)
            }
            className={inputClassName}
            aria-describedby={`${approximateInputId}-note`}
          />
          <p id={`${approximateInputId}-note`} className={noteClassName}>
            An estimate is perfectly fine — choose the closest date you
            remember from the calendar.
          </p>
          {approxError && (
            <p className="mt-1.5 text-xs text-red-700" role="alert">
              {approxError}
            </p>
          )}
        </div>
      )}

      {showCalculatedAge && calculatedAge != null && !dobError && !approxError && (
        <div className="border-t border-lavender/20 pt-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
            Age
          </p>
          <p className="mt-1 text-sm text-text">
            {formatPetAgeLabel(calculatedAge)}
          </p>
          {activeBirthDate && (
            <p className="mt-1 text-xs text-text-muted">
              Based on {formatDateOfBirthDisplay(activeBirthDate)}
              {unknownDob ? " (approximate)" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function PetProfileAgeSummary({
  pet,
  compact = false,
}: {
  pet: PetProfile;
  compact?: boolean;
}) {
  const age = getPetAgeYears(pet);
  const birthDateLabel = getPetBirthDateLabel(pet);
  const birthDateHeading = getPetBirthDateHeading(pet);

  if (compact) {
    return (
      <p className="mt-1 text-sm text-text-muted">
        {pet.breed} · {pet.weightLbs} lbs
        {age != null ? ` · ${formatPetAgeLabel(age)}` : ""}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-text-muted">
        {pet.breed} · {pet.weightLbs} lbs
      </p>
      {birthDateLabel && birthDateHeading && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
            {birthDateHeading}
          </p>
          <p className="text-sm text-text">{birthDateLabel}</p>
        </div>
      )}
      {age != null && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
            Age
          </p>
          <p className="text-sm text-text">{formatPetAgeLabel(age)}</p>
        </div>
      )}
    </div>
  );
}
