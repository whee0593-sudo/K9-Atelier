"use client";

import React, { useRef, useState } from "react";
import { PetProfileFieldsForm } from "@/components/account/PetProfileFieldsForm";
import { bookingPrimaryBtnClass, bookingSecondaryBtnClass } from "@/components/booking/booking-ui";
import { createDraftBookingPet, isPersistedPetId } from "@/lib/booking-flow";
import { createCustomerPet, updateCustomerPet, uploadPetVaccinationRecord } from "@/lib/pets/client";
import { mapPetProfileToWriteInput } from "@/lib/pets/map";
import { validateCreatePetInput } from "@/lib/pets/validation";
import type { PetProfile } from "@/lib/pets";

export function AppointmentAddDogForm({ onSaved, onEditingChange, preview = false, disabled = false }: {
  onSaved: (pet: PetProfile) => void;
  onEditingChange: (editing: boolean) => void;
  preview?: boolean;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<PetProfile>(createDraftBookingPet);
  const [savedPet, setSavedPet] = useState<PetProfile | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  function edit() {
    if (disabled || saving || uploading) return;
    setError(null);
    setExpanded(true);
    onEditingChange(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (savingRef.current || uploading || disabled) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const input = validateCreatePetInput(mapPetProfileToWriteInput(draft));
      const pet = preview ? { ...draft, name: input.name, breed: input.breed, weightLbs: input.weightLbs }
        : savedPet ? await updateCustomerPet(savedPet.id, input) : await createCustomerPet(input);
      setSavedPet(pet);
      setDraft(pet);
      setExpanded(false);
      onSaved(pet);
      onEditingChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this dog. Please try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return <div className="space-y-3">
    {savedPet ? <button type="button" disabled={disabled || saving || uploading} aria-expanded={expanded} aria-controls="added-dog-form"
      onClick={() => { if (!expanded) edit(); }}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-lavender/40 bg-lavender-light/30 px-4 py-3 text-left text-sm text-text disabled:opacity-60">
      <span>{savedPet.name} · {savedPet.breed} · {savedPet.weightLbs} lbs</span>
      <span aria-hidden="true">{expanded ? "−" : "+"}</span>
    </button> : !expanded ? <button type="button" disabled={disabled} onClick={edit} className={bookingSecondaryBtnClass}>Add a dog</button> : null}
    {expanded ? <form id="added-dog-form" onSubmit={event => void save(event)} className="rounded-xl border border-lavender/30 p-4" noValidate>
      <fieldset disabled={saving || uploading || disabled} className="space-y-5 disabled:opacity-60">
        <PetProfileFieldsForm pet={draft} onPetChange={updates => {
          setDraft(current => ({ ...current, ...updates }));
          setError(null);
        }}
          petPersisted={isPersistedPetId(draft.id)} vaccinationUploading={uploading}
          onVaccinationUpload={async file => {
            setUploading(true); setError(null);
            try {
              if (!preview) {
                const pet = await uploadPetVaccinationRecord(draft.id, file, draft.vaccineExpiration);
                setDraft(current => ({ ...current, vaccineRecordUploaded: pet.vaccineRecordUploaded, vaccinationBookingStatus: pet.vaccinationBookingStatus, vaccinationLatestRecordId: pet.vaccinationLatestRecordId }));
              }
            } catch (e) { setError(e instanceof Error ? e.message : "Could not upload this record."); }
            finally { setUploading(false); }
          }} />
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={bookingPrimaryBtnClass}>{saving ? "Saving…" : "Save dog"}</button>
          <button type="button" className={bookingSecondaryBtnClass} onClick={() => {
            setDraft(savedPet ?? createDraftBookingPet()); setExpanded(false); setError(null); onEditingChange(false);
          }}>Cancel</button>
        </div>
      </fieldset>
    </form> : null}
  </div>;
}
