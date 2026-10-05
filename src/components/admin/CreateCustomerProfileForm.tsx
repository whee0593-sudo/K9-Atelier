"use client";

import React, { useState } from "react";
import type { StaffCustomerRecord } from "@/lib/profiles/staff-service";
import {
  EMERGENCY_RELATIONSHIP_OPTIONS,
  PREFERRED_CONTACT_OPTIONS,
} from "@/lib/profiles/types";
import { isOwnerEmail } from "@/lib/staff/owner";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import {
  CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS,
  formatMissingProfileFieldsMessage,
  missingCustomerProfileFieldLabels,
} from "@/lib/profiles/validation";

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

function previewCustomer(draft: Draft, phone: string): StaffCustomerRecord {
  return {
    profile: {
      id: crypto.randomUUID(),
      email: draft.email.trim().toLowerCase(),
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      phone,
      preferredContact: draft.preferredContact,
      emergencyContactName: draft.emergencyContactName.trim(),
      emergencyContactPhone: draft.emergencyContactPhone.trim(),
      emergencyContactRelationship: draft.emergencyContactRelationship,
    },
    pets: [],
    paymentMethods: [],
    kind: "customer",
    frozen: false,
    canDelete: true,
    canFreeze: true,
  };
}

export function CreateCustomerProfileForm({
  preview = false,
  existingEmails = [],
  onCreated,
}: {
  preview?: boolean;
  existingEmails?: string[];
  onCreated: (customer: StaffCustomerRecord) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requireComplete, setRequireComplete] = useState(false);
  const [saved, setSaved] = useState(false);

  const missing = missingCustomerProfileFieldLabels({
    firstName: draft.firstName,
    lastName: draft.lastName,
    phone: draft.phone,
    email: draft.email,
  });
  const fieldErrors = requireComplete
    ? {
        email: missing.includes(CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS.email)
          ? "Email is required."
          : undefined,
        firstName: missing.includes(CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS.firstName)
          ? "First Name is required."
          : undefined,
        lastName: missing.includes(CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS.lastName)
          ? "Last Name is required."
          : undefined,
        phone: missing.includes(CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS.phone)
          ? "Mobile Phone is required."
          : undefined,
      }
    : {};
  const incompleteMessage = requireComplete
    ? formatMissingProfileFieldsMessage(missing, "staff")
    : null;

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const email = draft.email.trim().toLowerCase();
    const missingNow = missingCustomerProfileFieldLabels({
      firstName: draft.firstName,
      lastName: draft.lastName,
      phone: draft.phone,
      email,
    });
    if (missingNow.length > 0) {
      setRequireComplete(true);
      setError(null);
      setSaved(false);
      return;
    }

    const phone = normalizePhoneToE164(draft.phone);
    if (!phone) {
      setRequireComplete(true);
      setError("Please enter a valid US mobile number.");
      setSaved(false);
      return;
    }

    const emailTaken = existingEmails.some(
      (item) => item.trim().toLowerCase() === email,
    );
    if (isOwnerEmail(email) || emailTaken) {
      setError(
        isOwnerEmail(email)
          ? "That email belongs to a staff account."
          : "That email is already used by another account.",
      );
      setSaved(false);
      return;
    }

    setSaving(true);
    setError(null);
    setRequireComplete(false);

    const payload: Draft = {
      ...draft,
      email,
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      phone,
      emergencyContactName: draft.emergencyContactName.trim(),
      emergencyContactPhone: draft.emergencyContactPhone.trim(),
    };

    try {
      if (preview) {
        onCreated(previewCustomer(payload, phone));
      } else {
        const response = await fetch("/api/admin/customers", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await response.json()) as {
          error?: string;
          customer?: StaffCustomerRecord;
        };
        if (!response.ok || !body.customer) {
          throw new Error(body.error ?? "Could not create this customer profile.");
        }
        onCreated(body.customer);
      }
      setDraft(EMPTY_DRAFT);
      setSaved(true);
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

  return (
    <form className="space-y-5" onSubmit={(event) => void handleSave(event)} noValidate>
      <div>
        <label className="block text-sm font-medium text-text">
          Email <span className="text-gold-dark">*</span>
          <input
            type="email"
            required
            autoComplete="off"
            value={draft.email}
            onChange={(event) => update("email", event.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
            className={inputClassName()}
          />
        </label>
        {fieldErrors.email ? (
          <p className="mt-1.5 text-xs text-red-800">{fieldErrors.email}</p>
        ) : null}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-text">
          First Name <span className="text-gold-dark">*</span>
          <input
            required
            autoComplete="off"
            value={draft.firstName}
            onChange={(event) => update("firstName", event.target.value)}
            aria-invalid={Boolean(fieldErrors.firstName)}
            className={inputClassName()}
          />
          {fieldErrors.firstName ? (
            <p className="mt-1.5 text-xs text-red-800">{fieldErrors.firstName}</p>
          ) : null}
        </label>
        <label className="block text-sm font-medium text-text">
          Last Name <span className="text-gold-dark">*</span>
          <input
            required
            autoComplete="off"
            value={draft.lastName}
            onChange={(event) => update("lastName", event.target.value)}
            aria-invalid={Boolean(fieldErrors.lastName)}
            className={inputClassName()}
          />
          {fieldErrors.lastName ? (
            <p className="mt-1.5 text-xs text-red-800">{fieldErrors.lastName}</p>
          ) : null}
        </label>
      </div>
      <label className="block text-sm font-medium text-text">
        Mobile Phone <span className="text-gold-dark">*</span>
        <input
          type="tel"
          required
          autoComplete="off"
          value={draft.phone}
          onChange={(event) => update("phone", event.target.value)}
          placeholder="(555) 123-4567"
          aria-invalid={Boolean(fieldErrors.phone)}
          className={inputClassName()}
        />
        {fieldErrors.phone ? (
          <p className="mt-1.5 text-xs text-red-800">{fieldErrors.phone}</p>
        ) : null}
      </label>
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
      {error || incompleteMessage ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error ?? incompleteMessage}
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
