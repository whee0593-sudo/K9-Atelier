"use client";

import { useRef, useState } from "react";
import type { PetProfile } from "@/lib/pets";
import {
  getAddOnService,
  getCreativeColoringService,
  getRequiredBaseServicesForCreative,
  type BookableService,
  type SelectedService,
  formatServicePrice,
} from "@/lib/services";
import { getServiceDisplayName } from "@/lib/service-display";
import type { ServiceAddress, TravelQuote } from "@/lib/travel";
import { BookingProgress } from "@/components/booking/BookingProgress";
import { BookingPoliciesModal } from "@/components/booking/BookingPoliciesModal";
import { PetSelector } from "@/components/booking/PetSelector";
import {
  BookingExperienceStep,
  isCreativeServiceSelection,
} from "@/components/booking/BookingExperienceStep";
import { BookingCareOptionsStep } from "@/components/booking/BookingCareOptionsStep";
import { BookingLocationTimeStep } from "@/components/booking/BookingLocationTimeStep";
import {
  BookingConfirmationView,
  BookingReviewStep,
} from "@/components/booking/BookingReviewStep";
import { CreativePairingModal } from "@/components/booking/CreativePairingModal";
import Link from "next/link";
import { bookingBackLinkClass } from "@/components/booking/booking-ui";

export function BookingFlow() {
  const [selectedPet, setSelectedPet] = useState<PetProfile | null>(null);
  const [selectedService, setSelectedService] = useState<BookableService | null>(
    null,
  );
  const [serviceConfirmed, setServiceConfirmed] = useState(false);
  const [careOptionsConfirmed, setCareOptionsConfirmed] = useState(false);
  const [showCreativePairing, setShowCreativePairing] = useState(false);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [addOnOptions, setAddOnOptions] = useState<Record<string, string>>({});
  const [address, setAddress] = useState<ServiceAddress | null>(null);
  const [travelQuote, setTravelQuote] = useState<TravelQuote | null>(null);
  const [appointmentDate, setAppointmentDate] = useState<string | null>(null);
  const [appointmentTime, setAppointmentTime] = useState<string | null>(null);
  const [reserved, setReserved] = useState(false);
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const policiesTriggerRef = useRef<HTMLButtonElement>(null);

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

  function resetFromPet() {
    setSelectedService(null);
    setServiceConfirmed(false);
    setCareOptionsConfirmed(false);
    setSelectedAddOnIds([]);
    setAddOnOptions({});
    setAddress(null);
    setTravelQuote(null);
    setAppointmentDate(null);
    setAppointmentTime(null);
    setShowCreativePairing(false);
  }

  function resetFromService() {
    setCareOptionsConfirmed(false);
    setSelectedAddOnIds([]);
    setAddOnOptions({});
    setAddress(null);
    setTravelQuote(null);
    setAppointmentDate(null);
    setAppointmentTime(null);
  }

  function handlePetSelect(pet: PetProfile) {
    setSelectedPet(pet);
    resetFromPet();
  }

  function handleServiceSelect(service: BookableService) {
    setSelectedService(service);
    setServiceConfirmed(false);
    resetFromService();
  }

  function handleExperienceContinue(service?: BookableService) {
    const nextService = service ?? selectedService;
    if (!nextService) return;
    if (service) {
      setSelectedService(service);
      resetFromService();
    }
    if (isCreativeServiceSelection(nextService)) {
      setShowCreativePairing(true);
      return;
    }
    setServiceConfirmed(true);
  }

  function handleCreativeComplete(baseServiceId: string, colorOption: string) {
    const base = getRequiredBaseServicesForCreative().find(
      (s) => s.id === baseServiceId,
    );
    if (!base) return;
    setSelectedService(base);
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

  const currentStep = reserved
    ? 6
    : !selectedPet
      ? 1
      : !serviceConfirmed
        ? 2
        : !careOptionsConfirmed
          ? 3
          : !address || !travelQuote || !appointmentDate || !appointmentTime
            ? 4
            : 5;

  const creativeService = getCreativeColoringService();

  if (reserved && selectedPet && selectedService && appointmentDate && appointmentTime && address) {
    return (
      <BookingConfirmationView
        pet={selectedPet}
        serviceName={getServiceDisplayName(
          selectedService.id,
          selectedService.name,
        )}
        appointmentDate={appointmentDate}
        appointmentTime={appointmentTime}
        address={address}
      />
    );
  }

  return (
    <div className="mt-8 space-y-8">
      {currentStep <= 5 && <BookingProgress currentStep={Math.min(currentStep, 5)} />}

      {currentStep === 1 && (
        <section>
          <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
            Your Dog
          </p>
          <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
            Who Are We Welcoming?
          </h2>
          <p className="font-body mt-4 text-sm text-taupe">
            Select a dog to begin their private appointment.
          </p>
          <div className="mt-8">
            <PetSelector
              selectedId={selectedPet?.id ?? null}
              onSelect={handlePetSelect}
            />
          </div>
        </section>
      )}

      {currentStep === 2 && selectedPet && (
        <BookingExperienceStep
          pet={selectedPet}
          selectedServiceId={selectedService?.id ?? null}
          onSelect={handleServiceSelect}
          onContinue={handleExperienceContinue}
          onBack={() => {
            setSelectedPet(null);
            resetFromPet();
          }}
        />
      )}

      {showCreativePairing && creativeService && (
        <CreativePairingModal
          creativeService={creativeService}
          requiredBaseServices={getRequiredBaseServicesForCreative()}
          onComplete={handleCreativeComplete}
          onBack={() => setShowCreativePairing(false)}
        />
      )}

      {currentStep === 3 && selectedPet && selectedService && serviceConfirmed && (
        <BookingCareOptionsStep
          pet={selectedPet}
          primaryService={selectedService}
          selectedIds={selectedAddOnIds}
          addOnOptions={addOnOptions}
          onToggle={toggleAddOn}
          onOptionChange={handleAddOnOptionChange}
          onContinue={() => setCareOptionsConfirmed(true)}
          onBack={() => {
            setServiceConfirmed(false);
            resetFromService();
          }}
        />
      )}

      {currentStep === 4 && selectedPet && selectedService && (
        <BookingLocationTimeStep
          pet={selectedPet}
          initialAddress={address}
          initialQuote={travelQuote}
          initialDate={appointmentDate}
          initialTime={appointmentTime}
          onBack={() => setCareOptionsConfirmed(false)}
          onComplete={(addr, quote, date, time) => {
            setAddress(addr);
            setTravelQuote(quote);
            setAppointmentDate(date);
            setAppointmentTime(time);
          }}
        />
      )}

      {currentStep === 5 &&
        selectedPet &&
        selectedService &&
        bookingSelection &&
        address &&
        travelQuote &&
        appointmentDate &&
        appointmentTime && (
          <BookingReviewStep
            pet={selectedPet}
            service={selectedService}
            bookingSelection={bookingSelection}
            addOnIds={selectedAddOnIds}
            addOnOptions={addOnOptions}
            address={address}
            travelQuote={travelQuote}
            appointmentDate={appointmentDate}
            appointmentTime={appointmentTime}
            onMakeChange={() => {
              setAppointmentDate(null);
              setAppointmentTime(null);
            }}
            onReserved={() => setReserved(true)}
          />
        )}

      {currentStep <= 5 && (
        <div className="border-t border-gray-line/70 pt-6 text-center">
          <p className="font-body text-xs text-taupe">
            Additional care or travel fees may apply where necessary.
          </p>
          <button
            ref={policiesTriggerRef}
            type="button"
            onClick={() => setPoliciesOpen(true)}
            className={`${bookingBackLinkClass} mt-3`}
          >
            View Service Policies
          </button>
          <p className="font-body mt-4 text-xs text-taupe">
            Need help?{" "}
            <Link href="/contact" className="text-ink underline">
              Contact the Atelier
            </Link>
          </p>
        </div>
      )}

      <BookingPoliciesModal
        open={policiesOpen}
        onClose={() => setPoliciesOpen(false)}
        returnFocusRef={policiesTriggerRef}
      />
    </div>
  );
}
