"use client";

import { AccountFieldsForm } from "@/components/account/AccountFieldsForm";
import { PetBirthdayFields } from "@/components/account/PetBirthdayFields";
import { filterFieldsByAudience, getAccountSection } from "@/lib/account-fields";
import type { PetProfile } from "@/lib/pets";
import { bookingFieldClass } from "@/components/booking/booking-ui";

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
};

export function PetProfileFieldsForm({
  pet,
  onPetChange,
  variant = "account",
}: Props) {
  const bookingLabels =
    "font-body text-[10px] font-medium uppercase tracking-[0.14em] text-taupe";
  const bookingNotes = "font-body mt-1.5 text-xs text-taupe";

  return (
    <div className="space-y-5">
      <AccountFieldsForm fields={fieldsBeforeBirthday} />
      <PetBirthdayFields
        pet={pet}
        onChange={onPetChange}
        inputClassName={
          variant === "booking"
            ? bookingFieldClass
            : "mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm text-text placeholder:text-text-muted/50 outline-none transition focus:border-gold/60 focus:ring-1 focus:ring-gold/30"
        }
        labelClassName={
          variant === "booking"
            ? bookingLabels
            : "block text-sm font-medium text-text"
        }
        noteClassName={
          variant === "booking" ? bookingNotes : "mt-1.5 text-xs text-text-muted"
        }
      />
      <AccountFieldsForm fields={fieldsAfterBirthday} />
    </div>
  );
}
