"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  bookingFieldClass,
  bookingLabelClass,
  bookingPrimaryBtnClass,
} from "@/components/booking/booking-ui";

const MIN_PASSWORD_LENGTH = 8;

export function SetPasswordForm({
  heading = "Set a password",
  submitLabel = "Save password",
}: {
  heading?: string;
  submitLabel?: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPassword("");
    setConfirm("");
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-text-muted">{heading}</p>
      <div>
        <label htmlFor="new-password" className={bookingLabelClass}>
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={bookingFieldClass}
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </div>
      <div>
        <label htmlFor="confirm-password" className={bookingLabelClass}>
          Confirm password
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className={bookingFieldClass}
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </div>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-gold-dark" role="status">
          Password saved. You can use it the next time you sign in.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className={bookingPrimaryBtnClass}
      >
        {loading ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
