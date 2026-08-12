"use client";

import type { AccountField } from "@/lib/account-fields";
import type { PetProfile } from "@/lib/pets";
import { bookingFieldClass } from "@/components/booking/booking-ui";

type Props = {
  fields: AccountField[];
  pet: PetProfile;
  onPetChange: (updates: Partial<PetProfile>) => void;
  variant?: "account" | "booking";
};

function fieldInputClass(variant: "account" | "booking") {
  return variant === "booking"
    ? bookingFieldClass
    : "mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm text-text placeholder:text-text-muted/50 outline-none transition focus:border-gold/60 focus:ring-1 focus:ring-gold/30";
}

function fieldLabelClass(variant: "account" | "booking") {
  return variant === "booking"
    ? "font-body text-[10px] font-medium uppercase tracking-[0.14em] text-taupe"
    : "block text-sm font-medium text-text";
}

function fieldNoteClass(variant: "account" | "booking") {
  return variant === "booking"
    ? "font-body mt-1.5 text-xs text-taupe"
    : "mt-1.5 text-xs text-text-muted";
}

function getPetFieldValue(pet: PetProfile, fieldId: string): string {
  switch (fieldId) {
    case "name":
      return pet.name;
    case "breed":
      return pet.breed;
    case "weightLbs":
      return pet.weightLbs > 0 ? String(pet.weightLbs) : "";
    case "sex":
      return pet.sex ?? "";
    case "temperament":
      return pet.temperament ?? "";
    case "medicalNotes":
      return pet.medicalNotes ?? "";
    case "groomingPreferences":
      return pet.groomingPreferences ?? "";
    case "vaccineExpiration":
      return pet.vaccineExpiration ?? "";
    default:
      return "";
  }
}

function applyPetFieldUpdate(
  fieldId: string,
  value: string,
): Partial<PetProfile> {
  switch (fieldId) {
    case "name":
      return { name: value };
    case "breed":
      return { breed: value };
    case "weightLbs": {
      const parsed = value.trim() === "" ? 0 : Number(value);
      return { weightLbs: Number.isFinite(parsed) ? parsed : 0 };
    }
    case "sex":
      return { sex: value || undefined };
    case "temperament":
      return { temperament: value || undefined };
    case "medicalNotes":
      return { medicalNotes: value || undefined };
    case "groomingPreferences":
      return { groomingPreferences: value || undefined };
    default:
      return {};
  }
}

export function PetScalarFields({
  fields,
  pet,
  onPetChange,
  variant = "account",
}: Props) {
  const inputClass = fieldInputClass(variant);
  const labelClass = fieldLabelClass(variant);
  const noteClass = fieldNoteClass(variant);

  return (
    <div className="space-y-5">
      {fields.map((field) => {
        if (field.type === "section-heading") {
          return (
            <div key={field.id} className="border-t border-lavender/30 pt-6">
              <h3 className="text-base font-medium text-gold-dark">
                {field.label}
              </h3>
              {field.note && (
                <p className={`${noteClass} mt-1`}>{field.note}</p>
              )}
            </div>
          );
        }

        if (field.type === "file") {
          return (
            <div key={field.id}>
              <label className={labelClass}>
                {field.label}
                {field.required && <span className="text-gold"> *</span>}
              </label>
              <div className="mt-1.5 rounded-xl border border-dashed border-lavender/60 bg-lavender-light/20 px-4 py-6 text-center">
                <p className="text-sm text-text-muted">
                  Upload coming soon — save your pet profile first.
                </p>
                <input type="file" disabled className="mt-3 text-xs text-text-muted" />
              </div>
              {field.note && <p className={noteClass}>{field.note}</p>}
            </div>
          );
        }

        if (field.type === "textarea") {
          return (
            <div key={field.id}>
              <label className={labelClass}>
                {field.label}
                {field.required && <span className="text-gold"> *</span>}
              </label>
              <textarea
                rows={3}
                value={getPetFieldValue(pet, field.id)}
                placeholder={field.placeholder}
                onChange={(event) =>
                  onPetChange(applyPetFieldUpdate(field.id, event.target.value))
                }
                className={`${inputClass} resize-none`}
              />
              {field.note && <p className={noteClass}>{field.note}</p>}
            </div>
          );
        }

        if (field.type === "select") {
          return (
            <div key={field.id}>
              <label className={labelClass}>
                {field.label}
                {field.required && <span className="text-gold"> *</span>}
              </label>
              <select
                value={getPetFieldValue(pet, field.id)}
                onChange={(event) =>
                  onPetChange(applyPetFieldUpdate(field.id, event.target.value))
                }
                className={inputClass}
              >
                <option value="">Select…</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {field.note && <p className={noteClass}>{field.note}</p>}
            </div>
          );
        }

        if (field.type === "date") {
          return (
            <div key={field.id}>
              <label className={labelClass}>
                {field.label}
                {field.required && <span className="text-gold"> *</span>}
              </label>
              <input
                type="date"
                readOnly
                value={getPetFieldValue(pet, field.id)}
                className={inputClass}
              />
              {field.note && <p className={noteClass}>{field.note}</p>}
            </div>
          );
        }

        return (
          <div key={field.id}>
            <label className={labelClass}>
              {field.label}
              {field.required && <span className="text-gold"> *</span>}
            </label>
            <input
              type={field.type === "number" ? "number" : "text"}
              value={getPetFieldValue(pet, field.id)}
              placeholder={field.placeholder}
              min={field.id === "weightLbs" ? 0.1 : undefined}
              max={field.id === "weightLbs" ? 200 : undefined}
              step={field.id === "weightLbs" ? 0.1 : undefined}
              onChange={(event) =>
                onPetChange(applyPetFieldUpdate(field.id, event.target.value))
              }
              className={inputClass}
            />
            {field.note && <p className={noteClass}>{field.note}</p>}
          </div>
        );
      })}
    </div>
  );
}
