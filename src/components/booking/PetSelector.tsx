"use client";

import { useEffect, useState } from "react";
import { PetProfileFieldsForm } from "@/components/account/PetProfileFieldsForm";
import {
  petReadyToBook,
  type PetProfile,
} from "@/lib/pets";
import { vaccinationBookingNeedsAdminConfirmation } from "@/lib/vaccinations/booking";
import { useCustomerPets } from "@/lib/pets/use-customer-pets";
import { fetchCustomerPaymentMethods } from "@/lib/payments/client";
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
    vaccinationBookingStatus: "missing",
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
  const [hasPaymentMethod, setHasPaymentMethod] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCards() {
      try {
        const result = await fetchCustomerPaymentMethods();
        if (!cancelled) setHasPaymentMethod(result.methods.length > 0);
      } catch {
        if (!cancelled) setHasPaymentMethod(false);
      }
    }
    void loadCards();
    return () => {
      cancelled = true;
    };
  }, []);

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
        {hasPaymentMethod == null ? (
          <p className="font-body mt-6 text-sm text-taupe">Checking payment method…</p>
        ) : hasPaymentMethod === false ? (
          <div className="mt-6 text-left">
            <p className="font-body text-sm leading-relaxed text-taupe">
              A valid payment method must be on file before you can save a pet
              profile. You will not be charged when you add a card.
            </p>
            <a href="/account/payment" className={`${bookingPrimaryBtnClass} mt-6`}>
              Add a payment method
            </a>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className={`${bookingPrimaryBtnClass} mt-6`}
          >
            Add a Dog
          </button>
        )}
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
        const pendingReview = vaccinationBookingNeedsAdminConfirmation(
          pet.vaccinationBookingStatus,
        );
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
              {pendingReview ? (
                <p className="font-body mt-4 text-[10px] font-medium uppercase tracking-[0.14em] text-red-700">
                  Vaccination pending review — appointment awaits confirmation
                </p>
              ) : (
                <p className="font-body mt-4 text-[10px] font-medium uppercase tracking-[0.14em] text-champagne">
                  Profile Complete
                </p>
              )}
              <span className={`${bookingPrimaryBtnClass} mt-6`}>
                Select {pet.name}
              </span>
            </button>
          </li>
        );
      })}

      {hasPaymentMethod === false && pets.length > 0 && (
        <li>
          <p className="font-body rounded-xl border border-champagne/40 bg-cream px-4 py-3 text-sm text-taupe">
            Add a valid card on file before creating another pet profile.{" "}
            <a href="/account/payment" className="text-ink underline">
              Add a payment method
            </a>
          </p>
        </li>
      )}

      {showAddForm && hasPaymentMethod ? (
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
            onClick={() => {
              if (!hasPaymentMethod) return;
              setShowAddForm(true);
            }}
            disabled={!hasPaymentMethod}
            className={`${bookingSecondaryBtnClass} flex w-full justify-center border-dashed disabled:cursor-not-allowed disabled:opacity-50`}
          >
            + Add a Dog
          </button>
        </li>
      )}
    </ul>
  );
}
