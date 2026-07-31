"use client";

import Link from "next/link";
import { useState } from "react";
import type { PetProfile } from "@/lib/pets";
import { business, formatPrice } from "@/lib/business";
import {
  formatServicePrice,
  getAddOnService,
  getAvailableAddOns,
  getBookableCategories,
  getCreativeColoringService,
  getRequiredBaseServicesForCreative,
  isCreativeColoringCategory,
  type BookableService,
  type SelectedService,
} from "@/lib/services";
import {
  formatServiceAddress,
  type ServiceAddress,
  type TravelQuote,
} from "@/lib/travel";
import { AddOnPickerModal } from "@/components/booking/AddOnPickerModal";
import { CreativePairingModal } from "@/components/booking/CreativePairingModal";
import { PetSelector } from "@/components/booking/PetSelector";
import { AddressStep } from "@/components/booking/AddressStep";
import { DateTimeStep } from "@/components/booking/DateTimeStep";
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
  const [showAddOnPicker, setShowAddOnPicker] = useState(false);
  const [showCreativePairing, setShowCreativePairing] = useState(false);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [addOnOptions, setAddOnOptions] = useState<Record<string, string>>({});
  const [selectedPet, setSelectedPet] = useState<PetProfile | null>(null);
  const [address, setAddress] = useState<ServiceAddress | null>(null);
  const [travelQuote, setTravelQuote] = useState<TravelQuote | null>(null);
  const [appointmentDate, setAppointmentDate] = useState<string | null>(null);
  const [appointmentTime, setAppointmentTime] = useState<string | null>(null);

  const availableAddOns =
    categoryId && selectedService
      ? getAvailableAddOns(categoryId, selectedService.id)
      : [];

  const bookingSelection: SelectedService | null =
    selectedService && selectedPet
      ? {
          serviceId: selectedService.id,
          serviceName: selectedService.name,
          addOnIds: selectedAddOnIds,
          priceLabel: formatServicePrice(
            selectedService,
            selectedPet.weightLbs,
          ),
        }
      : null;

  function resetFromService() {
    setSelectedPet(null);
    setAddress(null);
    setTravelQuote(null);
    setAppointmentDate(null);
    setAppointmentTime(null);
    setSelectedAddOnIds([]);
    setAddOnOptions({});
    setShowAddOnPicker(false);
    setShowCreativePairing(false);
  }

  function handleCategorySelect(id: string) {
    const category = getBookableCategories().find((c) => c.id === id);
    const first = category?.services[0] ?? null;
    setCategoryId(id);
    setSelectedService(first);
    setServiceConfirmed(false);
    setShowAddOnPicker(false);
    resetFromService();
  }

  function handleServiceSelect(service: BookableService) {
    setSelectedService(service);
    setServiceConfirmed(false);
    setShowAddOnPicker(false);
    resetFromService();
  }

  function handleBackToCategories() {
    setCategoryId(null);
    setSelectedService(null);
    setServiceConfirmed(false);
    setShowAddOnPicker(false);
    setShowCreativePairing(false);
    resetFromService();
  }

  function handleBackToServices() {
    const wasCreativeFlow = isCreativeColoringCategory(categoryId ?? "");
    setServiceConfirmed(false);
    setShowAddOnPicker(false);
    setShowCreativePairing(false);
    resetFromService();
    if (wasCreativeFlow) {
      setSelectedService(getCreativeColoringService() ?? null);
    }
  }

  function handleBookService() {
    if (!selectedService || !categoryId) return;

    if (isCreativeColoringCategory(categoryId)) {
      setShowCreativePairing(true);
      return;
    }

    const addOns = getAvailableAddOns(categoryId, selectedService.id);
    if (addOns.length > 0) {
      setShowAddOnPicker(true);
      return;
    }

    setServiceConfirmed(true);
  }

  function handleAddOnBack() {
    setShowAddOnPicker(false);
  }

  function handleAddOnSkip() {
    setSelectedAddOnIds([]);
    setAddOnOptions({});
    setShowAddOnPicker(false);
    setServiceConfirmed(true);
  }

  function handleAddOnNext() {
    setShowAddOnPicker(false);
    setServiceConfirmed(true);
  }

  function handleCreativePairingBack() {
    setShowCreativePairing(false);
  }

  function handleCreativePairingComplete(
    baseServiceId: string,
    colorOption: string,
  ) {
    const baseService = getBookableCategories()
      .flatMap((c) => c.services)
      .find((s) => s.id === baseServiceId);

    if (!baseService) return;

    setSelectedService(baseService);
    setSelectedAddOnIds(["creative-accent-coloring"]);
    setAddOnOptions({ "creative-accent-coloring": colorOption });
    setShowCreativePairing(false);
    setServiceConfirmed(true);
  }

  function toggleAddOn(id: string) {
    if (selectedAddOnIds.includes(id)) {
      setSelectedAddOnIds((prev) => prev.filter((x) => x !== id));
      setAddOnOptions((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    setSelectedAddOnIds((prev) => [...prev, id]);
    const addOn = getAddOnService(id);
    if (addOn?.options?.[0]) {
      setAddOnOptions((prev) => ({
        ...prev,
        [id]: addOn.options![0].name,
      }));
    }
  }

  function handleAddOnOptionChange(addOnId: string, optionName: string) {
    setAddOnOptions((prev) => ({ ...prev, [addOnId]: optionName }));
    if (!selectedAddOnIds.includes(addOnId)) {
      setSelectedAddOnIds((prev) => [...prev, addOnId]);
    }
  }

  function formatAddOnLabel(id: string, weightLbs: number) {
    const addOn = getAddOnService(id);
    if (!addOn) return null;
    const optionName = addOnOptions[id];
    const price = formatServicePrice(addOn, weightLbs, optionName);
    const label = optionName ? `${addOn.name} · ${optionName}` : addOn.name;
    return price ? `${label} (${price})` : label;
  }

  const step = !categoryId
    ? 1
    : !serviceConfirmed
      ? 2
      : !selectedPet
        ? 3
        : !address || !travelQuote
          ? 4
          : !appointmentDate || !appointmentTime
            ? 5
            : 6;

  const addOnLines =
    selectedPet && bookingSelection
      ? selectedAddOnIds
          .map((id) => {
            const label = formatAddOnLabel(id, selectedPet.weightLbs);
            return label ? `Add-on: ${label}` : null;
          })
          .filter(Boolean)
      : [];

  const mailtoHref =
    selectedPet && bookingSelection && address && travelQuote
      ? `mailto:${business.brand.email}?subject=${encodeURIComponent(
          `Booking Request - ${selectedPet.name}`,
        )}&body=${encodeURIComponent(
          [
            `Pet: ${selectedPet.name} (${selectedPet.weightLbs} lbs)`,
            `Service: ${bookingSelection.serviceName}`,
            ...addOnLines,
            `Address: ${formatServiceAddress(address)}`,
            `Travel: ${travelQuote.distanceMiles} mi · Fee $${travelQuote.fee}`,
            `Date: ${appointmentDate}`,
            `Time: ${appointmentTime}`,
            `Estimated service: ${bookingSelection.priceLabel}`,
          ]
            .filter(Boolean)
            .join("\n"),
        )}`
      : "#";

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
            onSelect={handleServiceSelect}
            onBack={handleBackToCategories}
            onBook={handleBookService}
          />
        </section>
      )}

      {showCreativePairing && selectedService && (
        <CreativePairingModal
          creativeService={selectedService}
          requiredBaseServices={getRequiredBaseServicesForCreative()}
          onComplete={handleCreativePairingComplete}
          onBack={handleCreativePairingBack}
        />
      )}

      {showAddOnPicker && availableAddOns.length > 0 && (
        <AddOnPickerModal
          addOns={availableAddOns}
          selectedIds={selectedAddOnIds}
          addOnOptions={addOnOptions}
          onToggle={toggleAddOn}
          onOptionChange={handleAddOnOptionChange}
          onBack={handleAddOnBack}
          onSkip={handleAddOnSkip}
          onNext={handleAddOnNext}
        />
      )}

      {step === 3 && selectedService && (
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
            {selectedAddOnIds.length > 0 && (
              <div className="mt-3 border-t border-lavender/30 pt-3 text-left text-sm">
                <p className="text-text-muted">Add-ons:</p>
                <ul className="mt-1 space-y-1">
                  {selectedAddOnIds.map((id) => {
                    const addOn = getAddOnService(id);
                    if (!addOn) return null;
                    const optionName = addOnOptions[id];
                    return (
                      <li key={id} className="text-text">
                        {addOn.name}
                        {optionName ? ` · ${optionName}` : ""}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-medium text-gold-dark">Select Pet</h2>
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

      {step === 4 && selectedPet && (
        <AddressStep
          initialAddress={address}
          initialQuote={travelQuote}
          onBack={() => {
            setSelectedPet(null);
            setAddress(null);
            setTravelQuote(null);
          }}
          onConfirmed={(addr, quote) => {
            setAddress(addr);
            setTravelQuote(quote);
            setAppointmentDate(null);
            setAppointmentTime(null);
          }}
        />
      )}

      {step === 5 && (
        <DateTimeStep
          initialDate={appointmentDate}
          initialTime={appointmentTime}
          onBack={() => {
            setAppointmentDate(null);
            setAppointmentTime(null);
          }}
          onConfirmed={(date, time) => {
            setAppointmentDate(date);
            setAppointmentTime(time);
          }}
        />
      )}

      {step === 6 &&
        selectedPet &&
        selectedService &&
        bookingSelection &&
        address &&
        travelQuote &&
        appointmentDate &&
        appointmentTime && (
          <section className="mx-auto max-w-xl space-y-6">
            <button
              type="button"
              onClick={() => {
                setAppointmentDate(null);
                setAppointmentTime(null);
              }}
              className="text-sm text-gold-dark underline"
            >
              ← Change date &amp; time
            </button>

            <h2 className="text-lg font-medium text-gold-dark">
              Review booking
            </h2>

            <div className="space-y-3 rounded-2xl border border-lavender/30 bg-cream px-5 py-4 text-sm">
              <p>
                <span className="text-text-muted">Pet:</span>{" "}
                <strong>
                  {selectedPet.name} ({selectedPet.weightLbs} lbs)
                </strong>
              </p>
              <p>
                <span className="text-text-muted">Service:</span>{" "}
                <strong>{bookingSelection.serviceName}</strong>
              </p>
              {selectedAddOnIds.length > 0 && (
                <div>
                  <p className="text-text-muted">Add-ons:</p>
                  <ul className="mt-1 space-y-1">
                    {selectedAddOnIds.map((id) => {
                      const label = formatAddOnLabel(id, selectedPet.weightLbs);
                      return label ? (
                        <li key={id}>
                          <strong>{label}</strong>
                        </li>
                      ) : null;
                    })}
                  </ul>
                </div>
              )}
              <p>
                <span className="text-text-muted">Address:</span>{" "}
                <strong>{formatServiceAddress(address)}</strong>
              </p>
              <p>
                <span className="text-text-muted">Travel:</span>{" "}
                <strong>
                  {travelQuote.distanceMiles} mi ·{" "}
                  {formatPrice(travelQuote.fee)}
                  {travelQuote.fee === 0 ? " (free)" : ""}
                </strong>
              </p>
              <p>
                <span className="text-text-muted">When:</span>{" "}
                <strong>
                  {appointmentDate} · {appointmentTime}
                </strong>
              </p>
              <p>
                <span className="text-text-muted">Service estimate:</span>{" "}
                <strong>{bookingSelection.priceLabel}</strong>
              </p>
            </div>

            <p className="text-sm text-text-muted">
              {business.booking.paymentMethodNote}
            </p>

            <a
              href={mailtoHref}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-gold px-6 py-3 text-sm font-medium text-white hover:bg-gold-dark"
            >
              Email booking request
            </a>
          </section>
        )}
    </div>
  );
}
