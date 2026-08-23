"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  bookingFieldClass,
  bookingLabelClass,
  bookingPrimaryBtnClass,
} from "@/components/booking/booking-ui";

const OTP_MIN_LENGTH = 6;
const OTP_MAX_LENGTH = 10;

export function RecoveryCodeForm({
  defaultEmail = "",
  onVerified,
}: {
  defaultEmail?: string;
  onVerified: () => void;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = otp.trim();
    if (code.length < OTP_MIN_LENGTH || code.length > OTP_MAX_LENGTH) {
      setError(`Enter the ${OTP_MIN_LENGTH}-digit code from your email.`);
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: "recovery",
    });
    setLoading(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    onVerified();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
      <p className="font-body text-sm leading-relaxed text-ink">
        On a phone, enter the 6-digit code from the reset email instead of
        opening the link.
      </p>
      <div>
        <label htmlFor="recovery-email" className={bookingLabelClass}>
          Email Address
        </label>
        <input
          id="recovery-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={bookingFieldClass}
        />
      </div>
      <div>
        <label htmlFor="recovery-otp" className={bookingLabelClass}>
          6-digit code
        </label>
        <input
          id="recovery-otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={otp}
          onChange={(event) =>
            setOtp(event.target.value.replace(/\D/g, "").slice(0, OTP_MAX_LENGTH))
          }
          className={bookingFieldClass}
          placeholder={`${OTP_MIN_LENGTH}-digit code from email`}
          minLength={OTP_MIN_LENGTH}
          maxLength={OTP_MAX_LENGTH}
          pattern={`[0-9]{${OTP_MIN_LENGTH},${OTP_MAX_LENGTH}}`}
        />
      </div>
      {error ? (
        <p className="font-body text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={
          loading ||
          email.trim().length === 0 ||
          otp.trim().length < OTP_MIN_LENGTH
        }
        className={bookingPrimaryBtnClass}
      >
        {loading ? "Verifying…" : "Continue"}
      </button>
    </form>
  );
}
