"use client";

import React, { useEffect, useState } from "react";
import type { CustomerProfile } from "@/lib/profiles/types";
import {
  EMERGENCY_RELATIONSHIP_OPTIONS,
  PREFERRED_CONTACT_OPTIONS,
} from "@/lib/profiles/types";
import {
  CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS,
  formatMissingProfileFieldsMessage,
  missingCustomerProfileFieldLabels,
} from "@/lib/profiles/validation";

function inputClassName() {
  return "mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm text-text placeholder:text-text-muted/50";
}

type Draft = {
  firstName: string;
  lastName: string;
  phone: string;
  preferredContact: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
};

function toDraft(profile: CustomerProfile): Draft {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    preferredContact:
      profile.preferredContact === "Phone" ? "Email" : profile.preferredContact,
    emergencyContactName: profile.emergencyContactName,
    emergencyContactPhone: profile.emergencyContactPhone,
    emergencyContactRelationship: profile.emergencyContactRelationship,
  };
}

function requiredFieldErrors(
  draft: Draft,
  email: string,
): Partial<Record<"firstName" | "lastName" | "phone" | "email", string>> {
  const missing = missingCustomerProfileFieldLabels({
    firstName: draft.firstName,
    lastName: draft.lastName,
    phone: draft.phone,
    email,
  });
  const errors: Partial<
    Record<"firstName" | "lastName" | "phone" | "email", string>
  > = {};
  if (missing.includes(CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS.email)) {
    errors.email = "Email is required.";
  }
  if (missing.includes(CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS.firstName)) {
    errors.firstName = "First Name is required.";
  }
  if (missing.includes(CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS.lastName)) {
    errors.lastName = "Last Name is required.";
  }
  if (missing.includes(CUSTOMER_PROFILE_REQUIRED_FIELD_LABELS.phone)) {
    errors.phone = "Mobile Phone is required.";
  }
  return errors;
}

export function CustomerProfileForm({
  profile,
  emailReadOnly = true,
  saveUrl,
  onSaved,
  audience = "customer",
  preview = false,
}: {
  profile: CustomerProfile;
  emailReadOnly?: boolean;
  saveUrl: string;
  onSaved?: (profile: CustomerProfile) => void;
  audience?: "customer" | "staff";
  preview?: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requireComplete, setRequireComplete] = useState(
    () =>
      audience === "customer" &&
      missingCustomerProfileFieldLabels({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        email: profile.email,
      }).length > 0,
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(toDraft(profile));
    setError(null);
    setRequireComplete(
      audience === "customer" &&
        missingCustomerProfileFieldLabels({
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone,
          email: profile.email,
        }).length > 0,
    );
  }, [profile, audience]);

  const missing = missingCustomerProfileFieldLabels({
    firstName: draft.firstName,
    lastName: draft.lastName,
    phone: draft.phone,
    email: profile.email,
  });
  const fieldErrors = requireComplete
    ? requiredFieldErrors(draft, profile.email)
    : {};
  const incompleteMessage = requireComplete
    ? formatMissingProfileFieldsMessage(missing, audience)
    : null;

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (missing.length > 0) {
      setRequireComplete(true);
      setError(null);
      setSaved(false);
      return;
    }

    setSaving(true);
    setError(null);
    setRequireComplete(false);

    if (preview) {
      const nextProfile: CustomerProfile = {
        ...profile,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        phone: draft.phone.trim(),
        preferredContact: draft.preferredContact,
        emergencyContactName: draft.emergencyContactName.trim(),
        emergencyContactPhone: draft.emergencyContactPhone.trim(),
        emergencyContactRelationship: draft.emergencyContactRelationship,
      };
      onSaved?.(nextProfile);
      setDraft(toDraft(nextProfile));
      setSaved(true);
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(saveUrl, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = (await response.json()) as {
        error?: string;
        profile?: CustomerProfile;
      };
      if (!response.ok || !body.profile) {
        throw new Error(body.error ?? "Could not save this profile.");
      }
      onSaved?.(body.profile);
      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this profile.",
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
        </label>
        <input
          type="email"
          required
          readOnly={emailReadOnly}
          value={profile.email}
          className={`${inputClassName()} ${emailReadOnly ? "opacity-80" : ""}`}
        />
        {fieldErrors.email || !profile.email.trim() ? (
          <p className="mt-1.5 text-xs text-red-800">
            {fieldErrors.email ?? "An email address is required on this profile."}
          </p>
        ) : null}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-text">
          First Name <span className="text-gold-dark">*</span>
          <input
            required
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
          value={draft.emergencyContactName}
          onChange={(event) => update("emergencyContactName", event.target.value)}
          className={inputClassName()}
        />
      </label>
      <label className="block text-sm font-medium text-text">
        Emergency Contact Phone
        <input
          type="tel"
          value={draft.emergencyContactPhone}
          onChange={(event) =>
            update("emergencyContactPhone", event.target.value)
          }
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
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error ?? incompleteMessage}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Profile"}
        </button>
        {saved && <span className="text-xs text-text-muted">Saved</span>}
      </div>
    </form>
  );
}

export function CustomerProfileSection() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/account/profile", {
          credentials: "include",
        });
        const body = (await response.json()) as {
          error?: string;
          profile?: CustomerProfile;
        };
        if (!response.ok || !body.profile) {
          throw new Error(body.error ?? "Could not load your profile.");
        }
        if (!cancelled) setProfile(body.profile);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load your profile.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-text-muted">Loading your profile…</p>;
  }
  if (error || !profile) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
        {error ?? "Could not load your profile."}
      </p>
    );
  }

  return (
    <CustomerProfileForm
      profile={profile}
      saveUrl="/api/account/profile"
      onSaved={setProfile}
    />
  );
}
