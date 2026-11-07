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
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEditing(false);
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
      setEditing(false);
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
      {loading ? (
        <p className="mt-3 text-sm text-text-muted">Loading…</p>
      ) : editing ? (
        <>
      <label htmlFor={fieldId} className="sr-only">
        Admin notes
      </label>
      <textarea
        id={fieldId}
        autoFocus
        value={notes}
        onChange={(event) => {
          setNotes(event.target.value);
          setSaved(false);
        }}
        rows={Math.min(12, Math.max(3, notes.split("\n").length))}
        disabled={busy || loading}
        className="mt-3 w-full resize-y rounded-xl border border-lavender/40 bg-cream px-4 py-3 text-sm text-text disabled:opacity-60"
      />
        </>
      ) : (
        <button
          type="button"
          aria-label={notes.trim() ? "Edit customer record" : "Add customer record"}
          onClick={() => {
            setEditing(true);
            setSaved(false);
          }}
          className="mt-3 block w-full whitespace-pre-wrap break-words rounded-sm text-left text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-deep-lavender"
        >
          {notes.trim() ? notes : <span className="text-text-muted">Add notes</span>}
        </button>
      )}
      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {saved && !error ? (
        <p className="mt-3 text-sm text-gold-dark">Saved.</p>
      ) : null}
      {editing ? (
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
      ) : null}
    </section>
  );
}
