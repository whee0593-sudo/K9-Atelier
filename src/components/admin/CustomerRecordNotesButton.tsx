"use client";

import React, { useEffect, useId, useState } from "react";

const previewNotesByCustomer = new Map<string, string>();

export function CustomerRecordNotesDialog({
  open,
  notes,
  onNotesChange,
  onClose,
  onSave,
  busy = false,
  loading = false,
  error = null,
  saved = false,
}: {
  open: boolean;
  notes: string;
  onNotesChange: (notes: string) => void;
  onClose: () => void;
  onSave: () => void;
  busy?: boolean;
  loading?: boolean;
  error?: string | null;
  saved?: boolean;
}) {
  const titleId = useId();
  const fieldId = useId();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-2xl border border-lavender/30 bg-cream p-6 pt-12 shadow-sm"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={titleId} className="sr-only">
          Customer record
        </h3>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-2xl font-light leading-none text-text-muted transition hover:bg-lavender-light hover:text-text disabled:opacity-50"
        >
          ×
        </button>
        <label htmlFor={fieldId} className="sr-only">
          Admin notes
        </label>
        <textarea
          id={fieldId}
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          rows={8}
          disabled={busy || loading}
          className="w-full resize-none rounded-xl border border-lavender/40 bg-cream px-4 py-3 text-sm text-text disabled:opacity-60"
        />
        {error ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {saved && !error ? (
          <p className="mt-3 text-sm text-gold-dark">Saved.</p>
        ) : null}
        <div className="mt-6">
          <button
            type="button"
            disabled={busy || loading}
            onClick={onSave}
            className="rounded-xl bg-deep-lavender px-4 py-2 text-sm font-medium text-ivory transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CustomerRecordNotesButton({
  customerId,
  preview = false,
}: {
  customerId: string;
  preview?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function openDialog() {
    setError(null);
    setSaved(false);
    setOpen(true);

    if (preview) {
      setNotes(previewNotesByCustomer.get(customerId) ?? "");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/customers/${customerId}/notes`,
        { credentials: "include" },
      );
      const body = (await response.json()) as { notes?: string; error?: string };
      if (!response.ok) {
        setNotes("");
        setError(body.error ?? "Could not load this customer record.");
        return;
      }
      setNotes(body.notes ?? "");
    } catch {
      setNotes("");
      setError("Could not load this customer record.");
    } finally {
      setLoading(false);
    }
  }

  async function saveNotes() {
    setBusy(true);
    setError(null);
    setSaved(false);

    if (preview) {
      previewNotesByCustomer.set(customerId, notes);
      setSaved(true);
      setBusy(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/customers/${customerId}/notes`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        },
      );
      const body = (await response.json()) as { notes?: string; error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not save this customer record.");
        return;
      }
      setNotes(body.notes ?? notes);
      setSaved(true);
    } catch {
      setError("Could not save this customer record.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openDialog()}
        className="rounded-xl border border-lavender/40 px-4 py-2 text-sm font-medium text-text"
      >
        Customer record
      </button>
      <CustomerRecordNotesDialog
        open={open}
        notes={notes}
        onNotesChange={(value) => {
          setNotes(value);
          setSaved(false);
        }}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        onSave={() => void saveNotes()}
        busy={busy}
        loading={loading}
        error={error}
        saved={saved}
      />
    </>
  );
}
