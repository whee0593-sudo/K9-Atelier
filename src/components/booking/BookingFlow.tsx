"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PetProfile } from "@/lib/pets";
import type { AppointmentRecord } from "@/lib/appointments/types";
import {
  getAddOnService,
  creativeSelectionId,
  isCustomCreativeDesignSelection,
  type BookableService,
} from "@/lib/services";
import { guestBookingSelectionError } from "@/lib/booking-price";
import { getServiceDisplayName } from "@/lib/service-display";
import type { ServiceAddress, TravelQuote } from "@/lib/travel";
import { ARRIVAL_WINDOW_PENDING_LABEL } from "@/lib/appointments/arrival-window";
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
import { nextIdempotencyKey } from "@/lib/booking-intent";
import { BookingConfirmStep } from "@/components/booking/BookingConfirmStep";
import { BookingGroupConfirmStep } from "@/components/booking/BookingGroupConfirmStep";
import { bookingDogsIntent, validateBookingDogs, type BookingDogService } from "@/lib/booking/dogs";
import { BookingConfirmationView } from "@/components/booking/BookingReviewStep";
import { bookingBackLinkClass } from "@/components/booking/booking-ui";
import { trackGoogleAdsBookingConversion } from "@/lib/google-ads";
import { createDraftBookingPet, isPersistedPetId, toggleBookingServiceIds } from "@/lib/booking-flow";
import { isLuxurySpaDay } from "@/lib/service-catalog";
import type { SpaGoalId } from "@/lib/spa-goals";
import { createCustomerPet, updateCustomerPet } from "@/lib/pets/client";
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
  dogs?: BookingDogService[];
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
  showPrices = false,
}: {
  initialReferralCode?: string;
  showPrices?: boolean;
}) {
  const [draftPet, setDraftPet] = useState<PetProfile>(() => createDraftBookingPet());
  const [selectedPet, setSelectedPet] = useState<PetProfile | null>(null);
  const [bookedDogs, setBookedDogs] = useState<BookingDogService[]>([]);
  const [savingDogs, setSavingDogs] = useState(false);
  const [dogsError, setDogsError] = useState<string | null>(null);
  const savingDogsRef = useRef(false);
  const [selectedService, setSelectedService] = useState<BookableService | null>(
    null,
  );
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [serviceConfirmed, setServiceConfirmed] = useState(false);
  const [careOptionsConfirmed, setCareOptionsConfirmed] = useState(false);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [addOnOptions, setAddOnOptions] = useState<Record<string, string>>({});
  const [spaGoals, setSpaGoals] = useState<SpaGoalId[]>([]);
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
  const [idempotency, setIdempotency] = useState<{
    intent: string;
    key: string;
  } | null>(null);
  const [reserved, setReserved] = useState(false);
  const [createdAppointment, setCreatedAppointment] =
    useState<AppointmentRecord | null>(null);
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const [policiesSection, setPoliciesSection] = useState<
    BookingPolicySectionId | undefined
  >();
  const policiesTriggerRef = useRef<HTMLButtonElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);

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
      setSlotStartMinutes(snapshot.appointment.scheduledStart);
      if (snapshot.dogs) {
        setBookedDogs(snapshot.dogs);
      }
      setCreatedAppointment(snapshot.appointment);
      setReserved(true);
      return;
    }
    clearBookingSuccessSnapshot();
  }, []);

  function resetFromDog() {
    setSelectedService(null);
    setSelectionError(null);
    setServiceConfirmed(false);
    setCareOptionsConfirmed(false);
    setSelectedAddOnIds([]);
    setAddOnOptions({});
    setSpaGoals([]);
    setAddress(null);
    setTravelQuote(null);
    setAppointmentDate(null);
    setAppointmentTime(null);
    setTimePreference(null);
    setSlotStartMinutes(null);
    setOwner(null);
    setPaymentMethod(null);
  }

  function currentDogs() {
    if (!selectedPet || !selectedService) return bookedDogs;
    const previous = bookedDogs.find((dog) => dog.pet.id === selectedPet.id);
    const dog = { bookingKey: previous?.bookingKey ?? selectedPet.id, pet: selectedPet, service: selectedService, addOnIds: selectedAddOnIds, addOnOptions, spaGoals };
    return bookedDogs.some((current) => current.pet.id === selectedPet.id)
      ? bookedDogs.map((current) => current.pet.id === selectedPet.id ? dog : current)
      : [...bookedDogs, dog];
  }

  function handleAddDog() {
    if (!selectedPet || !selectedService) return;
    setBookedDogs(currentDogs());
    setDraftPet(createDraftBookingPet());
    setSelectedPet(null);
    resetFromDog();
    setDogsError(null);
  }

  async function handleCareContinue() {
    if (!selectedPet || !selectedService || savingDogsRef.current) return;
    savingDogsRef.current = true;
    setSavingDogs(true);
    setDogsError(null);
    const dogs = currentDogs();
    setBookedDogs([...dogs]);
    try {
      const errors = validateBookingDogs(dogs.map((dog) => dog.pet));
      const invalid = dogs.find((dog) => errors[dog.pet.id]);
      if (invalid) throw new Error(`${invalid.pet.name}: ${errors[invalid.pet.id]}`);
      let signedIn = false;
      try { signedIn = Boolean((await createClient().auth.getUser()).data.user); } catch { /* Guest drafts are kept until account creation. */ }
      if (signedIn) {
        for (const [index, dog] of dogs.entries()) {
          const input = mapPetProfileToWriteInput(dog.pet);
          const pet = isPersistedPetId(dog.pet.id)
            ? await updateCustomerPet(dog.pet.id, input)
            : await createCustomerPet(input);
          dogs[index] = { ...dog, pet };
          setBookedDogs([...dogs]);
          if (index === dogs.length - 1) { setSelectedPet(pet); setDraftPet(pet); }
        }
      }
      setCareOptionsConfirmed(true);
    } catch (error) {
      setDogsError(error instanceof Error ? error.message : "Could not save your dogs. Please try again.");
    } finally {
      savingDogsRef.current = false;
      setSavingDogs(false);
    }
  }

  function handleDogContinue(pet: PetProfile) {
    if (bookedDogs.some((dog) => dog.pet.id === pet.id)) {
      throw new Error("This dog is already included in your visit. Please choose another dog.");
    }
    setDraftPet(pet);
    resetFromDog();
    setSelectedPet(pet);
  }

  function handleServiceSelect(service: BookableService, optionName?: string) {
    if (isCustomCreativeDesignSelection(service.id, optionName)) return;
    if (optionName && isCreativeServiceSelection(service)) service = { ...service, id: creativeSelectionId(optionName) };
    const ids = [...(selectedService ? [selectedService.id] : []), ...selectedAddOnIds];
    const sameOption = !optionName || addOnOptions[service.id] === optionName;
    const removing = ids.includes(service.id) && sameOption;
    const nextIds = toggleBookingServiceIds(ids, service.id);
    const primary = nextIds.map((id) => getAddOnService(id))
      .find((item) => item?.bookableAsPrimary && !isCreativeServiceSelection(item));
    setSelectedService(primary ?? null);
    setSelectedAddOnIds(nextIds.filter((id) => id !== primary?.id));
    setAddOnOptions((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([id]) => nextIds.includes(id)));
      if (removing) delete next[service.id];
      else if (optionName) next[service.id] = optionName;
      return next;
    });
    setSelectionError(null);
    setServiceConfirmed(false);
    setCareOptionsConfirmed(false);
    if (!nextIds.some((id) => isLuxurySpaDay(id))) setSpaGoals([]);
    setOwner(null);
    setPaymentMethod(null);
  }

  function handleExperienceContinue() {
    if (!selectedService) {
      setSelectionError("Please select a primary service.");
      return;
    }
    const error = guestBookingSelectionError({ serviceId: selectedService.id, addOnIds: selectedAddOnIds, addOnOptions });
    if (error) { setSelectionError(error.message); return; }
    setSelectionError(null);
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
    if (isCustomCreativeDesignSelection(addOnId, optionName)) return;
    setAddOnOptions((prev) => ({ ...prev, [addOnId]: optionName }));
    if (!selectedAddOnIds.includes(addOnId)) {
      setSelectedAddOnIds((prev) => [...prev, addOnId]);
    }
  }

  const bookingIntent =
    selectedPet &&
    selectedService &&
    address &&
    appointmentDate &&
    slotStartMinutes != null &&
    paymentMethod
      ? [
          bookingDogsIntent(bookedDogs),
          selectedService.id,
          [...selectedAddOnIds]
            .sort()
            .map((id) => `${id}=${addOnOptions[id] ?? ""}`)
            .join(","),
          address.street,
          address.city,
          address.state,
          address.zip,
          appointmentDate,
          slotStartMinutes,
          paymentMethod.id,
          [...spaGoals].sort().join(","),
        ].join("|")
      : "";

  useEffect(() => {
    if (!bookingIntent) return;
    setIdempotency((current) =>
      nextIdempotencyKey(current, bookingIntent, () => crypto.randomUUID()),
    );
  }, [bookingIntent]);

  const currentStep = reserved
    ? 6
    : !selectedPet
      ? 1
      : !serviceConfirmed || !careOptionsConfirmed
        ? 2
        : !address || !travelQuote || !appointmentDate || slotStartMinutes == null
          ? 3
          : !owner
            ? 4
            : !paymentMethod
              ? 5
              : 6;

  useEffect(() => {
    flowRef.current?.scrollIntoView({ block: "start" });
  }, [currentStep, selectedPet?.id, serviceConfirmed]);

  if (
    reserved &&
    selectedPet &&
    selectedService &&
    appointmentDate &&
    slotStartMinutes != null &&
    address
  ) {
    return (
      <BookingConfirmationView
        pet={selectedPet}
        additionalPetNames={bookedDogs.filter((dog) => dog.pet.id !== selectedPet.id).map((dog) => dog.pet.name)}
        serviceName={bookedDogs.length > 1 ? bookedDogs.map((dog) => `${dog.pet.name}: ${getServiceDisplayName(dog.service.id, dog.service.name)}`).join(" · ") : getServiceDisplayName(
          selectedService.id,
          selectedService.name,
        ) + ((createdAppointment?.addOnIds ?? selectedAddOnIds).length ? " · " + (createdAppointment?.addOnIds ?? selectedAddOnIds).map((id) => getAddOnService(id)?.name ?? id).join(" · ") : "")}
        appointmentDate={appointmentDate}
        appointmentTime={
          createdAppointment?.appointmentTime ??
          appointmentTime ??
          ARRIVAL_WINDOW_PENDING_LABEL
        }
        address={address}
        appointmentStatus={createdAppointment?.status}
        appointmentId={createdAppointment?.id}
        celebrate
      />
    );
  }

  return (
    <div ref={flowRef} className="mt-8 w-full min-w-0 scroll-mt-28 space-y-8">
      {currentStep <= 6 && <BookingProgress currentStep={Math.min(currentStep, 6)} />}
      {currentStep <= 3 && bookedDogs.length > 0 ? <div className="font-body text-sm text-ink" role="status">
        <p>Included in this visit: {bookedDogs.map((dog) => dog.pet.name).join(", ")}</p>
      </div> : null}

      {currentStep === 1 && (
        <BookingDogStep
          draftPet={draftPet}
          onDraftChange={(updates) => setDraftPet((current) => ({ ...current, ...updates }))}
          excludedPetIds={bookedDogs.map((dog) => dog.pet.id)}
          onBack={bookedDogs.length ? () => {
            const dog = bookedDogs[bookedDogs.length - 1];
            setBookedDogs(bookedDogs.slice(0, -1));
            setSelectedPet(dog.pet); setDraftPet(dog.pet); setSelectedService(dog.service);
            setSelectedAddOnIds(dog.addOnIds); setAddOnOptions(dog.addOnOptions); setSpaGoals(dog.spaGoals);
            setServiceConfirmed(true); setCareOptionsConfirmed(false);
          } : undefined}
          onContinue={handleDogContinue}
        />
      )}

      {currentStep === 2 && selectedPet && !serviceConfirmed && (
        <BookingExperienceStep
          key={selectedPet.id}
          pet={selectedPet}
          selectedServiceId={selectedService?.id ?? null}
          selectedIds={[...(selectedService ? [selectedService.id] : []), ...selectedAddOnIds]}
          selectedOptions={addOnOptions}
          selectionError={selectionError}
          selectedOptionName={
            selectedService && isCreativeServiceSelection(selectedService)
              ? addOnOptions[selectedService.id] ?? null
              : null
          }
          showPrices={showPrices}
          onSelect={handleServiceSelect}
          onContinue={handleExperienceContinue}
          onBack={() => {
            setSelectedPet(null);
            setDraftPet(selectedPet);
            setBookedDogs((current) => current.filter((dog) => dog.pet.id !== selectedPet.id));
            resetFromDog();
          }}
        />
      )}

      {currentStep === 2 &&
        selectedPet &&
        selectedService &&
        serviceConfirmed &&
        !careOptionsConfirmed && (
          <BookingCareOptionsStep
            key={selectedPet.id}
            pet={selectedPet}
            primaryService={selectedService}
            selectedIds={selectedAddOnIds}
            addOnOptions={addOnOptions}
            showPrices={showPrices}
            spaGoals={spaGoals}
            onSpaGoalsChange={setSpaGoals}
            onToggle={toggleAddOn}
            onOptionChange={handleAddOnOptionChange}
            onContinue={handleCareContinue}
            onAddDog={handleAddDog}
            saving={savingDogs}
            saveError={dogsError}
            onBack={() => {
              setServiceConfirmed(false);
            }}
          />
        )}

      {currentStep === 3 && selectedPet && selectedService && (
        <BookingLocationTimeStep
          dogs={bookedDogs}
          pet={selectedPet}
          serviceId={selectedService.id}
          addOnIds={selectedAddOnIds}
          showPrices={showPrices}
          initialAddress={address}
          initialQuote={travelQuote}
          initialDate={appointmentDate}
          initialSlotStartMinutes={slotStartMinutes}
          onBack={() => {
            setCareOptionsConfirmed(false);
            setAppointmentDate(null);
            setAppointmentTime(null);
            setTimePreference(null);
            setSlotStartMinutes(null);
          }}
          onComplete={(addr, quote, date, time, preference, slotStart) => {
            setAddress(addr);
            setTravelQuote(quote);
            setAppointmentDate(date);
            setAppointmentTime(time);
            setTimePreference(preference);
            setSlotStartMinutes(slotStart);
          }}
        />
      )}

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
              householdAllergyStatus: null,
              householdAllergyDetails: "",
            }
          }
          onBack={() => {
            setAppointmentDate(null);
            setAppointmentTime(null);
            setTimePreference(null);
            setSlotStartMinutes(null);
          }}
          onOpenPolicy={openPolicies}
          onComplete={setOwner}
        />
      )}

      {currentStep === 5 ? (
        <BookingPaymentStep
          initialPaymentMethodId={paymentMethod?.id ?? null}
          onBack={() => setOwner(null)}
          onComplete={setPaymentMethod}
        />
      ) : null}

      {currentStep === 6 &&
        selectedPet &&
        selectedService &&
        address &&
        travelQuote &&
        appointmentDate &&
        slotStartMinutes != null &&
        owner &&
        paymentMethod && (bookedDogs.length > 1 ? (
          <BookingGroupConfirmStep
            dogs={bookedDogs}
            address={address}
            travelQuote={travelQuote}
            appointmentDate={appointmentDate}
            appointmentTime={appointmentTime ?? ARRIVAL_WINDOW_PENDING_LABEL}
            slotStartMinutes={slotStartMinutes}
            owner={owner}
            paymentMethod={paymentMethod}
            initialReferralCode={initialReferralCode}
            idempotencyKey={idempotency?.key ?? ""}
            onBack={() => setPaymentMethod(null)}
            onDogsSaved={(dogs) => {
              const index = bookedDogs.findIndex((dog) => dog.pet.id === selectedPet.id);
              if (index >= 0) { setSelectedPet(dogs[index].pet); setDraftPet(dogs[index].pet); }
              setBookedDogs(dogs);
            }}
            onReserved={(appointment, dogs) => {
              const first = dogs[0];
              trackGoogleAdsBookingConversion(appointment.id);
              writeBookingSuccessSnapshot({ appointment, pet: first.pet, service: first.service,
                appointmentDate, appointmentTime: appointment.appointmentTime, address, dogs });
              setSelectedPet(first.pet);
              setSelectedService(first.service);
              setCreatedAppointment(appointment);
              setReserved(true);
            }}
          />
        ) : (
          <BookingConfirmStep
            key={travelQuote.distanceMiles}
            pet={selectedPet}
            service={selectedService}
            addOnIds={selectedAddOnIds}
            addOnOptions={addOnOptions}
            spaGoals={spaGoals}
            address={address}
            travelQuote={travelQuote}
            appointmentDate={appointmentDate}
            appointmentTime={appointmentTime ?? ARRIVAL_WINDOW_PENDING_LABEL}
            slotStartMinutes={slotStartMinutes}
            owner={owner}
            paymentMethod={paymentMethod}
            initialReferralCode={initialReferralCode}
            idempotencyKey={idempotency?.key ?? ""}
            onBack={() => setPaymentMethod(null)}
            onReserved={(appointment, pet) => {
              trackGoogleAdsBookingConversion(appointment.id);
              writeBookingSuccessSnapshot({
                appointment,
                pet,
                service: selectedService,
                appointmentDate,
                appointmentTime:
                  appointment.appointmentTime ||
                  appointmentTime ||
                  ARRIVAL_WINDOW_PENDING_LABEL,
                address,
              });
              setSelectedPet(pet);
              setCreatedAppointment(appointment);
              setReserved(true);
            }}
          />
        ))}

      {currentStep <= 6 && (
        <div className="border-t border-gray-line/70 pt-6 text-center">
          <p className="font-body text-[13px] text-taupe">
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
          <p className="font-body mt-4 text-[13px] text-taupe">
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
        showPrices={showPrices}
      />
    </div>
  );
}
