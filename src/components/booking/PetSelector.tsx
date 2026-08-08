"use client";

import Link from "next/link";
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

export function PetSelector({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (pet: PetProfile) => void;
}) {
  const pets = getCustomerPetProfiles();

  if (pets.length === 0) {
    return (
      <div className={`${bookingNoticeClass} text-center`}>
        <p className="font-body text-sm text-taupe">
          No dogs in your profile yet.
        </p>
        <Link href="/account/pets" className={`${bookingPrimaryBtnClass} mt-6`}>
          Add a Dog
        </Link>
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
                  update their current vaccination record.
                </p>
                <Link
                  href="/account/pets"
                  className={`${bookingSecondaryBtnClass} mt-5`}
                >
                  Update {pet.name}&apos;s Profile
                </Link>
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

      <li>
        <Link
          href="/account/pets"
          className={`${bookingSecondaryBtnClass} flex w-full justify-center border-dashed`}
        >
          + Add a Dog
        </Link>
      </li>
    </ul>
  );
}
