"use client";

import Link from "next/link";
import { useState } from "react";
import type { PetProfile } from "@/lib/pets";
import type { SelectedService } from "@/lib/services";
import { PetSelector } from "@/components/booking/PetSelector";
import { ServiceSelector } from "@/components/booking/ServiceSelector";

export function BookingFlow() {
  const [selectedPet, setSelectedPet] = useState<PetProfile | null>(null);
  const [selectedService, setSelectedService] = useState<SelectedService | null>(
    null,
  );

  function handlePetSelect(pet: PetProfile) {
    setSelectedPet(pet);
    setSelectedService(null);
  }

  return (
    <div className="mt-8 space-y-10 text-left">
      <section>
        <h2 className="text-lg font-medium text-gold-dark">
          Step 1 · Select Pet
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          Choose a pet from your saved profiles. Pricing is based on weight and
          coat needs.
        </p>
        <div className="mt-6">
          <PetSelector
            selectedId={selectedPet?.id ?? null}
            onSelect={handlePetSelect}
          />
        </div>
        {selectedPet && (
          <p className="mt-4 rounded-xl bg-lavender-light/40 px-4 py-3 text-sm text-text">
            Selected: <strong>{selectedPet.name}</strong> (
            {selectedPet.weightLbs} lbs)
          </p>
        )}
        <Link
          href="/account/pets"
          className="mt-4 inline-block text-sm text-gold-dark underline"
        >
          Manage pets in My Account
        </Link>
      </section>

      {selectedPet && (
        <section>
          <h2 className="text-lg font-medium text-gold-dark">
            Step 2 · Choose Service
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            Select the grooming service for {selectedPet.name}. Travel fees and
            appointment time come in the next steps.
          </p>
          <div className="mt-6">
            <ServiceSelector
              pet={selectedPet}
              selected={selectedService}
              onSelect={setSelectedService}
            />
          </div>
        </section>
      )}

      {selectedPet && selectedService && (
        <section className="rounded-2xl border border-gold/30 bg-cream px-5 py-4">
          <h2 className="text-lg font-medium text-gold-dark">
            Step 3 · Date &amp; Time
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            Calendar and payment method selection are coming soon. For now, email
            us with your pet and service choices.
          </p>
          <a
            href={`mailto:penny@k9atelier.com?subject=Booking%20Request%20-%20${encodeURIComponent(selectedPet.name)}&body=Pet%3A%20${encodeURIComponent(selectedPet.name)}%20(${selectedPet.weightLbs}%20lbs)%0AService%3A%20${encodeURIComponent(selectedService.serviceName)}${selectedService.optionName ? `%20-%20${encodeURIComponent(selectedService.optionName)}` : ""}${selectedService.seniorAddOn ? "%0AAdd-on%3A%20Senior%20%26%20Gentle%20Comfort%20Care" : ""}`}
            className="mt-4 inline-block rounded-xl bg-gold px-6 py-2.5 text-sm font-medium text-white hover:bg-gold-dark"
          >
            Email booking request
          </a>
        </section>
      )}
    </div>
  );
}
