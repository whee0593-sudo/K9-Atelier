"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sanitizeAuthRedirect } from "@/lib/auth-redirect";
import {
  bookingFieldClass,
  bookingLabelClass,
  bookingPrimaryBtnClass,
} from "@/components/booking/booking-ui";

type Props = {
  next?: string;
  bookingFlow?: boolean;
  adminFlow?: boolean;
};

type Step = "email" | "sent";

/** Supabase Mailer OTP length: 6–10 digits (4 is not supported). */
const OTP_MIN_LENGTH = 6;
const OTP_MAX_LENGTH = 10;

export function CustomerLoginActions({
  next,
  bookingFlow,
  adminFlow,
}: Props) {
  const destination = sanitizeAuthRedirect(next);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`;
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo,
      },
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setStep("sent");
  }

  async function handleVerifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const code = otp.trim();
    if (code.length < OTP_MIN_LENGTH || code.length > OTP_MAX_LENGTH) {
      setLoading(false);
      setError(`Enter the ${OTP_MIN_LENGTH}-digit code from your email.`);
      return;
    }

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: "email",
    });

    setLoading(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    window.location.assign(destination);
  }

  if (step === "sent") {
    return (
      <div className="mt-10 text-left">
        <p className="font-body text-sm leading-relaxed text-ink">
          Check your email for a secure sign-in link sent to{" "}
          <span className="font-medium">{email.trim()}</span>.
        </p>
        <p className="font-body mt-3 text-xs text-taupe">
          The link expires shortly. You can close this page after signing in.
        </p>

        <form onSubmit={handleVerifyOtp} className="mt-8 space-y-4">
          <div>
            <label htmlFor="login-otp" className={bookingLabelClass}>
              Have a one-time code instead?
            </label>
            <input
              id="login-otp"
              name="otp"
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
          {error && (
            <p className="font-body text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={
              loading ||
              otp.trim().length < OTP_MIN_LENGTH ||
              otp.trim().length > OTP_MAX_LENGTH
            }
            className={bookingPrimaryBtnClass}
          >
            {loading ? "Verifying…" : "Verify Code"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setStep("email");
            setOtp("");
            setError(null);
          }}
          className="font-body mt-4 text-xs text-taupe underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSendLink} className="mt-10 space-y-4 text-left">
      <div>
        <label htmlFor="login-email" className={bookingLabelClass}>
          Email Address
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={bookingFieldClass}
          placeholder="you@example.com"
        />
      </div>

      {error && (
        <p className="font-body text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || email.trim().length === 0}
        className={bookingPrimaryBtnClass}
      >
        {loading ? "Sending…" : "Email Me a Sign-In Link"}
      </button>

      {adminFlow ? (
        <p className="font-body text-xs text-taupe">
          Customer account?{" "}
          <a href="/login?next=/account" className="text-ink underline">
            Customer sign in
          </a>
        </p>
      ) : !bookingFlow ? (
        <p className="font-body text-xs text-taupe">
          Booking a private appointment?{" "}
          <a href="/login?next=/book" className="text-ink underline">
            Continue to booking
          </a>
          {" · "}
          K9 Atelier team?{" "}
          <a href="/login?next=/admin" className="text-ink underline">
            Staff sign in
          </a>
        </p>
      ) : null}
    </form>
  );
}
