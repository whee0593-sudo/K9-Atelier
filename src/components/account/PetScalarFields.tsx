"use client";

import React, { useRef, useState } from "react";
import type { AccountField } from "@/lib/account-fields";
import type { PetProfile } from "@/lib/pets";
import {
  parsePetRabiesStatus,
  RABIES_STATUS_OPTIONS,
  type PetRabiesStatus,
} from "@/lib/vaccinations/booking";
import { bookingFieldClass } from "@/components/booking/booking-ui";

type Props = {
  fields: AccountField[];
  pet: PetProfile;
  onPetChange: (updates: Partial<PetProfile>) => void;
  variant?: "account" | "booking";
  petPersisted?: boolean;
  vaccinationUploading?: boolean;
  vaccinationAudience?: "customer" | "admin";
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
    ? "font-body mt-1.5 text-xs leading-relaxed text-taupe"
    : "mt-1.5 text-xs leading-relaxed text-text-muted";
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

async function openRabiesRecord(
  pet: PetProfile,
  audience: "customer" | "admin",
): Promise<string> {
  if (audience === "admin") {
    if (!pet.vaccinationLatestRecordId) {
      throw new Error("Rabies record not found.");
    }
  }
  const endpoint =
    audience === "admin"
      ? `/api/admin/vaccinations/${pet.vaccinationLatestRecordId}/file`
      : `/api/pets/${pet.id}/vaccinations/file`;
  const response = await fetch(endpoint, { credentials: "include" });
  const body = (await response.json()) as { error?: string; url?: string };
  if (!response.ok || !body.url) {
    throw new Error(body.error ?? "Could not open this rabies record.");
  }
  return body.url;
}

export function PetScalarFields({
  fields,
  pet,
  onPetChange,
  variant = "account",
  petPersisted = true,
  vaccinationUploading = false,
  vaccinationAudience = "customer",
  onVaccinationUpload,
}: Props) {
  const inputClass = fieldInputClass(variant);
  const labelClass = fieldLabelClass(variant);
  const noteClass = fieldNoteClass(variant);
  const showFieldNotes = variant === "booking";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState(false);
  const selectedRabiesStatus = parsePetRabiesStatus(pet.rabiesStatus);

  async function handleVaccinationFileChange(file: File | null) {
    if (!file || !onVaccinationUpload) return;
    setUploadError(null);
    try {
      await onVaccinationUpload(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : "Could not upload this rabies record.",
      );
    }
  }

  async function handleViewRecord() {
    setViewError(null);
    setViewingRecord(true);
    try {
      const url = await openRabiesRecord(pet, vaccinationAudience);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setViewError(
        err instanceof Error ? err.message : "Could not open this rabies record.",
      );
    } finally {
      setViewingRecord(false);
    }
  }

  return (
    <div className="space-y-5">
      {fields.map((field) => {
        if (field.type === "section-heading") {
          return (
            <div key={field.id} className="border-t border-lavender/30 pt-6">
              <h3
                className={
                  variant === "booking"
                    ? "font-body text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender"
                    : "text-base font-medium text-gold-dark"
                }
              >
                {field.label}
              </h3>
              {field.note && (
                <p className={`${noteClass} mt-2`}>{field.note}</p>
              )}
            </div>
          );
        }

        if (field.type === "radio" && field.id === "rabiesStatus") {
          const radioName = `rabies-status-${pet.id}`;
          return (
            <fieldset key={field.id} className="space-y-3">
              <legend className={labelClass}>
                {field.label}
                <span className="text-gold"> *</span>
              </legend>
              <div className="space-y-2">
                {RABIES_STATUS_OPTIONS.map((option) => {
                  const checked = selectedRabiesStatus === option.value;
                  const optionClass =
                    variant === "booking"
                      ? `flex cursor-pointer items-start gap-3 rounded-sm border px-4 py-3 text-sm transition ${
                          checked
                            ? "border-deep-lavender bg-dusty-lavender/25 ring-1 ring-champagne/40"
                            : "border-gray-line/80 bg-ivory hover:border-champagne/60"
                        }`
                      : `flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                          checked
                            ? "border-gold bg-lavender-light/50"
                            : "border-lavender/40 bg-cream hover:border-gold/50"
                        }`;
                  return (
                    <label key={option.value} className={optionClass}>
                      <input
                        type="radio"
                        name={radioName}
                        value={option.value}
                        checked={checked}
                        onChange={() =>
                          onPetChange({
                            rabiesStatus: option.value as PetRabiesStatus,
                          })
                        }
                        className="mt-0.5 accent-deep-lavender"
                      />
                      <span className={variant === "booking" ? "text-ink" : "text-text"}>
                        {option.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        }

        if (field.type === "file") {
          const uploaded = pet.vaccineRecordUploaded;
          const canUpload =
            petPersisted && !vaccinationUploading && Boolean(onVaccinationUpload);
          const canView = petPersisted && uploaded;
          return (
            <div key={field.id}>
              <label className={labelClass}>{field.label}</label>
              <div
                className={
                  variant === "booking"
                    ? "mt-2 rounded-sm border border-dashed border-champagne/50 bg-dusty-lavender/15 px-4 py-5"
                    : "mt-1.5 rounded-xl border border-dashed border-lavender/60 bg-lavender-light/20 px-4 py-6"
                }
              >
                <p
                  className={
                    variant === "booking"
                      ? "font-body text-sm text-ink"
                      : "text-sm text-text"
                  }
                >
                  {uploaded ? "On file" : "Not uploaded"}
                </p>
                <p className={`${noteClass} mt-1`}>
                  {field.note ??
                    "Optional · You may upload your dog’s current rabies certificate or vaccination record for your profile."}
                </p>
                {!petPersisted ? (
                  <p className={`${noteClass} mt-3`}>
                    Save this pet profile to upload a record, if you would like
                    one on file.
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {canView ? (
                    <button
                      type="button"
                      onClick={() => void handleViewRecord()}
                      disabled={viewingRecord}
                      className={
                        variant === "booking"
                          ? "inline-flex min-h-[36px] items-center justify-center rounded-sm border border-deep-lavender bg-dusty-lavender/30 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-ink disabled:opacity-60"
                          : "inline-flex items-center justify-center rounded-lg border border-gold bg-lavender-light/60 px-3 py-2 text-xs font-medium text-gold-dark disabled:opacity-60"
                      }
                    >
                      {viewingRecord ? "Opening…" : "View Document"}
                    </button>
                  ) : null}
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
                </div>
                {vaccinationUploading && (
                  <p className="mt-2 text-xs text-text-muted">Uploading…</p>
                )}
              </div>
              {uploadError && (
                <p className={`${noteClass} text-red-700`} role="alert">
                  {uploadError}
                </p>
              )}
              {viewError && (
                <p className={`${noteClass} text-red-700`} role="alert">
                  {viewError}
                </p>
              )}
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
              {showFieldNotes && field.note && <p className={noteClass}>{field.note}</p>}
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
              {showFieldNotes && field.note && <p className={noteClass}>{field.note}</p>}
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
              {showFieldNotes && field.note && <p className={noteClass}>{field.note}</p>}
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
            {showFieldNotes && field.note && <p className={noteClass}>{field.note}</p>}
          </div>
        );
      })}
    </div>
  );
}
