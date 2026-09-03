"use client";

import { useRef, useState } from "react";
import type { AccountField } from "@/lib/account-fields";
import type { PetProfile } from "@/lib/pets";
import { bookingFieldClass } from "@/components/booking/booking-ui";

type Props = {
  fields: AccountField[];
  pet: PetProfile;
  onPetChange: (updates: Partial<PetProfile>) => void;
  variant?: "account" | "booking";
  petPersisted?: boolean;
  vaccinationUploading?: boolean;
  onVaccinationUpload?: (file: File) => Promise<void>;
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
    case "vaccineExpiration":
      return { vaccineExpiration: value || undefined };
    default:
      return {};
  }
}

export function PetScalarFields({
  fields,
  pet,
  onPetChange,
  variant = "account",
  petPersisted = true,
  vaccinationUploading = false,
  onVaccinationUpload,
}: Props) {
  const inputClass = fieldInputClass(variant);
  const labelClass = fieldLabelClass(variant);
  const noteClass = fieldNoteClass(variant);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [addLater, setAddLater] = useState(false);

  async function handleVaccinationFileChange(file: File | null) {
    if (!file || !onVaccinationUpload) return;
    setUploadError(null);
    setAddLater(false);
    try {
      await onVaccinationUpload(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : "Could not upload this vaccination record.",
      );
    }
  }

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
          const uploaded = pet.vaccineRecordUploaded;
          const canUpload =
            petPersisted && !vaccinationUploading && Boolean(onVaccinationUpload);
          const addLaterClass = addLater
            ? variant === "booking"
              ? "inline-flex min-h-[36px] items-center justify-center rounded-sm border border-deep-lavender bg-dusty-lavender/30 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-ink"
              : "inline-flex items-center justify-center rounded-lg border border-gold bg-lavender-light/60 px-3 py-2 text-xs font-medium text-gold-dark"
            : variant === "booking"
              ? "inline-flex min-h-[36px] items-center justify-center rounded-sm border border-champagne bg-transparent px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-ink transition hover:border-ink"
              : "inline-flex items-center justify-center rounded-lg border border-lavender/60 bg-cream px-3 py-2 text-xs font-medium text-gold-dark transition hover:border-gold/70";
          return (
            <div key={field.id}>
              <label className={labelClass}>
                {field.label}
                {field.required && <span className="text-gold"> *</span>}
              </label>
              <div className="mt-1.5 rounded-xl border border-dashed border-lavender/60 bg-lavender-light/20 px-4 py-6 text-center">
                {uploaded ? (
                  <p
                    className={`text-sm ${
                      pet.vaccinationBookingStatus === "needs_review"
                        ? "font-medium text-red-700"
                        : "text-text"
                    }`}
                  >
                    Vaccination record on file
                    {pet.vaccinationBookingStatus === "needs_review" &&
                      " — pending staff review"}
                    {pet.vaccinationBookingStatus === "needs_attention" &&
                      " — please upload a new record"}
                    .
                  </p>
                ) : addLater ? (
                  <p className="text-sm text-text-muted">
                    You can add this later. A current record is required before
                    booking.
                  </p>
                ) : !petPersisted ? (
                  <p className="text-sm text-text-muted">
                    Save this pet profile to upload now, or add the record later.
                  </p>
                ) : (
                  <p className="text-sm text-text-muted">
                    Upload a current rabies certificate or vaccination record.
                  </p>
                )}
                {!uploaded && (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={
                        field.accept ?? ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                      }
                      disabled={!canUpload}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        void handleVaccinationFileChange(file);
                      }}
                      className="max-w-full text-xs text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-gold file:px-3 file:py-2 file:text-xs file:font-medium file:text-white disabled:opacity-60"
                    />
                    <button
                      type="button"
                      disabled={vaccinationUploading}
                      onClick={() => {
                        setUploadError(null);
                        setAddLater((current) => !current);
                      }}
                      className={addLaterClass}
                    >
                      Add later
                    </button>
                  </div>
                )}
                {vaccinationUploading && (
                  <p className="mt-2 text-xs text-text-muted">Uploading…</p>
                )}
              </div>
              {uploadError && (
                <p className={`${noteClass} text-red-700`} role="alert">
                  {uploadError}
                </p>
              )}
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
                value={getPetFieldValue(pet, field.id)}
                onChange={(event) =>
                  onPetChange(applyPetFieldUpdate(field.id, event.target.value))
                }
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
