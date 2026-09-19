"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PetProfile } from "@/lib/pets";
import type { AppointmentRecord } from "@/lib/appointments/types";
import {
  getAddOnService,
  getCreativeColoringService,
  getRequiredBaseServicesForCreative,
  type BookableService,
} from "@/lib/services";
import { getServiceDisplayName } from "@/lib/service-display";
import type { ServiceAddress, TravelQuote } from "@/lib/travel";
import type { TimePreference } from "@/lib/booking-schedule";
import { BookingProgress } from "@/components/booking/BookingProgress";
import {
  BookingPoliciesModal,
  type BookingPolicySectionId,
} from "@/components/booking/BookingPoliciesModal";
import { BookingDogStep } from "@/components/booking/BookingDogStep";
import { BookingLocationTimeStep } from "@/components/booking/BookingLocationTimeStep";
import {
  BookingExperienceStep,
  isCreativeServiceSelection,
} from "@/components/booking/BookingExperienceStep";
import { BookingCareOptionsStep } from "@/components/booking/BookingCareOptionsStep";
import { BookingOwnerStep, type BookingOwnerDetails } from "@/components/booking/BookingOwnerStep";
import { BookingPaymentStep } from "@/components/booking/BookingPaymentStep";
import { BookingConfirmStep } from "@/components/booking/BookingConfirmStep";
import { BookingConfirmationView } from "@/components/booking/BookingReviewStep";
import { CreativePairingModal } from "@/components/booking/CreativePairingModal";
import { bookingBackLinkClass } from "@/components/booking/booking-ui";
import { trackGoogleAdsBookingConversion } from "@/lib/google-ads";
import { createDraftBookingPet, isPersistedPetId } from "@/lib/booking-flow";
import { createCustomerPet } from "@/lib/pets/client";
import { mapPetProfileToWriteInput } from "@/lib/pets/map";
import { createClient } from "@/lib/supabase/client";
import type { PaymentMethodRecord } from "@/lib/payments/types";

const BOOKING_SUCCESS_SESSION_KEY = "k9-booking-success";

type BookingSuccessSnapshot = {
  appointment: AppointmentRecord;
  pet: PetProfile;
  service: BookableService;
  appointmentDate: string;
  appointmentTime: string;
  address: ServiceAddress;
};

function readBookingSuccessSnapshot(): BookingSuccessSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(BOOKING_SUCCESS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookingSuccessSnapshot;
    if (
      !parsed?.appointment?.id ||
      !parsed.pet ||
      !parsed.service ||
      !parsed.appointmentDate ||
      !parsed.appointmentTime ||
      !parsed.address
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeBookingSuccessSnapshot(snapshot: BookingSuccessSnapshot) {
  window.sessionStorage.setItem(
    BOOKING_SUCCESS_SESSION_KEY,
    JSON.stringify(snapshot),
  );
}

function clearBookingSuccessSnapshot() {
  window.sessionStorage.removeItem(BOOKING_SUCCESS_SESSION_KEY);
}

function isReloadNavigation() {
  const nav = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  return nav?.type === "reload";
}

export function BookingFlow({
  initialReferralCode = "",
}: {
  initialReferralCode?: string;
}) {
  const [draftPet, setDraftPet] = useState<PetProfile>(() => createDraftBookingPet());
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
  const [timePreference, setTimePreference] = useState<TimePreference | null>(
    null,
  );
  const [slotStartMinutes, setSlotStartMinutes] = useState<number | null>(null);
  const [owner, setOwner] = useState<BookingOwnerDetails | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodRecord | null>(
    null,
  );
  const [careSlotError, setCareSlotError] = useState<string | null>(null);
  const [reserved, setReserved] = useState(false);
  const [createdAppointment, setCreatedAppointment] =
    useState<AppointmentRecord | null>(null);
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const [policiesSection, setPoliciesSection] = useState<
    BookingPolicySectionId | undefined
  >();
  const policiesTriggerRef = useRef<HTMLButtonElement>(null);

  function openPolicies(section?: BookingPolicySectionId) {
    setPoliciesSection(section);
    setPoliciesOpen(true);
  }

  useEffect(() => {
    const snapshot = readBookingSuccessSnapshot();
    if (snapshot && isReloadNavigation()) {
      setSelectedPet(snapshot.pet);
      setSelectedService(snapshot.service);
      setAppointmentDate(snapshot.appointmentDate);
      setAppointmentTime(snapshot.appointmentTime);
      setAddress(snapshot.address);
      setCreatedAppointment(snapshot.appointment);
      setReserved(true);
      return;
    }
    clearBookingSuccessSnapshot();
  }, []);

  function resetFromDog() {
    setSelectedService(null);
    setServiceConfirmed(false);
    setCareOptionsConfirmed(false);
    setSelectedAddOnIds([]);
    setAddOnOptions({});
    setAddress(null);
    setTravelQuote(null);
    setAppointmentDate(null);
    setAppointmentTime(null);
    setTimePreference(null);
    setSlotStartMinutes(null);
    setOwner(null);
    setPaymentMethod(null);
    setShowCreativePairing(false);
    setCareSlotError(null);
  }

  async function handleDogContinue(pet: PetProfile) {
    let nextPet = pet;
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && !isPersistedPetId(pet.id)) {
        nextPet = await createCustomerPet(mapPetProfileToWriteInput(pet));
      }
    } catch {
      nextPet = pet;
    }
    if (!isPersistedPetId(pet.id)) {
      setDraftPet(nextPet);
    }
    resetFromDog();
    setSelectedPet(nextPet);
  }

  function handleServiceSelect(service: BookableService, optionName?: string) {
    setSelectedService(service);
    setServiceConfirmed(false);
    setCareOptionsConfirmed(false);
    setSelectedAddOnIds([]);
    setAddOnOptions(
      optionName ? { [service.id]: optionName } : {},
    );
    setOwner(null);
    setPaymentMethod(null);
  }

  function handleExperienceContinue(service?: BookableService) {
    const nextService = service ?? selectedService;
    if (!nextService) return;
    if (service) {
      setSelectedService(service);
      setCareOptionsConfirmed(false);
      setSelectedAddOnIds([]);
      setAddOnOptions({});
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

  async function confirmCareSlot() {
    if (
      !selectedPet ||
      !selectedService ||
      !travelQuote?.lat ||
      travelQuote.lon == null ||
      !address ||
      !appointmentDate ||
      slotStartMinutes == null
    ) {
      return false;
    }
    setCareSlotError(null);
    const res = await fetch("/api/booking/availability", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: travelQuote.lat,
        lon: travelQuote.lon,
        zip: address.zip,
        serviceId: selectedService.id,
        weightLbs: selectedPet.weightLbs,
        addOnIds: selectedAddOnIds,
        date: appointmentDate,
        slotStartMinutes,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      appointmentTime?: string;
      usedPreference?: TimePreference;
      slotStartMinutes?: number;
    };
    if (!res.ok || !data.appointmentTime) {
      setCareSlotError(
        data.error ??
          "That time is no longer available for this service. Please choose another date or time.",
      );
      setAppointmentDate(null);
      setAppointmentTime(null);
      setTimePreference(null);
      setSlotStartMinutes(null);
      setCareOptionsConfirmed(false);
      return false;
    }
    setAppointmentTime(data.appointmentTime);
    setTimePreference(data.usedPreference ?? timePreference);
    setSlotStartMinutes(data.slotStartMinutes ?? slotStartMinutes);
    setCareOptionsConfirmed(true);
    return true;
  }

  const currentStep = reserved
    ? 6
    : !selectedPet
      ? 1
      : !address || !travelQuote || !appointmentDate || !appointmentTime
        ? 2
        : !serviceConfirmed || !careOptionsConfirmed
          ? 3
          : !owner
            ? 4
            : !paymentMethod
              ? 5
              : 6;

  const creativeService = getCreativeColoringService();

  if (
    reserved &&
    selectedPet &&
    selectedService &&
    appointmentDate &&
    appointmentTime &&
    address
  ) {
    return (
      <BookingConfirmationView
        pet={selectedPet}
        serviceName={getServiceDisplayName(
          selectedService.id,
          selectedService.name,
        )}
        appointmentDate={appointmentDate}
        appointmentTime={createdAppointment?.appointmentTime ?? appointmentTime}
        address={address}
        appointmentStatus={createdAppointment?.status}
        appointmentId={createdAppointment?.id}
        celebrate
      />
    );
  }

  return (
    <div className="mt-8 space-y-8">
      {currentStep <= 6 && <BookingProgress currentStep={Math.min(currentStep, 6)} />}

      {currentStep === 1 && (
        <BookingDogStep
          draftPet={draftPet}
          onDraftChange={(updates) =>
            setDraftPet((current) => ({ ...current, ...updates }))
          }
          onContinue={handleDogContinue}
        />
      )}

      {currentStep === 2 && selectedPet && (
        <BookingLocationTimeStep
          pet={selectedPet}
          initialAddress={address}
          initialQuote={travelQuote}
          initialDate={appointmentDate}
          initialSlotStartMinutes={slotStartMinutes}
          onBack={() => {
            setSelectedPet(null);
            resetFromDog();
          }}
          onComplete={(addr, quote, date, time, preference, slotStart) => {
            setAddress(addr);
            setTravelQuote(quote);
            setAppointmentDate(date);
            setAppointmentTime(time);
            setTimePreference(preference);
            setSlotStartMinutes(slotStart);
            setCareSlotError(null);
          }}
        />
      )}

      {currentStep === 3 && selectedPet && !serviceConfirmed && (
        <BookingExperienceStep
          pet={selectedPet}
          selectedServiceId={selectedService?.id ?? null}
          selectedOptionName={
            selectedService && isCreativeServiceSelection(selectedService)
              ? addOnOptions[selectedService.id] ?? null
              : null
          }
          onSelect={handleServiceSelect}
          onContinue={handleExperienceContinue}
          onBack={() => {
            setAppointmentDate(null);
            setAppointmentTime(null);
            setTimePreference(null);
            setSlotStartMinutes(null);
          }}
        />
      )}

      {showCreativePairing && creativeService && (
        <CreativePairingModal
          creativeService={creativeService}
          requiredBaseServices={getRequiredBaseServicesForCreative()}
          initialColorOption={addOnOptions[creativeService.id] ?? null}
          onComplete={handleCreativeComplete}
          onBack={() => setShowCreativePairing(false)}
        />
      )}

      {currentStep === 3 &&
        selectedPet &&
        selectedService &&
        serviceConfirmed &&
        !careOptionsConfirmed && (
          <BookingCareOptionsStep
            pet={selectedPet}
            primaryService={selectedService}
            selectedIds={selectedAddOnIds}
            addOnOptions={addOnOptions}
            onToggle={toggleAddOn}
            onOptionChange={handleAddOnOptionChange}
            onContinue={() => {
              void confirmCareSlot();
            }}
            onBack={() => {
              setServiceConfirmed(false);
              setSelectedAddOnIds([]);
              setAddOnOptions({});
            }}
          />
        )}

      {careSlotError && currentStep === 2 ? (
        <p
          className="font-body rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {careSlotError}
        </p>
      ) : null}

      {currentStep === 4 && selectedPet && (
        <BookingOwnerStep
          initial={
            owner ?? {
              firstName: "",
              lastName: "",
              email: "",
              phone: "",
              smsConsent: false,
              photoMarketingConsent: false,
              servicePoliciesConsent: false,
            }
          }
          onBack={() => setCareOptionsConfirmed(false)}
          onOpenPolicy={openPolicies}
          onComplete={setOwner}
        />
      )}

      {currentStep === 5 && (
        <BookingPaymentStep
          initialPaymentMethodId={paymentMethod?.id ?? null}
          onBack={() => setOwner(null)}
          onComplete={setPaymentMethod}
        />
      )}

      {currentStep === 6 &&
        selectedPet &&
        selectedService &&
        address &&
        travelQuote &&
        appointmentDate &&
        appointmentTime &&
        slotStartMinutes != null &&
        owner &&
        paymentMethod && (
          <BookingConfirmStep
            pet={selectedPet}
            service={selectedService}
            addOnIds={selectedAddOnIds}
            addOnOptions={addOnOptions}
            address={address}
            travelQuote={travelQuote}
            appointmentDate={appointmentDate}
            appointmentTime={appointmentTime}
            slotStartMinutes={slotStartMinutes}
            owner={owner}
            paymentMethod={paymentMethod}
            initialReferralCode={initialReferralCode}
            onBack={() => setPaymentMethod(null)}
            onReserved={(appointment, pet) => {
              trackGoogleAdsBookingConversion(appointment.id);
              writeBookingSuccessSnapshot({
                appointment,
                pet,
                service: selectedService,
                appointmentDate,
                appointmentTime:
                  appointment.appointmentTime || appointmentTime,
                address,
              });
              setSelectedPet(pet);
              setCreatedAppointment(appointment);
              setReserved(true);
            }}
          />
        )}

      {currentStep <= 6 && (
        <div className="border-t border-gray-line/70 pt-6 text-center">
          <p className="font-body text-xs text-taupe">
            Additional care or travel fees may apply where necessary.
          </p>
          <button
            ref={policiesTriggerRef}
            type="button"
            onClick={() => openPolicies()}
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
        onClose={() => {
          setPoliciesOpen(false);
          setPoliciesSection(undefined);
        }}
        returnFocusRef={policiesTriggerRef}
        initialSection={policiesSection}
      />
    </div>
  );
}
