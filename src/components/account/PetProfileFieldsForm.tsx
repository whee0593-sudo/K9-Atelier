"use client";

import React from "react";
import { PetBirthdayFields } from "@/components/account/PetBirthdayFields";
import { PetScalarFields } from "@/components/account/PetScalarFields";
import {
  bookingFieldClass,
  bookingHelperClass,
  bookingLabelClass,
} from "@/components/booking/booking-ui";
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
  vaccinationAudience?: "customer" | "admin";
  onVaccinationUpload?: (file: File) => Promise<void>;
};

export function PetProfileFieldsForm({
  pet,
  onPetChange,
  variant = "account",
  petPersisted,
  vaccinationUploading,
  vaccinationAudience = "customer",
  onVaccinationUpload,
}: Props) {
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
          variant === "booking" ? bookingFieldClass : undefined
        }
        labelClassName={
          variant === "booking" ? bookingLabelClass : undefined
        }
        noteClassName={
          variant === "booking" ? `mt-1.5 ${bookingHelperClass}` : undefined
        }
      />
      <PetScalarFields
        fields={fieldsAfterBirthday}
        pet={pet}
        onPetChange={onPetChange}
        variant={variant}
        petPersisted={petPersisted}
        vaccinationUploading={vaccinationUploading}
        vaccinationAudience={vaccinationAudience}
        onVaccinationUpload={onVaccinationUpload}
      />
    </div>
  );
}
