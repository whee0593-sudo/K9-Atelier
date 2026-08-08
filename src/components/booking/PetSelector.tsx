"use client";

import { useState } from "react";
import { AccountFieldsForm } from "@/components/account/AccountFieldsForm";
import { filterFieldsByAudience, getAccountSection } from "@/lib/account-fields";
import {
  getCustomerPetProfiles,
  petReadyToBook,
  type PetProfile,
} from "@/lib/pets";
import {
  bookingCardClass,
  bookingCardSelectedClass,
  bookingNoticeClass,
  bookingPrimaryBtnClass,
  bookingSecondaryBtnClass,
} from "@/components/booking/booking-ui";

const petFields = filterFieldsByAudience(
  getAccountSection("pets")?.fields ?? [],
  "customer",
);

export function PetSelector({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (pet: PetProfile) => void;
}) {
  const [pets, setPets] = useState<PetProfile[]>(() => getCustomerPetProfiles());
  const [showAddForm, setShowAddForm] = useState(false);

  function saveNewPet() {
    const newPet: PetProfile = {
      id: `pet-${Date.now()}`,
      name: "New Dog",
      breed: "",
      weightLbs: 0,
      vaccineRecordUploaded: false,
    };
    setPets((prev) => [...prev, newPet]);
    setShowAddForm(false);
    onSelect(newPet);
  }

  if (pets.length === 0 && !showAddForm) {
    return (
      <div className={`${bookingNoticeClass} text-center`}>
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
                  upload their current vaccination record below.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className={`${bookingSecondaryBtnClass} mt-5`}
                >
                  Complete {pet.name}&apos;s Profile
                </button>
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
                {pet.weightLbs} lbs
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
          <AccountFieldsForm fields={petFields} />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={saveNewPet}
              className={bookingPrimaryBtnClass}
            >
              Save &amp; Continue
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
