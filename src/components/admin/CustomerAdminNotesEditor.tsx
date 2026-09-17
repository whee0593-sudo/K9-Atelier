"use client";

import React, { useEffect, useId, useState } from "react";
import {
  loadCustomerAdminNotes,
  saveCustomerAdminNotes,
} from "@/lib/profiles/admin-notes-client";

export function CustomerAdminNotesEditor({
  customerId,
  preview = false,
}: {
  customerId: string;
  preview?: boolean;
}) {
  const fieldId = useId();
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSaved(false);

    void loadCustomerAdminNotes(customerId, preview)
      .then((value) => {
        if (!cancelled) setNotes(value);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setNotes("");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load this customer record.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [customerId, preview]);

  async function handleSave() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await saveCustomerAdminNotes(customerId, notes, preview);
      setNotes(next);
      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this customer record.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="text-base font-medium text-gold-dark">Customer record</h3>
      <p className="mt-1 text-sm text-text-muted">
        Admin only. These notes stay with this customer.
      </p>
      <label htmlFor={fieldId} className="sr-only">
        Admin notes
      </label>
      <textarea
        id={fieldId}
        value={notes}
        onChange={(event) => {
          setNotes(event.target.value);
          setSaved(false);
        }}
        rows={6}
        disabled={busy || loading}
        className="mt-3 w-full resize-none rounded-xl border border-lavender/40 bg-cream px-4 py-3 text-sm text-text disabled:opacity-60"
      />
      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {saved && !error ? (
        <p className="mt-3 text-sm text-gold-dark">Saved.</p>
      ) : null}
      <div className="mt-4">
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => void handleSave()}
          className="rounded-xl bg-deep-lavender px-4 py-2 text-sm font-medium text-ivory transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </section>
  );
}
