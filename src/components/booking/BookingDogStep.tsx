"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PetProfileFieldsForm } from "@/components/account/PetProfileFieldsForm";
import {
  bookingCardClass,
  bookingNoticeClass,
  bookingPrimaryBtnClass,
} from "@/components/booking/booking-ui";
import { formatPetAgeLabel, getPetAgeYears } from "@/lib/pet-age";
import {
  petReadyToBook,
  type PetProfile,
} from "@/lib/pets";
import { mapPetProfileToWriteInput } from "@/lib/pets/map";
import { PetValidationError, validateCreatePetInput } from "@/lib/pets/validation";
import { parsePetRabiesStatus } from "@/lib/vaccinations/booking";
import { createClient } from "@/lib/supabase/client";
import { fetchCustomerPets } from "@/lib/pets/client";

type Props = {
  draftPet: PetProfile;
  onDraftChange: (updates: Partial<PetProfile>) => void;
  onContinue: (pet: PetProfile) => void | Promise<void>;
};

export function BookingDogStep({ draftPet, onDraftChange, onContinue }: Props) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [existingPets, setExistingPets] = useState<PetProfile[]>([]);
  const [loadingPets, setLoadingPets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        setLoggedIn(Boolean(user));
        if (!user) {
          setLoadingPets(false);
          return;
        }
        try {
          const pets = await fetchCustomerPets();
          if (!cancelled) setExistingPets(pets);
        } catch {
          if (!cancelled) setExistingPets([]);
        }
      } catch {
        if (!cancelled) setLoggedIn(false);
      } finally {
        if (!cancelled) setLoadingPets(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function validateDraft(): string | null {
    try {
      validateCreatePetInput(mapPetProfileToWriteInput(draftPet));
    } catch (err) {
      if (err instanceof PetValidationError) return err.message;
      return "Please complete this dog's details.";
    }
    if (!parsePetRabiesStatus(draftPet.rabiesStatus)) {
      return "Please confirm this dog’s rabies vaccination status.";
    }
    return null;
  }

  async function handleContinue() {
    const message = validateDraft();
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onContinue(draftPet);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save this dog's details.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const readyExisting = existingPets.filter((pet) => petReadyToBook(pet));

  return (
    <section>
      <p className="font-body text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
        Your Dog
      </p>
      <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
        Who Are We Welcoming?
      </h2>
      <p className="font-body mt-4 text-sm text-taupe">
        Tell us about the dog we will groom. This becomes part of their private
        profile.
      </p>

      {loggedIn && loadingPets ? (
        <p className="font-body mt-8 text-sm text-taupe">Loading your dogs…</p>
      ) : null}

      {readyExisting.length > 0 ? (
        <div className="mt-8 space-y-4">
          <p className="font-body text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
            Dogs already in your profile
          </p>
          <ul className="space-y-3">
            {readyExisting.map((pet) => (
              <li key={pet.id}>
                <button
                  type="button"
                  onClick={() => void onContinue(pet)}
                  className={`${bookingCardClass} w-full hover:border-champagne/60`}
                >
                  <p className="font-body text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
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
                  <span className={`${bookingPrimaryBtnClass} mt-6`}>
                    Continue with {pet.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={`${bookingNoticeClass} mt-8 space-y-5`}>
        <p className="font-body text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
          {readyExisting.length > 0 ? "Or add another dog" : "Dog details"}
        </p>
        <PetProfileFieldsForm
          pet={draftPet}
          onPetChange={onDraftChange}
          variant="booking"
        />
        {error ? (
          <p className="font-body text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleContinue()}
          className={bookingPrimaryBtnClass}
        >
          {submitting ? "Saving…" : "Save & Continue"}
        </button>
      </div>

      {!loggedIn ? (
        <p className="font-body mt-6 text-[13px] leading-relaxed text-taupe">
          Already have an account?{" "}
          <Link href="/login?next=/book" className="text-ink underline">
            Sign in
          </Link>{" "}
          to use a dog already on file.
        </p>
      ) : null}
    </section>
  );
}
