"use client";

import { PetBirthdayFields } from "@/components/account/PetBirthdayFields";
import { PetScalarFields } from "@/components/account/PetScalarFields";
import { filterFieldsByAudience, getAccountSection } from "@/lib/account-fields";
import type { PetProfile } from "@/lib/pets";

const petSectionFields = filterFieldsByAudience(
  getAccountSection("pets")?.fields ?? [],
  "customer",
).filter((field) => field.id !== "ageYears");

const weightIndex = petSectionFields.findIndex((field) => field.id === "weightLbs");
const fieldsBeforeBirthday =
  weightIndex >= 0 ? petSectionFields.slice(0, weightIndex + 1) : [];
const fieldsAfterBirthday =
  weightIndex >= 0 ? petSectionFields.slice(weightIndex + 1) : petSectionFields;

type Props = {
  pet: PetProfile;
  onPetChange: (updates: Partial<PetProfile>) => void;
  variant?: "account" | "booking";
  petPersisted?: boolean;
  vaccinationUploading?: boolean;
  onVaccinationUpload?: (file: File) => Promise<void>;
};

export function PetProfileFieldsForm({
  pet,
  onPetChange,
  variant = "account",
  petPersisted,
  vaccinationUploading,
  onVaccinationUpload,
}: Props) {
  const bookingLabels =
    "font-body text-[10px] font-medium uppercase tracking-[0.14em] text-taupe";
  const bookingNotes = "font-body mt-1.5 text-xs text-taupe";

  return (
    <div className="space-y-5">
      <PetScalarFields
        fields={fieldsBeforeBirthday}
        pet={pet}
        onPetChange={onPetChange}
        variant={variant}
      />
      <PetBirthdayFields
        pet={pet}
        onChange={onPetChange}
        inputClassName={
          variant === "booking"
            ? "mt-1.5 w-full rounded-xl border border-champagne/30 bg-cream px-4 py-3 text-sm text-ink outline-none transition focus:border-champagne focus:ring-1 focus:ring-champagne/30"
            : undefined
        }
        labelClassName={
          variant === "booking"
            ? bookingLabels
            : undefined
        }
        noteClassName={variant === "booking" ? bookingNotes : undefined}
      />
      <PetScalarFields
        fields={fieldsAfterBirthday}
        pet={pet}
        onPetChange={onPetChange}
        variant={variant}
        petPersisted={petPersisted}
        vaccinationUploading={vaccinationUploading}
        onVaccinationUpload={onVaccinationUpload}
      />
    </div>
  );
}
