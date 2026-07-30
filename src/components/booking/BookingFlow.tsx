"use client";

import Link from "next/link";
import { useState } from "react";
import type { PetProfile } from "@/lib/pets";
import { formatPrice } from "@/lib/business";
import {
  formatServicePrice,
  getBookableCategories,
  seniorAddOnRange,
  supportsSeniorAddOn,
  type BookableService,
  type SelectedService,
} from "@/lib/services";
import { PetSelector } from "@/components/booking/PetSelector";
import {
  ServiceButtonPicker,
  ServiceCategoryPicker,
} from "@/components/booking/ServiceButtonPicker";

export function BookingFlow() {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<BookableService | null>(
    null,
  );
  const [serviceConfirmed, setServiceConfirmed] = useState(false);
  const [colorOption, setColorOption] = useState<string | null>(null);
  const [selectedPet, setSelectedPet] = useState<PetProfile | null>(null);
  const [seniorAddOn, setSeniorAddOn] = useState(false);

  const bookingSelection: SelectedService | null =
    selectedService && selectedPet
      ? {
          serviceId: selectedService.id,
          serviceName: selectedService.name,
          optionName: colorOption ?? undefined,
          seniorAddOn: supportsSeniorAddOn(selectedService.id)
            ? seniorAddOn
            : false,
          priceLabel: formatServicePrice(
            selectedService,
            selectedPet.weightLbs,
            colorOption ?? undefined,
          ),
        }
      : null;

  function handleCategorySelect(id: string) {
    const category = getBookableCategories().find((c) => c.id === id);
    const first = category?.services[0] ?? null;
    setCategoryId(id);
    setSelectedService(first);
    setServiceConfirmed(false);
    setColorOption(
      first?.id === "creative-accent-coloring"
        ? (first.options?.[0]?.name ?? null)
        : null,
    );
    setSelectedPet(null);
    setSeniorAddOn(false);
  }

  function handleServiceSelect(service: BookableService) {
    setSelectedService(service);
    setServiceConfirmed(false);
    setSelectedPet(null);
    setSeniorAddOn(false);
    if (service.id === "creative-accent-coloring") {
      setColorOption(service.options?.[0]?.name ?? null);
    } else {
      setColorOption(null);
    }
  }

  function handleBackToCategories() {
    setCategoryId(null);
    setSelectedService(null);
    setServiceConfirmed(false);
    setColorOption(null);
    setSelectedPet(null);
    setSeniorAddOn(false);
  }

  function handleBackToServices() {
    setServiceConfirmed(false);
    setSelectedPet(null);
    setSeniorAddOn(false);
  }

  function handleBookService() {
    if (!selectedService) return;
    setServiceConfirmed(true);
  }

  const seniorRange = seniorAddOnRange();
  const step = !categoryId
    ? 1
    : !serviceConfirmed
      ? 2
      : !selectedPet
        ? 3
        : 4;

  return (
    <div className="mt-10 space-y-10">
      {step === 1 && (
        <section>
          <div className="mx-auto mt-8 max-w-4xl">
            <ServiceCategoryPicker
              selectedCategoryId={categoryId}
              onSelect={handleCategorySelect}
            />
          </div>
        </section>
      )}

      {step === 2 && categoryId && (
        <section>
          <ServiceButtonPicker
            categoryId={categoryId}
            selectedServiceId={selectedService?.id ?? null}
            colorOption={colorOption}
            onSelect={handleServiceSelect}
            onColorOptionChange={setColorOption}
            onBack={handleBackToCategories}
            onBook={handleBookService}
          />
        </section>
      )}

      {step >= 3 && selectedService && (
        <section className="mx-auto max-w-xl">
          <button
            type="button"
            onClick={handleBackToServices}
            className="text-sm text-gold-dark underline"
          >
            ← Change service
          </button>

          <div className="mt-4 rounded-2xl border border-gold/30 bg-lavender-light/30 px-5 py-4 text-center">
            <p className="text-sm text-text-muted">Selected service</p>
            <p className="mt-1 font-medium text-gold-dark">
              {selectedService.name}
            </p>
            {colorOption && (
              <p className="mt-1 text-sm text-text-muted">{colorOption}</p>
            )}
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-medium text-gold-dark">
              Select Pet
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              Pricing is based on your pet&apos;s weight and profile.
            </p>
            <div className="mt-6">
              <PetSelector
                selectedId={selectedPet?.id ?? null}
                onSelect={setSelectedPet}
              />
            </div>
            <Link
              href="/account/pets"
              className="mt-4 inline-block text-sm text-gold-dark underline"
            >
              Manage pets in My Account
            </Link>
          </div>
        </section>
      )}

      {step === 4 && selectedPet && selectedService && bookingSelection && (
        <section className="mx-auto max-w-xl space-y-6">
          {supportsSeniorAddOn(selectedService.id) && (
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-lavender/40 bg-cream px-5 py-4">
              <input
                type="checkbox"
                checked={seniorAddOn}
                onChange={(e) => setSeniorAddOn(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-text">
                  Add Senior &amp; Gentle Comfort Care
                </span>
                <span className="mt-1 block text-sm text-text-muted">
                  Extra resting breaks and gentle handling (+
                  {formatPrice(seniorRange.min)}–{formatPrice(seniorRange.max)}
                  ).
                </span>
              </span>
            </label>
          )}

          <div className="rounded-2xl border border-gold/30 bg-cream px-5 py-4">
            <h2 className="text-lg font-medium text-gold-dark">
              Date &amp; Time
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              {selectedPet.name} · {bookingSelection.serviceName}
              {bookingSelection.optionName
                ? ` · ${bookingSelection.optionName}`
                : ""}
            </p>
            <p className="mt-2 text-sm font-medium text-gold-dark">
              Estimated: {bookingSelection.priceLabel}
              {bookingSelection.seniorAddOn ? " + senior add-on" : ""}
            </p>
            <p className="mt-3 text-sm text-text-muted">
              Calendar and payment method selection are coming soon.
            </p>
            <a
              href={`mailto:penny@k9atelier.com?subject=Booking%20Request%20-%20${encodeURIComponent(selectedPet.name)}&body=Pet%3A%20${encodeURIComponent(selectedPet.name)}%20(${selectedPet.weightLbs}%20lbs)%0AService%3A%20${encodeURIComponent(bookingSelection.serviceName)}${bookingSelection.optionName ? `%20-%20${encodeURIComponent(bookingSelection.optionName)}` : ""}${bookingSelection.seniorAddOn ? "%0AAdd-on%3A%20Senior%20%26%20Gentle%20Comfort%20Care" : ""}`}
              className="mt-4 inline-block rounded-xl bg-gold px-6 py-2.5 text-sm font-medium text-white hover:bg-gold-dark"
            >
              Email booking request
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
