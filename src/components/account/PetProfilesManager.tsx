"use client";

import { useState } from "react";
import { PetProfileAgeSummary } from "@/components/account/PetBirthdayFields";
import { PetProfileFieldsForm } from "@/components/account/PetProfileFieldsForm";
import type { PetProfile } from "@/lib/pets";
import { useCustomerPets } from "@/lib/pets/use-customer-pets";

function createDraftPet(name = "New Pet"): PetProfile {
  return {
    id: `draft-${Date.now()}`,
    name,
    breed: "",
    weightLbs: 0,
    vaccineRecordUploaded: false,
  };
}

function PetCard({
  pet,
  expanded,
  saving,
  onToggle,
  onPetChange,
  onArchive,
}: {
  pet: PetProfile;
  expanded: boolean;
  saving: boolean;
  onToggle: () => void;
  onPetChange: (updates: Partial<PetProfile>) => void;
  onArchive: () => void;
}) {
  return (
    <article className="rounded-2xl border border-lavender/40 bg-cream">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <p className="font-medium text-text">{pet.name}</p>
          <PetProfileAgeSummary pet={pet} />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {saving && (
            <span className="text-xs text-text-muted">Saving…</span>
          )}
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              pet.vaccineRecordUploaded
                ? "bg-lavender-light text-gold-dark"
                : "bg-red-100 text-red-800"
            }`}
          >
            {pet.vaccineRecordUploaded ? "Vaccines on file" : "Vaccines required"}
          </span>
          <span className="text-sm text-gold-dark">{expanded ? "−" : "+"}</span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-lavender/30 px-5 py-6">
          <PetProfileFieldsForm pet={pet} onPetChange={onPetChange} />
          <button
            type="button"
            onClick={onArchive}
            className="mt-6 text-xs text-text-muted underline"
          >
            Remove this pet profile
          </button>
        </div>
      )}
    </article>
  );
}

export function PetProfilesManager() {
  const {
    pets,
    loading,
    error,
    savingIds,
    updatePetLocal,
    createPet,
    archivePet,
  } = useCustomerPets();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [draftPet, setDraftPet] = useState<PetProfile>(() => createDraftPet());
  const [submittingDraft, setSubmittingDraft] = useState(false);

  async function handleAddPet() {
    setSubmittingDraft(true);
    try {
      const created = await createPet(draftPet);
      setExpandedId(created.id);
      setShowNewForm(false);
      setDraftPet(createDraftPet());
    } catch {
      // error surfaced via hook
    } finally {
      setSubmittingDraft(false);
    }
  }

  async function handleArchive(id: string) {
    if (!window.confirm("Remove this pet from your active profiles?")) return;
    try {
      await archivePet(id);
      setExpandedId((current) => (current === id ? null : current));
    } catch {
      // error surfaced via hook
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-text-muted">Loading your pet profiles…</p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {pets.map((pet) => (
        <PetCard
          key={pet.id}
          pet={pet}
          expanded={expandedId === pet.id}
          saving={savingIds.has(pet.id)}
          onToggle={() =>
            setExpandedId((id) => (id === pet.id ? null : pet.id))
          }
          onPetChange={(updates) => updatePetLocal(pet.id, updates)}
          onArchive={() => void handleArchive(pet.id)}
        />
      ))}

      {showNewForm ? (
        <div className="rounded-2xl border border-dashed border-gold/50 bg-lavender-light/20 p-6">
          <h3 className="font-medium text-gold-dark">New Pet Profile</h3>
          <div className="mt-4">
            <PetProfileFieldsForm
              pet={draftPet}
              onPetChange={(updates) =>
                setDraftPet((current) => ({ ...current, ...updates }))
              }
            />
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => void handleAddPet()}
              disabled={submittingDraft}
              className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {submittingDraft ? "Saving…" : "Save Pet"}
            </button>
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="rounded-xl border border-lavender px-4 py-2 text-sm text-text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNewForm(true)}
          className="w-full rounded-2xl border border-dashed border-gold/50 py-4 text-sm font-medium text-gold-dark transition hover:bg-lavender-light/40"
        >
          + Add Another Pet
        </button>
      )}
    </div>
  );
}
