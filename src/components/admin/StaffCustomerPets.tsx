"use client";

import React, { useEffect, useState } from "react";
import { PetProfileFieldsForm } from "@/components/account/PetProfileFieldsForm";
import { RabiesStatusSummary } from "@/components/account/RabiesStatusSummary";
import { mapPetProfileToWriteInput, mapPetRecordToUiProfile } from "@/lib/pets/map";
import { normalizePetProfile, type PetProfile } from "@/lib/pets";
import type { StaffCustomerRecord } from "@/lib/profiles/staff-service";

type StaffPet = StaffCustomerRecord["pets"][number];

function createDraftPet(): PetProfile {
  return {
    id: `draft-${Date.now()}`,
    name: "",
    breed: "",
    weightLbs: 0,
    vaccineRecordUploaded: false,
    vaccinationBookingStatus: "missing",
  };
}

function StaffPetEditor({
  customerId,
  pet,
  preview = false,
  onSaved,
  onArchived,
}: {
  customerId: string;
  pet: StaffPet;
  preview?: boolean;
  onSaved: (pet: StaffPet) => void;
  onArchived: (petId: string) => void;
}) {
  const [draft, setDraft] = useState<PetProfile>(() =>
    normalizePetProfile({
      ...mapPetRecordToUiProfile(pet),
      adminServiceNotes: pet.adminServiceNotes,
    }),
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(
      normalizePetProfile({
        ...mapPetRecordToUiProfile(pet),
        adminServiceNotes: pet.adminServiceNotes,
      }),
    );
  }, [pet]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (preview) {
        onSaved({
          ...pet,
          ...mapPetProfileToWriteInput(draft),
          adminServiceNotes: draft.adminServiceNotes ?? "",
        });
        setSaved(true);
        return;
      }

      const response = await fetch(
        `/api/admin/customers/${customerId}/pets/${pet.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...mapPetProfileToWriteInput(draft),
            adminServiceNotes: draft.adminServiceNotes ?? "",
          }),
        },
      );
      const body = (await response.json()) as {
        error?: string;
        pet?: StaffPet;
      };
      if (!response.ok || !body.pet) {
        throw new Error(body.error ?? "Could not save this pet profile.");
      }
      onSaved(body.pet);
      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this pet profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!window.confirm("Remove this pet from the customer's active profiles?")) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (preview) {
        onArchived(pet.id);
        return;
      }
      const response = await fetch(
        `/api/admin/customers/${customerId}/pets/${pet.id}`,
        { method: "DELETE", credentials: "include" },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not remove this pet profile.");
      }
      onArchived(pet.id);
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "Could not remove this pet profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleVaccinationUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      if (preview) {
        const next: StaffPet = {
          ...pet,
          ...mapPetProfileToWriteInput(draft),
          adminServiceNotes: draft.adminServiceNotes ?? "",
          vaccinationHasUpload: true,
          vaccinationBookingStatus: "needs_review",
          vaccinationExpirationDate: draft.vaccineExpiration ?? null,
        };
        onSaved(next);
        setDraft((current) =>
          normalizePetProfile({
            ...current,
            vaccineRecordUploaded: true,
            vaccinationBookingStatus: "needs_review",
          }),
        );
        setSaved(true);
        return;
      }

      const form = new FormData();
      form.append("file", file);
      if (draft.vaccineExpiration) {
        form.append("expirationDate", draft.vaccineExpiration);
      }
      const response = await fetch(
        `/api/admin/customers/${customerId}/pets/${pet.id}/vaccinations`,
        { method: "POST", credentials: "include", body: form },
      );
      const body = (await response.json()) as {
        error?: string;
        pet?: StaffPet;
      };
      if (!response.ok || !body.pet) {
        throw new Error(body.error ?? "Could not upload this vaccination record.");
      }
      onSaved({
        ...body.pet,
        adminServiceNotes: draft.adminServiceNotes ?? body.pet.adminServiceNotes,
      });
      setSaved(true);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload this vaccination record.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <PetProfileFieldsForm
        pet={draft}
        onPetChange={(updates) => {
          setDraft((current) => normalizePetProfile({ ...current, ...updates }));
          setSaved(false);
        }}
        petPersisted
        vaccinationUploading={uploading}
        vaccinationAudience="admin"
        onVaccinationUpload={handleVaccinationUpload}
      />
      <label className="block text-sm font-medium text-text">
        Service & Product Notes (Admin Only)
        <textarea
          value={draft.adminServiceNotes ?? ""}
          onChange={(event) => {
            setDraft((current) => ({
              ...current,
              adminServiceNotes: event.target.value,
            }));
            setSaved(false);
          }}
          rows={3}
          className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm text-text"
        />
      </label>
      {error && (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || uploading}
          className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Pet"}
        </button>
        <button
          type="button"
          onClick={() => void handleArchive()}
          disabled={saving || uploading}
          className="text-xs text-text-muted underline disabled:opacity-60"
        >
          Remove this pet profile
        </button>
        {saved && <span className="text-xs text-text-muted">Saved</span>}
      </div>
    </div>
  );
}

export function StaffCustomerPets({
  customerId,
  pets,
  preview = false,
  onPetSaved,
  onPetCreated,
  onPetArchived,
}: {
  customerId: string;
  pets: StaffPet[];
  preview?: boolean;
  onPetSaved: (pet: StaffPet) => void;
  onPetCreated: (pet: StaffPet) => void;
  onPetArchived: (petId: string) => void;
}) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [draftPet, setDraftPet] = useState<PetProfile>(() => createDraftPet());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddPet() {
    setSubmitting(true);
    setError(null);
    try {
      const input = mapPetProfileToWriteInput(draftPet);
      if (preview) {
        onPetCreated({
          id: crypto.randomUUID(),
          name: input.name,
          breed: input.breed,
          weightLbs: input.weightLbs,
          dateOfBirth: input.dateOfBirth ?? null,
          approximateAgeYears: input.approximateAgeYears ?? null,
          sex: input.sex ?? null,
          temperamentNotes: input.temperamentNotes ?? null,
          healthComfortNotes: input.healthComfortNotes ?? null,
          groomingPreferences: input.groomingPreferences ?? null,
          rabiesStatus: input.rabiesStatus ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          adminServiceNotes: "",
          vaccinationBookingStatus: "missing",
          vaccinationHasUpload: false,
        });
        setShowNewForm(false);
        setDraftPet(createDraftPet());
        return;
      }

      const response = await fetch(`/api/admin/customers/${customerId}/pets`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await response.json()) as { error?: string; pet?: StaffPet };
      if (!response.ok || !body.pet) {
        throw new Error(body.error ?? "Could not add this pet profile.");
      }
      onPetCreated(body.pet);
      setShowNewForm(false);
      setDraftPet(createDraftPet());
    } catch (addError) {
      setError(
        addError instanceof Error ? addError.message : "Could not add this pet profile.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-medium text-gold-dark">Pet Profiles</h3>
        {!showNewForm ? (
          <button
            type="button"
            onClick={() => {
              setShowNewForm(true);
              setError(null);
            }}
            className="rounded-xl border border-dashed border-gold/50 px-3 py-2 text-sm font-medium text-gold-dark"
          >
            + Add a pet
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {pets.length === 0 && !showNewForm ? (
        <p className="mt-3 text-sm text-text-muted">No pet profiles yet.</p>
      ) : (
        <div className="mt-4 space-y-6">
          {pets.map((pet) => (
            <div
              key={pet.id}
              className="rounded-xl border border-lavender/30 px-4 py-4"
            >
              <p className="font-medium text-text">
                {pet.name} · {pet.breed}
              </p>
              <div className="mt-3 rounded-xl border border-lavender/30 bg-lavender-light/20 px-4 py-4">
                <RabiesStatusSummary
                  pet={mapPetRecordToUiProfile(pet)}
                  statusLabel="Rabies Status"
                />
              </div>
              <StaffPetEditor
                customerId={customerId}
                pet={pet}
                preview={preview}
                onSaved={onPetSaved}
                onArchived={onPetArchived}
              />
            </div>
          ))}
        </div>
      )}
      {showNewForm ? (
        <div className="mt-4 rounded-2xl border border-dashed border-gold/50 bg-lavender-light/20 p-6">
          <h4 className="font-medium text-gold-dark">
            {draftPet.name.trim() ? `${draftPet.name.trim()} Profile` : "New Pet Profile"}
          </h4>
          <div className="mt-4">
            <PetProfileFieldsForm
              pet={draftPet}
              onPetChange={(updates) =>
                setDraftPet((current) =>
                  normalizePetProfile({ ...current, ...updates }),
                )
              }
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleAddPet()}
              disabled={submitting}
              className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitting ? "Adding…" : "Save Pet"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewForm(false);
                setDraftPet(createDraftPet());
                setError(null);
              }}
              className="rounded-xl border border-lavender px-4 py-2 text-sm text-text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
