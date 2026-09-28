"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CommunicationDetail } from "@/lib/communication/types";

export function AddCommunicationCustomer({
  conversationId,
  preview = false,
  previewPhone = "(561) 555-0199",
}: {
  conversationId?: string;
  preview?: boolean;
  previewPhone?: string;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(preview ? previewPhone : "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [petName, setPetName] = useState("");
  const [petBreed, setPetBreed] = useState("");
  const [petWeight, setPetWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (preview || !conversationId) return;
    let stop = false;
    void fetch(`/api/admin/communication/${conversationId}`, { credentials: "include" })
      .then(async (response) => {
        const body = (await response.json()) as { detail?: CommunicationDetail; error?: string };
        if (stop) return;
        if (!response.ok || !body.detail) {
          setError(body.error ?? "Conversation not found.");
          return;
        }
        if (!body.detail.unknown) {
          setDone(body.detail.customerId);
          return;
        }
        setPhone(body.detail.phoneDisplay);
      })
      .catch(() => {
        if (!stop) setError("Could not load this number.");
      });
    return () => {
      stop = true;
    };
  }, [conversationId, preview]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (preview) {
      setDone("preview");
      return;
    }
    if (!conversationId) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/communication/${conversationId}/customer`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName,
            lastName,
            email,
            petName,
            petBreed,
            petWeightLbs: petWeight,
          }),
        },
      );
      const body = (await response.json()) as { customerId?: string; error?: string };
      if (!response.ok || !body.customerId) {
        setError(body.error ?? "Could not add this customer.");
        return;
      }
      router.push(`/admin/communication/${conversationId}`);
      router.refresh();
    } catch {
      setError("Could not add this customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="min-h-[100dvh] bg-ivory px-4 py-4">
      <Link
        href={
          preview
            ? "/admin/communication/preview/thread?who=missed"
            : conversationId
              ? `/admin/communication/${conversationId}`
              : "/admin/communication"
        }
        className="text-sm font-medium text-gold-dark"
      >
        Back
      </Link>
      <h1 className="mt-3 font-display text-4xl text-gold-dark">Add Customer</h1>
      <p className="mt-2 text-sm leading-6 text-text-muted">
        This number is saved on the new customer file, and earlier calls and texts stay
        attached to it.
      </p>
      {done && done !== "preview" ? (
        <p className="mt-6 text-sm text-ink">
          This number is already linked.{" "}
          <Link href={`/admin/pets?customer=${done}`} className="font-medium text-gold-dark">
            Open customer profile
          </Link>
        </p>
      ) : null}
      {done === "preview" ? (
        <p className="mt-6 rounded-2xl border border-lavender/30 bg-cream p-4 text-sm text-ink">
          Preview only. {firstName || "This caller"} would be linked to {phone}.
        </p>
      ) : null}
      {!done ? (
        <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
          <Field label="First Name" value={firstName} onChange={setFirstName} />
          <Field label="Last Name" value={lastName} onChange={setLastName} />
          <Field label="Email" value={email} onChange={setEmail} type="email" />
          <label className="block text-sm font-medium text-ink">
            Mobile Phone
            <input
              value={phone}
              readOnly
              className="mt-1 min-h-12 w-full rounded-2xl border border-lavender/40 bg-cream px-4 text-base text-ink"
            />
          </label>
          <div className="rounded-2xl border border-lavender/30 bg-cream p-4">
            <p className="text-sm font-medium text-ink">Pet</p>
            <p className="mt-1 text-xs leading-5 text-text-muted">
              Optional. Add a name, breed, and weight together, or leave them blank.
            </p>
            <div className="mt-3 space-y-3">
              <Field label="Pet name" value={petName} onChange={setPetName} />
              <Field label="Breed" value={petBreed} onChange={setPetBreed} />
              <Field label="Weight (lbs)" value={petWeight} onChange={setPetWeight} type="number" />
            </div>
          </div>
          {error ? <p className="text-sm text-ink">{error}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="min-h-12 w-full rounded-2xl bg-gold-dark text-sm font-medium text-ivory disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add Customer"}
          </button>
        </form>
      ) : null}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-12 w-full rounded-2xl border border-lavender/40 bg-white px-4 text-base text-ink"
      />
    </label>
  );
}
