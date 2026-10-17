"use client";

import React from "react";
import { AllergyFields } from "@/components/account/AllergyFields";
import { PetBirthdayFields } from "@/components/account/PetBirthdayFields";
import {
  bookingFieldClass,
  bookingLabelClass,
} from "@/components/booking/booking-ui";
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
  vaccinationAudience?: "customer" | "admin";
  onVaccinationUpload?: (file: File) => Promise<void>;
  showRequired?: boolean;
};

export function PetProfileFieldsForm({
  pet,
  onPetChange,
  variant = "account",
  petPersisted,
  vaccinationUploading,
  vaccinationAudience = "customer",
  onVaccinationUpload,
  showRequired = true,
}: Props) {
  return (
    <div className="space-y-5">
      <PetScalarFields
        fields={fieldsBeforeBirthday}
        pet={pet}
        onPetChange={onPetChange}
        variant={variant}
        showRequired={showRequired}
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
        showRequired={showRequired}
      />
      <AllergyFields
        name={`pet-allergy-${pet.id}`}
        status={pet.allergyStatus}
        details={pet.allergyDetails}
        onStatusChange={(allergyStatus) =>
          onPetChange({
            allergyStatus,
            allergyDetails: allergyStatus === "yes" ? pet.allergyDetails : "",
          })
        }
        onDetailsChange={(allergyDetails) => onPetChange({ allergyDetails })}
        inputClassName={variant === "booking" ? bookingFieldClass : undefined}
        labelClassName={variant === "booking" ? bookingLabelClass : undefined}
      />
    </div>
  );
}
