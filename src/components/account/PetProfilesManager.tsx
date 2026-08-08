"use client";

import { useState } from "react";
import { PetProfileAgeSummary } from "@/components/account/PetBirthdayFields";
import { PetProfileFieldsForm } from "@/components/account/PetProfileFieldsForm";
import {
  getCustomerPetProfiles,
  saveCustomerPetProfiles,
  type PetProfile,
} from "@/lib/pets";

function PetCard({
  pet,
  expanded,
  onToggle,
  onPetChange,
}: {
  pet: PetProfile;
  expanded: boolean;
  onToggle: () => void;
  onPetChange: (updates: Partial<PetProfile>) => void;
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
        </div>
      )}
    </article>
  );
}

export function PetProfilesManager() {
  const [pets, setPets] = useState<PetProfile[]>(() => getCustomerPetProfiles());
  const [expandedId, setExpandedId] = useState<string | null>(
    () => getCustomerPetProfiles()[0]?.id ?? null,
  );
  const [showNewForm, setShowNewForm] = useState(false);
  const [draftPet, setDraftPet] = useState<PetProfile>(() => ({
    id: `pet-${Date.now()}`,
    name: "New Pet",
    breed: "",
    weightLbs: 0,
    vaccineRecordUploaded: false,
  }));

  function persistPets(next: PetProfile[]) {
    setPets(next);
    saveCustomerPetProfiles(next);
  }

  function updatePet(id: string, updates: Partial<PetProfile>) {
    persistPets(
      pets.map((pet) => (pet.id === id ? { ...pet, ...updates } : pet)),
    );
  }

  function addPet() {
    persistPets([...pets, draftPet]);
    setExpandedId(draftPet.id);
    setShowNewForm(false);
    setDraftPet({
      id: `pet-${Date.now()}`,
      name: "New Pet",
      breed: "",
      weightLbs: 0,
      vaccineRecordUploaded: false,
    });
  }

  return (
    <div className="space-y-4">
      {pets.map((pet) => (
        <PetCard
          key={pet.id}
          pet={pet}
          expanded={expandedId === pet.id}
          onToggle={() =>
            setExpandedId((id) => (id === pet.id ? null : pet.id))
          }
          onPetChange={(updates) => updatePet(pet.id, updates)}
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
              onClick={addPet}
              className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white"
            >
              Save Pet (preview)
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
