"use client";

import Link from "next/link";
import { useState } from "react";
import type { PetProfile } from "@/lib/pets";
import {
  demoPetProfiles,
  formatPetSummary,
  petReadyToBook,
} from "@/lib/pets";

export function PetSelector({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (pet: PetProfile) => void;
}) {
  const pets = demoPetProfiles;

  if (pets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-lavender/50 bg-lavender-light/30 px-6 py-8 text-center">
        <p className="text-sm text-text-muted">
          No pets in your profile yet.
        </p>
        <Link
          href="/account/pets"
          className="mt-4 inline-block text-sm font-medium text-gold-dark underline"
        >
          Add a pet to your account
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {pets.map((pet) => {
        const ready = petReadyToBook(pet);
        const selected = selectedId === pet.id;

        return (
          <li key={pet.id}>
            <button
              type="button"
              disabled={!ready}
              onClick={() => onSelect(pet)}
              className={`w-full rounded-2xl border px-5 py-4 text-left transition ${
                selected
                  ? "border-gold bg-lavender-light/50 ring-2 ring-gold/30"
                  : ready
                    ? "border-lavender/40 bg-cream hover:border-gold/40"
                    : "cursor-not-allowed border-lavender/30 bg-cream/50 opacity-70"
              }`}
            >
              <p className="font-medium text-text">{pet.name}</p>
              <p className="mt-1 text-sm text-text-muted">
                {formatPetSummary(pet)}
              </p>
              {!ready && (
                <p className="mt-2 text-xs text-red-700">
                  Vaccination record required —{" "}
                  <Link
                    href="/account/pets"
                    className="underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    update profile
                  </Link>
                </p>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function BookPetStep() {
  const [selected, setSelected] = useState<PetProfile | null>(null);

  return (
    <div className="mt-8 text-left">
      <h2 className="text-lg font-medium text-gold-dark">
        Step 1 · Select Pet
      </h2>
      <p className="mt-2 text-sm text-text-muted">
        Choose a pet from your saved profiles. Each appointment is booked for
        one pet.
      </p>
      <div className="mt-6">
        <PetSelector
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
        />
      </div>
      {selected && (
        <p className="mt-4 rounded-xl bg-lavender-light/40 px-4 py-3 text-sm text-text">
          Selected: <strong>{selected.name}</strong> ({selected.weightLbs} lbs)
          — service pricing will be based on this profile.
        </p>
      )}
      <Link
        href="/account/pets"
        className="mt-4 inline-block text-sm text-gold-dark underline"
      >
        Manage pets in My Account
      </Link>
    </div>
  );
}
