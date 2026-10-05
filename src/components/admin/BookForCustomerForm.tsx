"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { StaffBookingDatePicker } from "@/components/admin/StaffBookingDatePicker";
import { formatMinutesLabel } from "@/lib/appointments/closures";
import { formatPrice } from "@/lib/business";
import {
  allBookableServices,
  estimateServiceDurationMinutes,
  getServicePriceEstimate,
  isServiceAvailableForPet,
} from "@/lib/services";
import {
  fallbackStaffScheduleDays,
  selectableStaffDays,
  slotsForStaffDate,
  staffScheduleHint,
} from "@/lib/staff/book-for-customer-schedule";
import {
  bookingAddressKey,
  bookingProfileStatusCopy,
  formatBookingAddress,
  resolveBookingProfileQuery,
  type StaffBookingProfile,
  type StaffBookingProfileAddress,
  type StaffBookingProfilePet,
} from "@/lib/staff/customer-booking-profile";
import type { TravelQuote } from "@/lib/travel";

type Prefill = {
  customerId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

type FieldSource = "empty" | "saved" | "user";

type QuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; quote: TravelQuote & { lat: number; lon: number } }
  | { status: "error"; message: string };

type AvailabilityDay = {
  date: string;
  available: boolean;
  slots: number[];
};

type SuccessState = {
  mode: "invite" | "booking";
  confirmUrl: string;
  emailed: boolean;
  texted: boolean;
  createdAccount: boolean;
  email: string;
  firstName: string;
  serviceName: string | null;
  appointmentDate: string | null;
  appointmentTime: string | null;
};

type PetDraft = {
  key: string;
  id: string | null;
  name: string;
  breed: string;
  weightLbs: string;
};

function createPetDraft(): PetDraft {
  const key =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `pet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { key, id: null, name: "", breed: "", weightLbs: "" };
}

function petDraftFromSaved(pet: StaffBookingProfilePet): PetDraft {
  return {
    key: pet.id,
    id: pet.id,
    name: pet.name,
    breed: pet.breed,
    weightLbs: pet.weightLbs > 0 ? String(pet.weightLbs) : "",
  };
}

function petsFromProfile(profile: StaffBookingProfile | null | undefined) {
  if (!profile?.pets.length) return [createPetDraft()];
  return profile.pets.map(petDraftFromSaved);
}

const fieldClass =
  "mt-1 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm text-text";
const labelClass = "block text-sm font-medium text-text";

export function BookForCustomerForm({
  prefill,
  preview = false,
  initialProfile = null,
}: {
  prefill?: Prefill;
  preview?: boolean;
  initialProfile?: StaffBookingProfile | null;
}) {
  const initialAddress = initialProfile?.addresses[0] ?? null;
  const [firstName, setFirstName] = useState(prefill?.firstName ?? "");
  const [lastName, setLastName] = useState(prefill?.lastName ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [phone, setPhone] = useState(prefill?.phone ?? "");
  const [notifyEmail, setNotifyEmail] = useState(Boolean(prefill?.email));
  const [notifySms, setNotifySms] = useState(Boolean(prefill?.phone) || !prefill?.email);
  const [pets, setPets] = useState<PetDraft[]>(() => petsFromProfile(initialProfile));
  const [petsSource, setPetsSource] = useState<FieldSource>(
    initialProfile?.pets.length ? "saved" : "empty",
  );
  const [serviceId, setServiceId] = useState("");
  const [street, setStreet] = useState(initialAddress?.street ?? "");
  const [city, setCity] = useState(initialAddress?.city ?? "");
  const [state, setState] = useState(initialAddress?.state ?? "");
  const [zip, setZip] = useState(initialAddress?.zip ?? "");
  const [addressSource, setAddressSource] = useState<FieldSource>(
    initialAddress ? "saved" : "empty",
  );
  const [foundProfile, setFoundProfile] = useState<StaffBookingProfile | null>(
    initialProfile,
  );
  const [profileNote, setProfileNote] = useState<string | null>(() =>
    initialProfile ? bookingProfileStatusCopy(initialProfile) : null,
  );
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [selectedAddressKey, setSelectedAddressKey] = useState(
    initialAddress ? bookingAddressKey(initialAddress) : "",
  );
  const [savedQuoteRequest, setSavedQuoteRequest] =
    useState<StaffBookingProfileAddress | null>(initialAddress);
  const [quoteState, setQuoteState] = useState<QuoteState>({ status: "idle" });
  const [days, setDays] = useState<AvailabilityDay[]>(() =>
    fallbackStaffScheduleDays(),
  );
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityLoaded, setAvailabilityLoaded] = useState(preview);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [slotStartMinutes, setSlotStartMinutes] = useState("");
  const [verbalConsent, setVerbalConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [copied, setCopied] = useState(false);
  const petsSourceRef = useRef(petsSource);
  const addressSourceRef = useRef(addressSource);
  const foundProfileRef = useRef(foundProfile);
  const contactRef = useRef({ firstName, lastName, email, phone });
  const quotedAddressKeyRef = useRef("");
  petsSourceRef.current = petsSource;
  addressSourceRef.current = addressSource;
  foundProfileRef.current = foundProfile;
  contactRef.current = { firstName, lastName, email, phone };

  const petWeights = useMemo(
    () =>
      pets
        .map((pet) => Number(pet.weightLbs))
        .filter((weight) => Number.isFinite(weight) && weight > 0),
    [pets],
  );
  const primaryWeightLbs = petWeights[0] ?? Number.NaN;
  const services = useMemo(
    () =>
      allBookableServices().filter(
        (service) =>
          service.bookableAsPrimary &&
          (petWeights.length === 0 ||
            petWeights.every((weight) =>
              isServiceAvailableForPet(service.id, weight),
            )),
      ),
    [petWeights],
  );

  const selectedService = services.find((service) => service.id === serviceId);
  const openDays = useMemo(() => selectableStaffDays(days), [days]);
  const openSlots = useMemo(
    () => slotsForStaffDate(days, appointmentDate),
    [days, appointmentDate],
  );
  const quoteReady = quoteState.status === "ready";
  const quoteLat = quoteReady ? quoteState.quote.lat : null;
  const quoteLon = quoteReady ? quoteState.quote.lon : null;
  const scheduleHint = staffScheduleHint({
    quoteReady: preview || quoteReady,
    hasService: preview || Boolean(serviceId),
    loading: availabilityLoading,
    error: availabilityError,
    daysLoaded: preview || availabilityLoaded,
    selectedDate: appointmentDate,
    availableDayCount: openDays.length,
    slotCount: openSlots.length,
  });

  const estimatedServiceTotal =
    selectedService && petWeights.length === pets.length
      ? petWeights.reduce((sum, weight) => {
          const estimate = getServicePriceEstimate(selectedService, weight);
          return sum + (estimate?.from ?? 0);
        }, 0)
      : null;
  const estimatedTotal =
    estimatedServiceTotal != null && quoteState.status === "ready"
      ? Math.round((estimatedServiceTotal + quoteState.quote.fee) * 100) / 100
      : null;
  const totalDurationMinutes =
    selectedService && petWeights.length === pets.length
      ? petWeights.reduce(
          (sum, weight) =>
            sum + estimateServiceDurationMinutes(selectedService.id, weight),
          0,
        )
      : null;

  function markPetsEdited() {
    petsSourceRef.current = "user";
    setPetsSource("user");
    setProfileNote(null);
  }

  function markAddressEdited() {
    addressSourceRef.current = "user";
    setAddressSource("user");
    setSelectedAddressKey("");
    setProfileNote(null);
  }

  function updatePet(key: string, field: keyof Omit<PetDraft, "key" | "id">, value: string) {
    markPetsEdited();
    setPets((current) =>
      current.map((pet) =>
        pet.key === key ? { ...pet, [field]: value } : pet,
      ),
    );
  }

  function addPetRow() {
    markPetsEdited();
    setPets((current) => [...current, createPetDraft()]);
  }

  function removePetRow(key: string) {
    markPetsEdited();
    setPets((current) =>
      current.length <= 1 ? current : current.filter((pet) => pet.key !== key),
    );
  }

  function applySavedAddress(address: StaffBookingProfileAddress | null) {
    setStreet(address?.street ?? "");
    setCity(address?.city ?? "");
    setState(address?.state ?? "");
    setZip(address?.zip ?? "");
    setSelectedAddressKey(address ? bookingAddressKey(address) : "");
    const nextSource = address ? "saved" : "empty";
    addressSourceRef.current = nextSource;
    setAddressSource(nextSource);
    setQuoteState({ status: "idle" });
    quotedAddressKeyRef.current = "";
    setSavedQuoteRequest(address ? { ...address } : null);
  }

  function fillFromProfile(profile: StaffBookingProfile, mode: "auto" | "force") {
    const sameCustomer =
      foundProfileRef.current?.customerId === profile.customerId;
    foundProfileRef.current = profile;
    setFoundProfile(profile);
    if (mode === "auto" && sameCustomer) return;

    const canReplacePets = petsSourceRef.current !== "user";
    const canReplaceAddress = addressSourceRef.current !== "user";
    const fillPets =
      (mode === "force" || canReplacePets) &&
      (profile.pets.length > 0 || canReplacePets);
    const fillAddress =
      (mode === "force" || canReplaceAddress) &&
      (profile.addresses.length > 0 || canReplaceAddress);

    if (fillPets) {
      setPets(petsFromProfile(profile));
      const nextSource = profile.pets.length ? "saved" : "empty";
      petsSourceRef.current = nextSource;
      setPetsSource(nextSource);
    }
    if (fillAddress) {
      applySavedAddress(profile.addresses[0] ?? null);
    }
    if (!contactRef.current.firstName.trim() && profile.firstName) {
      setFirstName(profile.firstName);
    }
    if (!contactRef.current.lastName.trim() && profile.lastName) {
      setLastName(profile.lastName);
    }
    if (!contactRef.current.email.trim() && profile.email) {
      setEmail(profile.email);
      setNotifyEmail(true);
    }
    if (!contactRef.current.phone.trim() && profile.phone) {
      setPhone(profile.phone);
      setNotifySms(true);
    }
    setProfileNote(
      bookingProfileStatusCopy({
        pets: fillPets ? profile.pets : [],
        addresses: fillAddress ? profile.addresses : [],
      }),
    );
  }

  function clearLoadedProfile() {
    if (!foundProfileRef.current && petsSourceRef.current !== "saved" && addressSourceRef.current !== "saved") {
      return;
    }
    foundProfileRef.current = null;
    setFoundProfile(null);
    setProfileNote(null);
    if (petsSourceRef.current === "saved") {
      setPets([createPetDraft()]);
      petsSourceRef.current = "empty";
      setPetsSource("empty");
    }
    if (addressSourceRef.current === "saved") {
      applySavedAddress(null);
    }
  }

  function chooseSavedAddress(key: string) {
    if (!key) {
      markAddressEdited();
      return;
    }
    const address = foundProfileRef.current?.addresses.find(
      (entry) => bookingAddressKey(entry) === key,
    );
    if (!address) return;
    applySavedAddress(address);
    setProfileNote(
      bookingProfileStatusCopy({
        pets: petsSourceRef.current === "saved" ? (foundProfileRef.current?.pets ?? []) : [],
        addresses: [address],
      }),
    );
  }

  async function quoteAddress(
    address: { street: string; city: string; state: string; zip: string },
    signal?: AbortSignal,
  ) {
    setError(null);
    setQuoteState({ status: "loading" });
    setDays(fallbackStaffScheduleDays());
    setAppointmentDate("");
    setSlotStartMinutes("");
    try {
      const response = await fetch("/api/travel-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(address),
        signal,
      });
      const body = (await response.json()) as {
        error?: string;
        quote?: TravelQuote & { lat: number; lon: number };
      };
      if (!response.ok || !body.quote) {
        setQuoteState({
          status: "error",
          message: body.error ?? "Could not check that address.",
        });
        return false;
      }
      if (!body.quote.withinServiceArea) {
        setQuoteState({ status: "error", message: body.quote.summary });
        return false;
      }
      setQuoteState({ status: "ready", quote: body.quote });
      return true;
    } catch (quoteError) {
      if (signal?.aborted) return false;
      console.error("Book for customer travel quote failed:", quoteError);
      setQuoteState({
        status: "error",
        message: "Could not check that address.",
      });
      return false;
    }
  }

  function handleQuote() {
    return quoteAddress({ street, city, state, zip });
  }

  useEffect(() => {
    if (!appointmentDate || !slotStartMinutes) return;
    if (openSlots.some((slot) => String(slot) === slotStartMinutes)) return;
    setSlotStartMinutes("");
  }, [appointmentDate, openSlots, slotStartMinutes]);

  useEffect(() => {
    if (preview || initialProfile) return;
    const query = resolveBookingProfileQuery({
      email,
      phone,
      prefillCustomerId: prefill?.customerId,
      prefillEmail: prefill?.email,
      prefillPhone: prefill?.phone,
    });
    if (!query) {
      setProfileLoading(false);
      clearLoadedProfile();
      return;
    }

    const controller = new AbortController();
    const delay = "customerId" in query ? 0 : 400;
    setProfileLoading(true);
    setProfileError(null);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if ("customerId" in query) params.set("customerId", query.customerId);
      else if ("email" in query) params.set("email", query.email);
      else params.set("phone", query.phone);
      void fetch(`/api/admin/customer-booking-profile?${params}`, {
        credentials: "include",
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = (await response.json()) as {
            error?: string;
            profile?: StaffBookingProfile | null;
          };
          if (!response.ok) {
            throw new Error(
              body.error ??
                "Could not load saved pets and address for this customer.",
            );
          }
          return body.profile ?? null;
        })
        .then((profile) => {
          if (controller.signal.aborted) return;
          if (!profile) clearLoadedProfile();
          else fillFromProfile(profile, "auto");
        })
        .catch((loadError: unknown) => {
          if (controller.signal.aborted) return;
          console.error("Book for customer profile failed:", loadError);
          setProfileError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load saved pets and address for this customer.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setProfileLoading(false);
        });
    }, delay);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
    // fillFromProfile and clearLoadedProfile read the latest draft through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    email,
    phone,
    prefill?.customerId,
    prefill?.email,
    prefill?.phone,
    preview,
    initialProfile,
  ]);

  useEffect(() => {
    if (preview || !savedQuoteRequest) return;
    const key = bookingAddressKey(savedQuoteRequest);
    if (quotedAddressKeyRef.current === key) return;
    const controller = new AbortController();
    void quoteAddress(savedQuoteRequest, controller.signal).then((ok) => {
      if (ok && !controller.signal.aborted) {
        quotedAddressKeyRef.current = key;
      }
    });
    return () => controller.abort();
    // quoteAddress is recreated each render and closes over the latest setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, savedQuoteRequest]);

  useEffect(() => {
    if (preview) return;
    if (
      quoteLat == null ||
      quoteLon == null ||
      !serviceId ||
      petWeights.length !== pets.length ||
      totalDurationMinutes == null ||
      totalDurationMinutes <= 0
    ) {
      setAvailabilityLoading(false);
      setAvailabilityLoaded(false);
      setAvailabilityError(null);
      setDays(fallbackStaffScheduleDays());
      return;
    }

    const controller = new AbortController();
    setAvailabilityLoading(true);
    setAvailabilityError(null);

    async function loadDays() {
      try {
        const params = new URLSearchParams({
          lat: String(quoteLat),
          lon: String(quoteLon),
          zip,
          serviceId,
          weightLbs: String(primaryWeightLbs),
          durationMinutes: String(totalDurationMinutes),
        });
        const response = await fetch(`/api/booking/availability?${params}`, {
          credentials: "include",
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          error?: string;
          days?: AvailabilityDay[];
        };
        if (!response.ok || !body.days) {
          setDays(fallbackStaffScheduleDays());
          setAvailabilityLoaded(true);
          return;
        }
        setDays(body.days);
        setAvailabilityLoaded(true);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Book for customer availability failed:", error);
        setDays(fallbackStaffScheduleDays());
        setAvailabilityLoaded(true);
      } finally {
        if (!controller.signal.aborted) {
          setAvailabilityLoading(false);
        }
      }
    }

    void loadDays();
    return () => controller.abort();
  }, [
    preview,
    quoteLat,
    quoteLon,
    serviceId,
    petWeights,
    pets.length,
    primaryWeightLbs,
    totalDurationMinutes,
    zip,
  ]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setCopied(false);

    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedEmail && !trimmedPhone) {
      setError("Enter a customer email or mobile phone number.");
      return;
    }

    const filledPets = pets
      .map((pet) => ({
        id: pet.id,
        name: pet.name.trim(),
        breed: pet.breed.trim(),
        weightLbs: Number(pet.weightLbs),
      }))
      .filter(
        (pet) =>
          pet.name ||
          pet.breed ||
          (Number.isFinite(pet.weightLbs) && pet.weightLbs > 0),
      );

    if (preview) {
      const inviteOnly = filledPets.length === 0 || !serviceId || !appointmentDate || !slotStartMinutes;
      setSuccess({
        mode: inviteOnly ? "invite" : "booking",
        confirmUrl: inviteOnly
          ? "https://k9atelier.com/book"
          : "https://k9atelier.com/confirm-account?token=preview",
        emailed: notifyEmail && Boolean(trimmedEmail),
        texted: notifySms && Boolean(trimmedPhone),
        createdAccount: Boolean(trimmedEmail),
        email: trimmedEmail,
        firstName,
        serviceName: selectedService?.name ?? null,
        appointmentDate: appointmentDate || null,
        appointmentTime: slotStartMinutes
          ? formatMinutesLabel(Number(slotStartMinutes))
          : null,
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/customer-bookings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email: trimmedEmail,
          phone: trimmedPhone,
          notifyEmail,
          notifySms,
          verbalConsent,
          pets: filledPets.map((pet) => ({
            ...(pet.id ? { id: pet.id } : {}),
            name: pet.name,
            breed: pet.breed,
            weightLbs: pet.weightLbs,
          })),
          serviceId: serviceId || undefined,
          appointmentDate: appointmentDate || undefined,
          slotStartMinutes: slotStartMinutes
            ? Number(slotStartMinutes)
            : undefined,
          address:
            street.trim() || city.trim() || state.trim() || zip.trim()
              ? { street, city, state, zip }
              : undefined,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        mode?: "invite" | "booking";
        confirmUrl?: string;
        emailed?: boolean;
        texted?: boolean;
        customer?: {
          email: string;
          firstName: string;
          createdAccount: boolean;
        };
        appointment?: {
          serviceName: string;
          appointmentDate: string;
          appointmentTime: string;
        } | null;
      };
      if (!response.ok || !body.confirmUrl || !body.customer) {
        throw new Error(body.error ?? "Could not send this booking link.");
      }
      setSuccess({
        mode: body.mode === "booking" ? "booking" : "invite",
        confirmUrl: body.confirmUrl,
        emailed: body.emailed === true,
        texted: body.texted === true,
        createdAccount: body.customer.createdAccount,
        email: body.customer.email,
        firstName: body.customer.firstName,
        serviceName: body.appointment?.serviceName ?? null,
        appointmentDate: body.appointment?.appointmentDate ?? null,
        appointmentTime: body.appointment?.appointmentTime ?? null,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not send this booking link.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    const displayName = success.firstName.trim() || "the customer";
    return (
      <div className="rounded-2xl border border-lavender/30 bg-cream p-6">
        <h3 className="font-medium text-gold-dark">
          {success.mode === "invite" ? "Booking link ready" : "Confirmation link ready"}
        </h3>
        <p className="mt-2 text-sm text-text">
          {success.mode === "invite"
            ? success.createdAccount
              ? `A customer account was started for ${displayName}. They can finish the required booking details from the link.`
              : `${displayName} can finish the required booking details from the link.`
            : success.createdAccount
              ? `A customer account was created for ${displayName}. The visit stays pending until they secure it from the review and confirm link with a card on file.`
              : `This booking was added to ${displayName}'s existing account. It stays pending until they secure it from the review and confirm link with a card on file.`}
        </p>
        {success.mode === "booking" &&
        success.serviceName &&
        success.appointmentDate &&
        success.appointmentTime ? (
          <p className="mt-2 text-sm text-text-muted">
            {success.serviceName} on {success.appointmentDate} ·{" "}
            {success.appointmentTime}
          </p>
        ) : (
          <p className="mt-2 text-sm text-text-muted">
            The customer completes dog details, service, address, and schedule
            online.
          </p>
        )}
        <p className="mt-3 text-sm text-text-muted">
          {success.emailed
            ? `Email sent${success.email ? ` to ${success.email}` : ""}. `
            : "Email was not sent. "}
          {success.texted
            ? "A text was sent to their phone."
            : "A text was not sent."}
        </p>
        <label className={`${labelClass} mt-5`} htmlFor="confirm-url">
          {success.mode === "invite"
            ? "Customer booking link"
            : "Customer confirmation link"}
        </label>
        <input
          id="confirm-url"
          readOnly
          value={success.confirmUrl}
          className={fieldClass}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white hover:bg-gold-dark"
            onClick={() => {
              void navigator.clipboard.writeText(success.confirmUrl);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-lavender/40 px-4 py-2 text-sm text-text-muted hover:text-text"
            onClick={() => setSuccess(null)}
          >
            Book another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="space-y-8 rounded-2xl border border-lavender/30 bg-cream p-6"
    >
      <p className="text-sm text-text-muted">
        Only an email or mobile phone is required. Leave other fields blank and
        the customer can finish them from the booking link.
      </p>
      {profileLoading ? (
        <p className="text-sm text-text-muted">
          Loading saved pets and address…
        </p>
      ) : null}
      {profileError ? (
        <p className="text-sm text-red-800" role="alert">
          {profileError}
        </p>
      ) : null}
      {profileNote ? (
        <p className="text-sm text-text-muted">{profileNote}</p>
      ) : null}
      {foundProfile &&
      (foundProfile.pets.length > 0 || foundProfile.addresses.length > 0) &&
      (petsSource === "user" || addressSource === "user") ? (
        <button
          type="button"
          onClick={() => fillFromProfile(foundProfile, "force")}
          className="rounded-xl border border-lavender/40 px-4 py-2 text-sm text-text hover:border-gold/40"
        >
          Load saved pets and address
        </button>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="customer-first-name">
            First name
          </label>
          <input
            id="customer-first-name"
            className={fieldClass}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="customer-last-name">
            Last name
          </label>
          <input
            id="customer-last-name"
            className={fieldClass}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="customer-email">
            Email
          </label>
          <input
            id="customer-email"
            type="email"
            className={fieldClass}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (event.target.value.trim()) setNotifyEmail(true);
            }}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="customer-phone">
            Mobile phone
          </label>
          <input
            id="customer-phone"
            type="tel"
            className={fieldClass}
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              if (event.target.value.trim()) setNotifySms(true);
            }}
          />
          <p className="mt-1 text-xs text-text-muted">
            Provide email or phone (at least one).
          </p>
        </div>
      </section>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text">
          Send booking link
        </legend>
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={notifyEmail}
            onChange={(event) => setNotifyEmail(event.target.checked)}
          />
          Email
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={notifySms}
            onChange={(event) => setNotifySms(event.target.checked)}
          />
          Text message
        </label>
      </fieldset>

      <section className="space-y-4">
        {pets.map((pet, index) => {
          const nameId = `pet-name-${pet.key}`;
          const breedId = `pet-breed-${pet.key}`;
          const weightId = `pet-weight-${pet.key}`;
          return (
            <div key={pet.key} className="space-y-2">
              {pets.length > 1 ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-text-muted">
                    Dog {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => removePetRow(pet.key)}
                    className="text-sm text-text-muted hover:text-text"
                  >
                    Remove
                  </button>
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelClass} htmlFor={nameId}>
                    Dog name
                  </label>
                  <input
                    id={nameId}
                    className={fieldClass}
                    value={pet.name}
                    onChange={(event) =>
                      updatePet(pet.key, "name", event.target.value)
                    }
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor={breedId}>
                    Breed
                  </label>
                  <input
                    id={breedId}
                    className={fieldClass}
                    value={pet.breed}
                    onChange={(event) =>
                      updatePet(pet.key, "breed", event.target.value)
                    }
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor={weightId}>
                    Weight (lbs)
                  </label>
                  <input
                    id={weightId}
                    type="number"
                    min="0.1"
                    step="0.1"
                    className={fieldClass}
                    value={pet.weightLbs}
                    onChange={(event) =>
                      updatePet(pet.key, "weightLbs", event.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          );
        })}
        <div>
          <button
            type="button"
            onClick={addPetRow}
            className="rounded-xl border border-lavender/40 px-4 py-2 text-sm text-text hover:border-gold/40"
          >
            Add
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {foundProfile && foundProfile.addresses.length > 1 ? (
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="saved-address">
              Saved addresses
            </label>
            <select
              id="saved-address"
              className={fieldClass}
              value={
                foundProfile.addresses.some(
                  (address) => bookingAddressKey(address) === selectedAddressKey,
                )
                  ? selectedAddressKey
                  : ""
              }
              onChange={(event) => chooseSavedAddress(event.target.value)}
            >
              <option value="">Custom address</option>
              {foundProfile.addresses.map((address) => {
                const key = bookingAddressKey(address);
                return (
                  <option key={key} value={key}>
                    {formatBookingAddress(address)}
                  </option>
                );
              })}
            </select>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="address-street">
            Street
          </label>
          <input
            id="address-street"
            className={fieldClass}
            value={street}
            onChange={(event) => {
              markAddressEdited();
              setStreet(event.target.value);
            }}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="address-city">
            City
          </label>
          <input
            id="address-city"
            className={fieldClass}
            value={city}
            onChange={(event) => {
              markAddressEdited();
              setCity(event.target.value);
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="address-state">
              State
            </label>
            <input
              id="address-state"
              className={fieldClass}
              value={state}
              onChange={(event) => {
                markAddressEdited();
                setState(event.target.value);
              }}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="address-zip">
              ZIP
            </label>
            <input
              id="address-zip"
              className={fieldClass}
              value={zip}
              onChange={(event) => {
                markAddressEdited();
                setZip(event.target.value);
              }}
            />
          </div>
        </div>
      </section>

      <div>
        <button
          type="button"
          onClick={() => void handleQuote()}
          className="rounded-xl border border-lavender/40 px-4 py-2 text-sm text-text hover:border-gold/40"
        >
          {quoteState.status === "loading" ? "Checking address…" : "Check service area"}
        </button>
        {quoteState.status === "ready" ? (
          <p className="mt-2 text-sm text-text-muted">{quoteState.quote.summary}</p>
        ) : null}
        {quoteState.status === "error" ? (
          <p className="mt-2 text-sm text-red-800" role="alert">
            {quoteState.message}
          </p>
        ) : null}
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="service-id">
            Service
          </label>
          <select
            id="service-id"
            className={fieldClass}
            value={serviceId}
            onChange={(event) => {
              setServiceId(event.target.value);
              setAppointmentDate("");
              setSlotStartMinutes("");
            }}
          >
            <option value="">Select a service</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="appointment-date">
            Date
          </label>
          <StaffBookingDatePicker
            id="appointment-date"
            value={appointmentDate}
            openDates={openDays.map((day) => day.date)}
            preview={preview}
            onChange={(date) => {
              setAppointmentDate(date);
              setSlotStartMinutes("");
            }}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="appointment-slot">
            Start time
          </label>
          <select
            id="appointment-slot"
            className={fieldClass}
            value={slotStartMinutes}
            onChange={(event) => setSlotStartMinutes(event.target.value)}
            disabled={availabilityLoading}
          >
            <option value="">
              {availabilityLoading ? "Loading times…" : "Select a time"}
            </option>
            {openSlots.map((slot) => (
              <option key={slot} value={slot}>
                {formatMinutesLabel(slot)}
              </option>
            ))}
          </select>
          {availabilityError ? (
            <p className="mt-2 text-sm text-red-800" role="alert">
              {availabilityError}
            </p>
          ) : null}
          {scheduleHint ? (
            <p className="mt-2 text-sm text-text-muted">{scheduleHint}</p>
          ) : null}
        </div>
        {estimatedTotal != null ? (
          <div className="text-sm text-text-muted">
            <p>Estimated total: from {formatPrice(estimatedTotal)}</p>
          </div>
        ) : null}
      </section>

      <label className="flex items-start gap-2 text-sm text-text">
        <input
          type="checkbox"
          className="mt-1"
          checked={verbalConsent}
          onChange={(event) => setVerbalConsent(event.target.checked)}
        />
        The customer agreed by phone or in person to the cancellation, payment,
        photo, and text-message policies, and to receive this booking link.
      </label>

      {error ? (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-gold px-6 py-2.5 text-sm font-medium text-white hover:bg-gold-dark disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Send booking link"}
        </button>
        <Link href="/admin/pets" className="text-sm text-gold-dark hover:underline">
          Back to customers
        </Link>
      </div>
    </form>
  );
}
