"use client";

import { useState } from "react";
import { RecoveryCodeForm } from "@/components/auth/RecoveryCodeForm";
import { createImplicitAuthClient } from "@/lib/auth-implicit";
import { setRememberMePreference } from "@/lib/auth-remember";
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
  startWithReset?: boolean;
};

type Mode = "signin" | "signup" | "forgot" | "magic";
type Step = "form" | "magic-sent" | "check-email";

const OTP_MIN_LENGTH = 6;
const OTP_MAX_LENGTH = 10;
const MIN_PASSWORD_LENGTH = 8;

function authErrorMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login")) {
    return "That email or password is incorrect.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "An account with this email already exists. Sign in, or use the email link if you have not set a password yet.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please confirm your email first. Check your inbox for a confirmation link.";
  }
  return message;
}

export function CustomerLoginActions({
  next,
  bookingFlow,
  adminFlow,
  startWithReset = false,
}: Props) {
  const destination = sanitizeAuthRedirect(next);
  const [mode, setMode] = useState<Mode>(startWithReset ? "forgot" : "signin");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setStep("form");
    setPassword("");
    setOtp("");
    setError(null);
  }

  async function handlePasswordSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    setRememberMePreference(rememberMe);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(authErrorMessage(signInError.message));
      return;
    }

    window.location.assign(destination);
  }

  async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setLoading(false);
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setRememberMePreference(rememberMe);
    const supabase = createClient();
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`;
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo },
    });

    setLoading(false);

    if (signUpError) {
      setError(authErrorMessage(signUpError.message));
      return;
    }

    if (data.session) {
      window.location.assign(destination);
      return;
    }

    setStep("check-email");
  }

  async function handleForgot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createImplicitAuthClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset")}`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo },
    );

    setLoading(false);

    if (resetError) {
      setError(authErrorMessage(resetError.message));
      return;
    }

    setStep("check-email");
  }

  async function handleSendLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`;
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo },
    });

    setLoading(false);

    if (signInError) {
      setError(authErrorMessage(signInError.message));
      return;
    }

    setStep("magic-sent");
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

    setRememberMePreference(rememberMe);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: "email",
    });

    setLoading(false);

    if (verifyError) {
      setError(authErrorMessage(verifyError.message));
      return;
    }

    window.location.assign(destination);
  }

  const footerLinks = adminFlow ? (
    <p className="font-body text-xs text-taupe">
      Customer account?{" "}
      <a href="/login?next=/account" className="text-ink underline">
        Customer sign in
      </a>
    </p>
  ) : (
    <p className="font-body text-xs text-taupe">
      <a href="/login?next=/admin" className="text-ink underline">
        Staff Login
      </a>
    </p>
  );

  if (step === "magic-sent") {
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
          onClick={() => switchMode("signin")}
          className="font-body mt-4 text-xs text-taupe underline"
        >
          Back to password sign in
        </button>
      </div>
    );
  }

  if (step === "check-email") {
    const copy =
      mode === "forgot"
        ? "If an account exists for that email, we sent a reset link and a 6-digit code. On a phone, enter the code below."
        : "Check your email to confirm your account. After that, you can sign in with your password.";

    return (
      <div className="mt-10 text-left">
        <p className="font-body text-sm leading-relaxed text-ink">{copy}</p>
        <p className="font-body mt-3 text-xs text-taupe">
          Sent to <span className="font-medium">{email.trim()}</span>.
        </p>
        {mode === "forgot" ? (
          <RecoveryCodeForm
            defaultEmail={email.trim()}
            onVerified={() => {
              window.location.assign("/auth/reset");
            }}
          />
        ) : null}
        <button
          type="button"
          onClick={() => switchMode("signin")}
          className="font-body mt-6 text-xs text-taupe underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  const title =
    mode === "signup"
      ? "Create an account"
      : mode === "forgot"
        ? "Reset password"
        : mode === "magic"
          ? "Email a sign-in link"
          : "Sign in";

  const onSubmit =
    mode === "signup"
      ? handleSignUp
      : mode === "forgot"
        ? handleForgot
        : mode === "magic"
          ? handleSendLink
          : handlePasswordSignIn;

  const submitLabel =
    mode === "signup"
      ? loading
        ? "Creating…"
        : "Create account"
      : mode === "forgot"
        ? loading
          ? "Sending…"
          : "Email reset link"
        : mode === "magic"
          ? loading
            ? "Sending…"
            : "Email me a sign-in link"
          : loading
            ? "Signing in…"
            : "Sign in";

  const showPassword = mode === "signin" || mode === "signup";

  return (
    <form onSubmit={onSubmit} className="mt-10 space-y-4 text-left">
      <p className="font-body text-sm font-medium text-ink">{title}</p>
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

      {showPassword ? (
        <div>
          <label htmlFor="login-password" className={bookingLabelClass}>
            Password
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={bookingFieldClass}
          />
          {mode === "signup" ? (
            <p className="font-body mt-2 text-xs text-taupe">
              At least {MIN_PASSWORD_LENGTH} characters. We will email a
              one-time confirmation link.
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "signin" ? (
        <label className="flex cursor-pointer items-center gap-3 pt-1">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 accent-deep-lavender"
          />
          <span className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-taupe">
            Remember me
          </span>
        </label>
      ) : null}

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
        {submitLabel}
      </button>

      <div className="font-body space-y-2 text-xs text-taupe">
        {mode !== "signin" ? (
          <p>
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="text-ink underline"
            >
              Sign in with password
            </button>
          </p>
        ) : null}
        {mode !== "signup" ? (
          <p>
            New here?{" "}
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="text-ink underline"
            >
              Create an account
            </button>
          </p>
        ) : null}
        {mode === "signin" ? (
          <p>
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="text-ink underline"
            >
              Forgot password?
            </button>
            {" · "}
            <button
              type="button"
              onClick={() => switchMode("magic")}
              className="text-ink underline"
            >
              Email me a sign-in link
            </button>
          </p>
        ) : null}
        {footerLinks}
      </div>
    </form>
  );
}
