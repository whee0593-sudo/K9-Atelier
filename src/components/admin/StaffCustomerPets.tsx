"use client";

import React, { useEffect, useState } from "react";
import { PetProfileFieldsForm } from "@/components/account/PetProfileFieldsForm";
import { RabiesStatusSummary } from "@/components/account/RabiesStatusSummary";
import {
  formatPetAgeLabel,
  getPetAgeYears,
  getPetBirthDateHeading,
  getPetBirthDateLabel,
} from "@/lib/pet-age";
import {
  displayedRabiesExpiration,
  mapPetProfileToWriteInput,
  mapPetRecordToUiProfile,
} from "@/lib/pets/map";
import { normalizePetProfile, type PetProfile } from "@/lib/pets";
import type { StaffCustomerRecord } from "@/lib/profiles/staff-service";
import {
  parsePetRabiesStatus,
  petProfileRabiesRecordLabel,
  rabiesStatusDisplayLabel,
} from "@/lib/vaccinations/booking";

type StaffPet = StaffCustomerRecord["pets"][number];

export type PetServiceVisit = {
  petId: string;
  status: string;
  appointmentDate: string;
  appointmentTime: string;
  scheduledStart?: number | null;
};

const BUSINESS_TIME_ZONE = "America/New_York";

function todayIso(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function formatServiceDate(iso: string) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function petAgeSummaryLabel(pet: StaffPet, now = new Date()) {
  const years = getPetAgeYears(
    {
      dateOfBirth: pet.dateOfBirth,
      approximateAgeYears: pet.approximateAgeYears,
    },
    now,
  );
  if (years == null) return "Age not set";
  return formatPetAgeLabel(years);
}

/** Most recent non-cancelled visit on or before today, in the business timezone. */
export function latestPetServiceLabel(
  visits: PetServiceVisit[] | null | undefined,
  petId: string,
  now = new Date(),
) {
  if (visits == null) return "Last service …";
  const today = todayIso(now);
  const latest = visits
    .filter(
      (visit) =>
        visit.petId === petId &&
        visit.status !== "cancelled" &&
        visit.appointmentDate <= today,
    )
    .sort((left, right) => {
      const byDate = right.appointmentDate.localeCompare(left.appointmentDate);
      if (byDate !== 0) return byDate;
      return (right.scheduledStart ?? -1) - (left.scheduledStart ?? -1);
    })[0];
  if (!latest) return "No service yet";
  const date = formatServiceDate(latest.appointmentDate);
  const time = latest.appointmentTime.trim();
  return time ? `Last service ${date} · ${time}` : `Last service ${date}`;
}

export function recordExpirationSummaryValue(pet: {
  rabiesExpirationDate?: string | null;
  vaccinationExpirationDate?: string | null;
}) {
  const iso = displayedRabiesExpiration(pet);
  return iso ? formatServiceDate(iso) : "—";
}

function detailValue(value: string | number | null | undefined) {
  if (value == null) return "—";
  const text = String(value).trim();
  return text || "—";
}

function lastServiceDetail(label: string) {
  return label.replace(/^Last service\s+/, "");
}

function StaffPetDetails({
  pet,
  lastService,
}: {
  pet: StaffPet;
  lastService: string;
}) {
  const profile = mapPetRecordToUiProfile(pet);
  const birthHeading = getPetBirthDateHeading(profile);
  const birthLabel = getPetBirthDateLabel(profile);
  const rabies = parsePetRabiesStatus(profile.rabiesStatus);
  const rows: Array<{ label: string; value: string; wide?: boolean }> = [
    { label: "Pet Name", value: detailValue(pet.name) },
    { label: "Breed", value: detailValue(pet.breed) },
    {
      label: "Weight (lbs)",
      value: pet.weightLbs > 0 ? String(pet.weightLbs) : "—",
    },
    { label: "Age", value: petAgeSummaryLabel(pet) },
  ];
  if (birthHeading) {
    rows.push({ label: birthHeading, value: detailValue(birthLabel) });
  }
  rows.push(
    { label: "Sex", value: detailValue(pet.sex) },
    {
      label: "Temperament & Handling Notes",
      value: detailValue(pet.temperamentNotes),
      wide: true,
    },
    {
      label: "Health & Comfort Notes",
      value: detailValue(pet.healthComfortNotes),
      wide: true,
    },
    {
      label: "Grooming Preferences",
      value: detailValue(pet.groomingPreferences),
      wide: true,
    },
    {
      label: "Rabies Status",
      value: rabies ? rabiesStatusDisplayLabel(rabies) : "Not confirmed",
    },
    { label: "Rabies Record", value: petProfileRabiesRecordLabel(profile) },
    {
      label: "Record Expiration Date",
      value: recordExpirationSummaryValue(pet),
    },
    {
      label: "Service & Product Notes (Admin Only)",
      value: detailValue(pet.adminServiceNotes),
      wide: true,
    },
    { label: "Last Service", value: lastServiceDetail(lastService), wide: true },
  );

  return (
    <dl className="grid gap-4 border-t border-lavender/30 px-4 py-4 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className={row.wide ? "sm:col-span-2" : undefined}>
          <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
            {row.label}
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-text">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function createDraftPet(): PetProfile {
  return {
    id: `draft-${Date.now()}`,
    name: "",
    breed: "",
    weightLbs: 0,
    vaccineRecordUploaded: false,
    vaccinationBookingStatus: "missing",
  };
}

function StaffPetEditor({
  customerId,
  pet,
  preview = false,
  onSaved,
  onArchived,
  onClose,
}: {
  customerId: string;
  pet: StaffPet;
  preview?: boolean;
  onSaved: (pet: StaffPet) => void;
  onArchived: (petId: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<PetProfile>(() =>
    normalizePetProfile({
      ...mapPetRecordToUiProfile(pet),
      adminServiceNotes: pet.adminServiceNotes,
    }),
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(
      normalizePetProfile({
        ...mapPetRecordToUiProfile(pet),
        adminServiceNotes: pet.adminServiceNotes,
      }),
    );
  }, [pet]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    let savedPet = false;
    try {
      if (preview) {
        onSaved({
          ...pet,
          ...mapPetProfileToWriteInput(draft),
          adminServiceNotes: draft.adminServiceNotes ?? "",
        });
        savedPet = true;
      } else {
        const response = await fetch(
          `/api/admin/customers/${customerId}/pets/${pet.id}`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...mapPetProfileToWriteInput(draft),
              adminServiceNotes: draft.adminServiceNotes ?? "",
            }),
          },
        );
        const body = (await response.json()) as {
          error?: string;
          pet?: StaffPet;
        };
        if (!response.ok || !body.pet) {
          throw new Error(body.error ?? "Could not save this pet profile.");
        }
        onSaved(body.pet);
        savedPet = true;
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this pet profile.",
      );
    } finally {
      setSaving(false);
    }
    if (savedPet) onClose();
  }

  async function handleArchive() {
    if (!window.confirm("Remove this pet from the customer's active profiles?")) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (preview) {
        onArchived(pet.id);
        return;
      }
      const response = await fetch(
        `/api/admin/customers/${customerId}/pets/${pet.id}`,
        { method: "DELETE", credentials: "include" },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not remove this pet profile.");
      }
      onArchived(pet.id);
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "Could not remove this pet profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleVaccinationUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      if (preview) {
        const next: StaffPet = {
          ...pet,
          ...mapPetProfileToWriteInput(draft),
          adminServiceNotes: draft.adminServiceNotes ?? "",
          vaccinationHasUpload: true,
          vaccinationBookingStatus: "needs_review",
          vaccinationExpirationDate: draft.vaccineExpiration ?? null,
        };
        onSaved(next);
        setDraft((current) =>
          normalizePetProfile({
            ...current,
            vaccineRecordUploaded: true,
            vaccinationBookingStatus: "needs_review",
          }),
        );
        setSaved(true);
        return;
      }

      const form = new FormData();
      form.append("file", file);
      if (draft.vaccineExpiration) {
        form.append("expirationDate", draft.vaccineExpiration);
      }
      const response = await fetch(
        `/api/admin/customers/${customerId}/pets/${pet.id}/vaccinations`,
        { method: "POST", credentials: "include", body: form },
      );
      const body = (await response.json()) as {
        error?: string;
        pet?: StaffPet;
      };
      if (!response.ok || !body.pet) {
        throw new Error(body.error ?? "Could not upload this vaccination record.");
      }
      onSaved({
        ...body.pet,
        adminServiceNotes: draft.adminServiceNotes ?? body.pet.adminServiceNotes,
      });
      setSaved(true);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload this vaccination record.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <PetProfileFieldsForm
        pet={draft}
        onPetChange={(updates) => {
          setDraft((current) => normalizePetProfile({ ...current, ...updates }));
          setSaved(false);
        }}
        petPersisted
        vaccinationUploading={uploading}
        vaccinationAudience="admin"
        onVaccinationUpload={handleVaccinationUpload}
      />
      <label className="block text-sm font-medium text-text">
        Service & Product Notes (Admin Only)
        <textarea
          value={draft.adminServiceNotes ?? ""}
          onChange={(event) => {
            setDraft((current) => ({
              ...current,
              adminServiceNotes: event.target.value,
            }));
            setSaved(false);
          }}
          rows={3}
          className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm text-text"
        />
      </label>
      {error && (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || uploading}
          className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Pet"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={saving || uploading}
          className="rounded-xl border border-lavender px-4 py-2 text-sm text-text-muted disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleArchive()}
          disabled={saving || uploading}
          className="text-xs text-text-muted underline disabled:opacity-60"
        >
          Remove this pet profile
        </button>
        {saved && <span className="text-xs text-text-muted">Saved</span>}
      </div>
    </div>
  );
}

export function StaffCustomerPets({
  customerId,
  pets,
  preview = false,
  appointments,
  onPetSaved,
  onPetCreated,
  onPetArchived,
}: {
  customerId: string;
  pets: StaffPet[];
  preview?: boolean;
  /** When omitted on a live customer file, visit history is loaded for last-service labels. */
  appointments?: PetServiceVisit[];
  onPetSaved: (pet: StaffPet) => void;
  onPetCreated: (pet: StaffPet) => void;
  onPetArchived: (petId: string) => void;
}) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftPet, setDraftPet] = useState<PetProfile>(() => createDraftPet());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedVisits, setLoadedVisits] = useState<PetServiceVisit[] | null>(
    null,
  );

  useEffect(() => {
    if (preview || appointments) return;
    let cancelled = false;
    void fetch(`/api/admin/customers/${customerId}/history`, {
      credentials: "include",
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          appointments?: PetServiceVisit[];
        };
        if (cancelled) return;
        setLoadedVisits(response.ok ? (body.appointments ?? []) : []);
      })
      .catch(() => {
        if (!cancelled) setLoadedVisits([]);
      });
    return () => {
      cancelled = true;
    };
  }, [appointments, customerId, preview]);

  const visits = appointments ?? (preview ? [] : loadedVisits);

  async function handleAddPet() {
    setSubmitting(true);
    setError(null);
    try {
      const input = mapPetProfileToWriteInput(draftPet);
      if (preview) {
        onPetCreated({
          id: crypto.randomUUID(),
          name: input.name,
          breed: input.breed,
          weightLbs: input.weightLbs,
          dateOfBirth: input.dateOfBirth ?? null,
          approximateAgeYears: input.approximateAgeYears ?? null,
          sex: input.sex ?? null,
          temperamentNotes: input.temperamentNotes ?? null,
          healthComfortNotes: input.healthComfortNotes ?? null,
          groomingPreferences: input.groomingPreferences ?? null,
          rabiesStatus: input.rabiesStatus ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          adminServiceNotes: "",
          vaccinationBookingStatus: "missing",
          vaccinationHasUpload: false,
        });
        setShowNewForm(false);
        setDraftPet(createDraftPet());
        return;
      }

      const response = await fetch(`/api/admin/customers/${customerId}/pets`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await response.json()) as { error?: string; pet?: StaffPet };
      if (!response.ok || !body.pet) {
        throw new Error(body.error ?? "Could not add this pet profile.");
      }
      onPetCreated(body.pet);
      setShowNewForm(false);
      setDraftPet(createDraftPet());
    } catch (addError) {
      setError(
        addError instanceof Error ? addError.message : "Could not add this pet profile.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-medium text-gold-dark">Pet Profiles</h3>
        {!showNewForm ? (
          <button
            type="button"
            onClick={() => {
              setShowNewForm(true);
              setError(null);
            }}
            className="rounded-xl border border-dashed border-gold/50 px-3 py-2 text-sm font-medium text-gold-dark"
          >
            + Add a pet
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {pets.length === 0 && !showNewForm ? (
        <p className="mt-3 text-sm text-text-muted">No pet profiles yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {pets.map((pet) => {
            const serviceLabel = latestPetServiceLabel(visits, pet.id);
            const expanded = openId === pet.id || editingId === pet.id;
            const editing = editingId === pet.id;
            return (
              <div
                key={pet.id}
                className="rounded-xl border border-lavender/30"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (editing) return;
                      setOpenId((current) => (current === pet.id ? null : pet.id));
                    }}
                    aria-expanded={expanded}
                    aria-label={
                      expanded
                        ? `Close ${pet.name} profile`
                        : `Open ${pet.name} profile`
                    }
                    className="min-w-0 flex-1 px-4 py-3 text-left text-sm text-text"
                  >
                    <span className="font-medium">{pet.name}</span>
                    <span className="text-text-muted">
                      {" · "}
                      {petAgeSummaryLabel(pet)}
                      {" · "}
                      {serviceLabel}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenId(pet.id);
                      setEditingId(pet.id);
                    }}
                    className="mr-3 shrink-0 rounded-xl border border-lavender/40 px-3 py-1.5 text-sm text-text-muted hover:border-gold/40 hover:text-text"
                  >
                    Edit
                  </button>
                </div>
                {editing ? (
                  <div className="border-t border-lavender/30 px-4 py-4">
                    <div className="rounded-xl border border-lavender/30 bg-lavender-light/20 px-4 py-4">
                      <RabiesStatusSummary
                        pet={mapPetRecordToUiProfile(pet)}
                        statusLabel="Rabies Status"
                      />
                    </div>
                    <StaffPetEditor
                      customerId={customerId}
                      pet={pet}
                      preview={preview}
                      onSaved={onPetSaved}
                      onArchived={(petId) => {
                        setEditingId(null);
                        setOpenId((current) => (current === petId ? null : current));
                        onPetArchived(petId);
                      }}
                      onClose={() => setEditingId(null)}
                    />
                  </div>
                ) : expanded ? (
                  <StaffPetDetails pet={pet} lastService={serviceLabel} />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {showNewForm ? (
        <div className="mt-4 rounded-2xl border border-dashed border-gold/50 bg-lavender-light/20 p-6">
          <h4 className="font-medium text-gold-dark">
            {draftPet.name.trim() ? `${draftPet.name.trim()} Profile` : "New Pet Profile"}
          </h4>
          <div className="mt-4">
            <PetProfileFieldsForm
              pet={draftPet}
              onPetChange={(updates) =>
                setDraftPet((current) =>
                  normalizePetProfile({ ...current, ...updates }),
                )
              }
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleAddPet()}
              disabled={submitting}
              className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitting ? "Adding…" : "Save Pet"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewForm(false);
                setDraftPet(createDraftPet());
                setError(null);
              }}
              className="rounded-xl border border-lavender px-4 py-2 text-sm text-text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
