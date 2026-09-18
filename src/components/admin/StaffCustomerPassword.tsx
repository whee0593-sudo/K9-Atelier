"use client";

import React, { useState } from "react";
import type { FormEvent } from "react";
import { MIN_CUSTOMER_PASSWORD_LENGTH } from "@/lib/profiles/validation";

export function StaffCustomerPassword({
  customerId,
  preview = false,
}: {
  customerId: string;
  preview?: boolean;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (password.length < MIN_CUSTOMER_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_CUSTOMER_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      if (!preview) {
        const response = await fetch(
          `/api/admin/customers/${customerId}/password`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
          },
        );
        const body = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(body.error ?? "Could not save this password.");
        }
      }
      setPassword("");
      setConfirm("");
      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this password.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h3 className="text-base font-medium text-gold-dark">Password</h3>
      <p className="mt-2 text-sm text-text-muted">
        Set a new sign-in password for this customer. They can use it the next
        time they log in.
      </p>
      <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 space-y-4">
        <label className="block text-sm font-medium text-text">
          New password
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={MIN_CUSTOMER_PASSWORD_LENGTH}
            className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm text-text"
          />
        </label>
        <label className="block text-sm font-medium text-text">
          Confirm password
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            minLength={MIN_CUSTOMER_PASSWORD_LENGTH}
            className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm text-text"
          />
        </label>
        {error ? (
          <p className="text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="text-sm text-gold-dark" role="status">
            Password saved.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save password"}
        </button>
      </form>
    </section>
  );
}
