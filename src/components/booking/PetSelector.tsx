"use client";

import { useState } from "react";
import { PetProfileFieldsForm } from "@/components/account/PetProfileFieldsForm";
import {
  petReadyToBook,
  type PetProfile,
} from "@/lib/pets";
import { useCustomerPets } from "@/lib/pets/use-customer-pets";
import { formatPetAgeLabel, getPetAgeYears } from "@/lib/pet-age";
import {
  bookingCardClass,
  bookingCardSelectedClass,
  bookingNoticeClass,
  bookingPrimaryBtnClass,
  bookingSecondaryBtnClass,
} from "@/components/booking/booking-ui";

function createDraftPet(name = "New Dog"): PetProfile {
  return {
    id: `draft-${Date.now()}`,
    name,
    breed: "",
    weightLbs: 0,
    vaccineRecordUploaded: false,
  };
}

export function PetSelector({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (pet: PetProfile) => void;
}) {
  const { pets, loading, error, createPet } = useCustomerPets();
  const [showAddForm, setShowAddForm] = useState(false);
  const [draftPet, setDraftPet] = useState<PetProfile>(() => createDraftPet());
  const [submittingDraft, setSubmittingDraft] = useState(false);

  async function saveNewPet() {
    setSubmittingDraft(true);
    try {
      const created = await createPet(draftPet);
      setShowAddForm(false);
      onSelect(created);
      setDraftPet(createDraftPet());
    } catch {
      // error surfaced via hook
    } finally {
      setSubmittingDraft(false);
    }
  }

  if (loading) {
    return (
      <div className={`${bookingNoticeClass} text-center`}>
        <p className="font-body text-sm text-taupe">Loading your dogs…</p>
      </div>
    );
  }

  if (pets.length === 0 && !showAddForm) {
    return (
      <div className={`${bookingNoticeClass} text-center`}>
        {error && (
          <p className="font-body mb-4 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <p className="font-body text-sm text-taupe">
          No dogs in your profile yet.
        </p>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className={`${bookingPrimaryBtnClass} mt-6`}
        >
          Add a Dog
        </button>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {error && (
        <li>
          <p className="font-body rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        </li>
      )}

      {pets.map((pet) => {
        const ready = petReadyToBook(pet);
        const selected = selectedId === pet.id;

        if (!ready) {
          return (
            <li key={pet.id}>
              <div className={bookingNoticeClass}>
                <p className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
                  {pet.name}&apos;s Profile Needs Attention
                </p>
                <p className="font-body mt-3 text-sm leading-relaxed text-taupe">
                  Before we can reserve {pet.name}&apos;s appointment, please
                  upload their current vaccination record in your account.
                </p>
                <a
                  href="/account/pets"
                  className={`${bookingSecondaryBtnClass} mt-5 inline-flex`}
                >
                  Complete {pet.name}&apos;s Profile
                </a>
              </div>
            </li>
          );
        }

        return (
          <li key={pet.id}>
            <button
              type="button"
              onClick={() => onSelect(pet)}
              className={`${bookingCardClass} w-full ${
                selected ? bookingCardSelectedClass : "hover:border-champagne/60"
              }`}
            >
              <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
                {pet.name}
              </p>
              <p className="font-display mt-2 text-2xl text-ink">{pet.breed}</p>
              <p className="font-body mt-2 text-sm text-taupe">
                {(() => {
                  const age = getPetAgeYears(pet);
                  return age != null
                    ? `${pet.weightLbs} lbs · ${formatPetAgeLabel(age)}`
                    : `${pet.weightLbs} lbs`;
                })()}
              </p>
              <p className="font-body mt-4 text-[10px] font-medium uppercase tracking-[0.14em] text-champagne">
                Profile Complete
              </p>
              <span className={`${bookingPrimaryBtnClass} mt-6`}>
                Select {pet.name}
              </span>
            </button>
          </li>
        );
      })}

      {showAddForm ? (
        <li className={`${bookingNoticeClass} space-y-4`}>
          <p className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
            New Dog Profile
          </p>
          <PetProfileFieldsForm
            pet={draftPet}
            onPetChange={(updates) =>
              setDraftPet((current) => ({ ...current, ...updates }))
            }
            variant="booking"
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void saveNewPet()}
              disabled={submittingDraft}
              className={bookingPrimaryBtnClass}
            >
              {submittingDraft ? "Saving…" : "Save & Continue"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className={bookingSecondaryBtnClass}
            >
              Cancel
            </button>
          </div>
        </li>
      ) : (
        <li>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className={`${bookingSecondaryBtnClass} flex w-full justify-center border-dashed`}
          >
            + Add a Dog
          </button>
        </li>
      )}
    </ul>
  );
}
