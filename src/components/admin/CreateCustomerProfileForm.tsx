"use client";

import React, { useState } from "react";
import { PetProfileFieldsForm } from "@/components/account/PetProfileFieldsForm";
import { StaffCustomerPayments } from "@/components/admin/StaffCustomerPayments";
import { normalizePetProfile, type PetProfile } from "@/lib/pets";
import { mapPetProfileToWriteInput } from "@/lib/pets/map";
import type { StaffCustomerRecord } from "@/lib/profiles/staff-service";
import {
  EMERGENCY_RELATIONSHIP_OPTIONS,
  PREFERRED_CONTACT_OPTIONS,
} from "@/lib/profiles/types";
import { MIN_CUSTOMER_PASSWORD_LENGTH } from "@/lib/profiles/validation";
import { isOwnerEmail } from "@/lib/staff/owner";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import type { PaymentMethodRecord } from "@/lib/payments/types";

function inputClassName() {
  return "mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm text-text placeholder:text-text-muted/50";
}

type Draft = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  preferredContact: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
};

type AddressDraft = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

const EMPTY_ADDRESS: AddressDraft = {
  street: "",
  city: "",
  state: "",
  zip: "",
};

function addressHasContent(address: AddressDraft) {
  return Boolean(
    address.street.trim() ||
      address.city.trim() ||
      address.state.trim() ||
      address.zip.trim(),
  );
}

function validateAddress(address: AddressDraft) {
  if (!addressHasContent(address)) return null;
  if (!address.street.trim()) return "Street is required.";
  if (!address.city.trim()) return "City is required.";
  if (!address.state.trim()) return "State is required.";
  if (!address.zip.trim()) return "ZIP code is required.";
  return null;
}

const EMPTY_DRAFT: Draft = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  preferredContact: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelationship: "",
};

function emptyPet(): PetProfile {
  return normalizePetProfile({
    id: "new-pet",
    name: "",
    breed: "",
    weightLbs: 0,
    vaccineRecordUploaded: false,
  });
}

function petHasContent(pet: PetProfile, notes: string) {
  return Boolean(
    pet.name.trim() ||
      pet.breed.trim() ||
      pet.weightLbs > 0 ||
      pet.dateOfBirth ||
      pet.approximateDateOfBirth ||
      pet.approximateAgeYears ||
      pet.sex ||
      pet.temperament?.trim() ||
      pet.medicalNotes?.trim() ||
      pet.groomingPreferences?.trim() ||
      pet.rabiesStatus ||
      pet.vaccineExpiration ||
      notes.trim(),
  );
}

function petRequestBody(pet: PetProfile, notes: string) {
  if (!petHasContent(pet, notes)) return null;
  const mapped = mapPetProfileToWriteInput(pet);
  return {
    name: mapped.name,
    breed: mapped.breed,
    weightLbs: mapped.weightLbs > 0 ? mapped.weightLbs : null,
    dateOfBirth: mapped.dateOfBirth,
    approximateAgeYears: mapped.approximateAgeYears,
    sex: mapped.sex,
    temperamentNotes: mapped.temperamentNotes,
    healthComfortNotes: mapped.healthComfortNotes,
    groomingPreferences: mapped.groomingPreferences,
    rabiesStatus: mapped.rabiesStatus,
    rabiesExpirationDate: mapped.rabiesExpirationDate,
    adminServiceNotes: notes.trim(),
  };
}

function previewPet(
  pet: PetProfile,
  notes: string,
): StaffCustomerRecord["pets"][number] | null {
  const body = petRequestBody(pet, notes);
  if (!body) return null;
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: body.name,
    breed: body.breed,
    weightLbs: body.weightLbs ?? 0,
    dateOfBirth: body.dateOfBirth ?? null,
    approximateAgeYears: body.approximateAgeYears ?? null,
    sex: body.sex ?? null,
    temperamentNotes: body.temperamentNotes ?? null,
    healthComfortNotes: body.healthComfortNotes ?? null,
    groomingPreferences: body.groomingPreferences ?? null,
    rabiesStatus: body.rabiesStatus ?? null,
    rabiesExpirationDate: body.rabiesExpirationDate ?? null,
    createdAt: now,
    updatedAt: now,
    adminServiceNotes: body.adminServiceNotes,
    vaccinationBookingStatus: "missing",
    vaccinationHasUpload: false,
  };
}

export function CreateCustomerProfileForm({
  preview = false,
  existingEmails = [],
  onSaved,
  onCreated,
}: {
  preview?: boolean;
  existingEmails?: string[];
  onSaved: (customer: StaffCustomerRecord) => void;
  onCreated?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [address, setAddress] = useState<AddressDraft>(EMPTY_ADDRESS);
  const [addressSaved, setAddressSaved] = useState(false);
  const [pet, setPet] = useState<PetProfile>(emptyPet);
  const [adminNotes, setAdminNotes] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [record, setRecord] = useState<StaffCustomerRecord | null>(null);
  const [petSaved, setPetSaved] = useState(false);
  const [startCard, setStartCard] = useState(false);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function updateAddress<K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) {
    setAddress((current) => ({ ...current, [key]: value }));
    setAddressSaved(false);
    setSaved(false);
  }

  function validateEntry() {
    const email = draft.email.trim().toLowerCase();
    const currentEmail = record?.profile.email.trim().toLowerCase() ?? "";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Please enter a valid email address.";
    }
    const emailTaken =
      email.length > 0 &&
      email !== currentEmail &&
      existingEmails.some((item) => item.trim().toLowerCase() === email);
    if (email && (isOwnerEmail(email) || emailTaken)) {
      return isOwnerEmail(email)
        ? "That email belongs to a staff account."
        : "That email is already used by another account.";
    }
    if (draft.phone.trim() && !normalizePhoneToE164(draft.phone)) {
      return "Please enter a valid US mobile number.";
    }
    const addressProblem = validateAddress(address);
    if (addressProblem) return addressProblem;
    if (password || confirmPassword) {
      if (password.length < MIN_CUSTOMER_PASSWORD_LENGTH) {
        return `Use at least ${MIN_CUSTOMER_PASSWORD_LENGTH} characters.`;
      }
      if (password !== confirmPassword) return "Passwords do not match.";
    }
    if (pet.weightLbs > 200) return "Weight must be at most 200 lbs.";
    return null;
  }

  function previewRecord(base: StaffCustomerRecord | null, includePet: boolean) {
    const email =
      draft.email.trim().toLowerCase() ||
      base?.profile.email ||
      `file.${crypto.randomUUID().replace(/-/g, "")}@customers.k9atelier.com`;
    const phone = draft.phone.trim() ? (normalizePhoneToE164(draft.phone) ?? "") : "";
    const nextPet = includePet && !petSaved ? previewPet(pet, adminNotes) : null;
    const pets = [...(base?.pets ?? [])];
    if (nextPet && !pets.some((item) => item.id === nextPet.id)) pets.push(nextPet);
    return {
      record: {
        profile: {
          id: base?.profile.id ?? crypto.randomUUID(),
          email,
          firstName: draft.firstName.trim(),
          lastName: draft.lastName.trim(),
          phone,
          preferredContact: draft.preferredContact,
          emergencyContactName: draft.emergencyContactName.trim(),
          emergencyContactPhone: draft.emergencyContactPhone.trim(),
          emergencyContactRelationship: draft.emergencyContactRelationship,
        },
        pets,
        paymentMethods: base?.paymentMethods ?? [],
        kind: "customer" as const,
        frozen: false,
        canDelete: true,
        canFreeze: true,
      },
      addedPet: Boolean(nextPet),
    };
  }

  async function persist(options: { includePet: boolean; includePassword: boolean }) {
    const problem = validateEntry();
    if (problem) {
      setError(problem);
      setSaved(false);
      return null;
    }
    setError(null);

    const includePet = options.includePet && !petSaved && petHasContent(pet, adminNotes);
    const includePassword = options.includePassword && password.length > 0;
    const includeAddress = !addressSaved && addressHasContent(address);
    const addressBody = includeAddress
      ? {
          street: address.street.trim(),
          city: address.city.trim(),
          state: address.state.trim(),
          zip: address.zip.trim(),
        }
      : null;

    if (preview) {
      const next = previewRecord(record, includePet);
      setRecord(next.record);
      if (next.addedPet) setPetSaved(true);
      if (includeAddress) setAddressSaved(true);
      onSaved(next.record);
      return next.record;
    }

    const response = await fetch("/api/admin/customers", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: record?.profile.id ?? null,
        email: draft.email.trim(),
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        phone: draft.phone.trim(),
        preferredContact: draft.preferredContact,
        emergencyContactName: draft.emergencyContactName.trim(),
        emergencyContactPhone: draft.emergencyContactPhone.trim(),
        emergencyContactRelationship: draft.emergencyContactRelationship,
        password: includePassword ? password : "",
        address: addressBody,
        pet: includePet ? petRequestBody(pet, adminNotes) : null,
      }),
    });
    const body = (await response.json()) as {
      error?: string;
      customer?: StaffCustomerRecord;
    };
    if (!response.ok || !body.customer) {
      throw new Error(body.error ?? "Could not create this customer profile.");
    }
    const next: StaffCustomerRecord = {
      ...body.customer,
      pets: [
        ...(record?.pets ?? []),
        ...body.customer.pets.filter(
          (item) => !(record?.pets ?? []).some((existing) => existing.id === item.id),
        ),
      ],
      paymentMethods: record?.paymentMethods ?? body.customer.paymentMethods,
    };
    setRecord(next);
    if (includePet) setPetSaved(true);
    if (includeAddress) setAddressSaved(true);
    onSaved(next);
    return next;
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const next = await persist({ includePet: true, includePassword: true });
      if (!next) return;
      setDraft(EMPTY_DRAFT);
      setAddress(EMPTY_ADDRESS);
      setAddressSaved(false);
      setPet(emptyPet());
      setAdminNotes("");
      setPassword("");
      setConfirmPassword("");
      setRecord(null);
      setPetSaved(false);
      setStartCard(false);
      setSaved(true);
      onCreated?.();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not create this customer profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCard() {
    setSaving(true);
    setSaved(false);
    try {
      const next = await persist({ includePet: true, includePassword: true });
      if (!next) return;
      setStartCard(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not create this customer profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handlePayments(methods: PaymentMethodRecord[]) {
    if (!record) return;
    const next = { ...record, paymentMethods: methods };
    setRecord(next);
    onSaved(next);
  }

  return (
    <form className="space-y-8" onSubmit={(event) => void handleCreate(event)} noValidate>
      <section className="space-y-5">
        <h3 className="text-base font-medium text-gold-dark">Owner Profile</h3>
        <div>
          <label className="block text-sm font-medium text-text">
            Email
            <input
              type="email"
              autoComplete="off"
              value={draft.email}
              onChange={(event) => update("email", event.target.value)}
              className={inputClassName()}
            />
          </label>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-text">
            First Name
            <input
              autoComplete="off"
              value={draft.firstName}
              onChange={(event) => update("firstName", event.target.value)}
              className={inputClassName()}
            />
          </label>
          <label className="block text-sm font-medium text-text">
            Last Name
            <input
              autoComplete="off"
              value={draft.lastName}
              onChange={(event) => update("lastName", event.target.value)}
              className={inputClassName()}
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-text">
          Mobile Phone
          <input
            type="tel"
            autoComplete="off"
            value={draft.phone}
            onChange={(event) => update("phone", event.target.value)}
            placeholder="(555) 123-4567"
            className={inputClassName()}
          />
        </label>
        <div className="space-y-5">
          <p className="text-sm font-medium text-text">Address</p>
          <label className="block text-sm font-medium text-text">
            Street Address
            <input
              autoComplete="street-address"
              value={address.street}
              onChange={(event) => updateAddress("street", event.target.value)}
              className={inputClassName()}
            />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium text-text">
              City
              <input
                autoComplete="address-level2"
                value={address.city}
                onChange={(event) => updateAddress("city", event.target.value)}
                className={inputClassName()}
              />
            </label>
            <label className="block text-sm font-medium text-text">
              State
              <input
                autoComplete="address-level1"
                value={address.state}
                onChange={(event) => updateAddress("state", event.target.value)}
                className={inputClassName()}
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-text">
            ZIP
            <input
              autoComplete="postal-code"
              value={address.zip}
              onChange={(event) => updateAddress("zip", event.target.value)}
              className={inputClassName()}
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-text">
          Preferred Contact Method
          <select
            value={draft.preferredContact}
            onChange={(event) => update("preferredContact", event.target.value)}
            className={inputClassName()}
          >
            <option value="">Select…</option>
            {PREFERRED_CONTACT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <div className="border-t border-lavender/30 pt-6">
          <h3 className="text-base font-medium text-gold-dark">Emergency Contact</h3>
        </div>
        <label className="block text-sm font-medium text-text">
          Emergency Contact Name
          <input
            autoComplete="off"
            value={draft.emergencyContactName}
            onChange={(event) => update("emergencyContactName", event.target.value)}
            className={inputClassName()}
          />
        </label>
        <label className="block text-sm font-medium text-text">
          Emergency Contact Phone
          <input
            type="tel"
            autoComplete="off"
            value={draft.emergencyContactPhone}
            onChange={(event) => update("emergencyContactPhone", event.target.value)}
            className={inputClassName()}
          />
        </label>
        <label className="block text-sm font-medium text-text">
          Relationship
          <select
            value={draft.emergencyContactRelationship}
            onChange={(event) =>
              update("emergencyContactRelationship", event.target.value)
            }
            className={inputClassName()}
          >
            <option value="">Select…</option>
            {EMERGENCY_RELATIONSHIP_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="space-y-5 border-t border-lavender/30 pt-6">
        <h3 className="text-base font-medium text-gold-dark">Pet Profile</h3>
        <PetProfileFieldsForm
          pet={pet}
          showRequired={false}
          petPersisted={false}
          onPetChange={(updates) => {
            setPet((current) => normalizePetProfile({ ...current, ...updates }));
            setSaved(false);
          }}
        />
        <label className="block text-sm font-medium text-text">
          Service & Product Notes (Admin Only)
          <textarea
            rows={3}
            value={adminNotes}
            onChange={(event) => {
              setAdminNotes(event.target.value);
              setSaved(false);
            }}
            className={`${inputClassName()} resize-none`}
          />
        </label>
      </section>

      <section className="border-t border-lavender/30 pt-6">
        {record ? (
          <StaffCustomerPayments
            customerId={record.profile.id}
            methods={record.paymentMethods}
            preview={preview}
            autoStartAddCard={startCard}
            onChange={handlePayments}
          />
        ) : (
          <>
            <h3 className="text-base font-medium text-gold-dark">Payment Methods</h3>
            <p className="mt-3 text-sm text-text-muted">No cards on file.</p>
            <button
              type="button"
              onClick={() => void handleAddCard()}
              disabled={saving}
              className="mt-4 rounded-xl border border-dashed border-gold/50 px-4 py-2 text-sm font-medium text-gold-dark disabled:opacity-60"
            >
              {saving ? "Preparing…" : "+ Add a card"}
            </button>
          </>
        )}
      </section>

      <section className="space-y-4 border-t border-lavender/30 pt-6">
        <h3 className="text-base font-medium text-gold-dark">Password</h3>
        <label className="block text-sm font-medium text-text">
          New password
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setSaved(false);
            }}
            className={inputClassName()}
          />
        </label>
        <label className="block text-sm font-medium text-text">
          Confirm password
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setSaved(false);
            }}
            className={inputClassName()}
          />
        </label>
      </section>

      {error ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Creating…" : "Create profile"}
        </button>
        {saved ? (
          <span className="text-xs text-text-muted">Customer profile created.</span>
        ) : null}
      </div>
    </form>
  );
}
