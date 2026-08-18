"use client";

import { useEffect, useState } from "react";
import type { CustomerProfile } from "@/lib/profiles/types";
import {
  EMERGENCY_RELATIONSHIP_OPTIONS,
  PREFERRED_CONTACT_OPTIONS,
} from "@/lib/profiles/types";

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
    preferredContact: profile.preferredContact,
    emergencyContactName: profile.emergencyContactName,
    emergencyContactPhone: profile.emergencyContactPhone,
    emergencyContactRelationship: profile.emergencyContactRelationship,
  };
}

export function CustomerProfileForm({
  profile,
  emailReadOnly = true,
  saveUrl,
  onSaved,
}: {
  profile: CustomerProfile;
  emailReadOnly?: boolean;
  saveUrl: string;
  onSaved?: (profile: CustomerProfile) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(toDraft(profile));
  }, [profile]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
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
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-text">Email</label>
        <input
          readOnly={emailReadOnly}
          value={profile.email}
          className={`${inputClassName()} ${emailReadOnly ? "opacity-80" : ""}`}
        />
        {emailReadOnly && (
          <p className="mt-1.5 text-xs text-text-muted">
            Used for booking confirmations and reminders.
          </p>
        )}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-text">
          First Name
          <input
            value={draft.firstName}
            onChange={(event) => update("firstName", event.target.value)}
            className={inputClassName()}
          />
        </label>
        <label className="block text-sm font-medium text-text">
          Last Name
          <input
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
          value={draft.phone}
          onChange={(event) => update("phone", event.target.value)}
          placeholder="(555) 123-4567"
          className={inputClassName()}
        />
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
        <p className="mt-1 text-xs text-text-muted">
          Optional — someone we can contact if we cannot reach you.
        </p>
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
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Profile"}
        </button>
        {saved && <span className="text-xs text-text-muted">Saved</span>}
      </div>
    </div>
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
