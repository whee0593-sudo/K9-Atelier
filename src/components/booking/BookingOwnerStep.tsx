"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  bookingBackLinkClass,
  bookingFieldClass,
  bookingLabelClass,
  bookingNoticeClass,
  bookingPrimaryBtnClass,
} from "@/components/booking/booking-ui";
import type { BookingPolicySectionId } from "@/components/booking/BookingPoliciesModal";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/login-errors";
import { isValidSmsPhone } from "@/lib/sms/phone";
import {
  photoMarketingConsentCopy,
  smsConsentCopy,
} from "@/lib/notifications";
import {
  MIN_CUSTOMER_PASSWORD_LENGTH,
  formatMissingProfileFieldsMessage,
  missingCustomerProfileFieldLabels,
} from "@/lib/profiles/validation";

export type BookingOwnerDetails = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  smsConsent: boolean;
  photoMarketingConsent: boolean;
  servicePoliciesConsent: boolean;
};

type Props = {
  initial: BookingOwnerDetails;
  onBack: () => void;
  onOpenPolicy: (section: BookingPolicySectionId) => void;
  onComplete: (details: BookingOwnerDetails) => void;
};

function PolicyTermButton({
  children,
  onOpen,
}: {
  children: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      className="underline decoration-champagne underline-offset-2 hover:text-deep-lavender"
    >
      {children}
    </button>
  );
}

export function BookingOwnerStep({
  initial,
  onBack,
  onOpenPolicy,
  onComplete,
}: Props) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showSignIn, setShowSignIn] = useState(false);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [password, setPassword] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [smsConsent, setSmsConsent] = useState(initial.smsConsent);
  const [photoMarketingConsent, setPhotoMarketingConsent] = useState(
    initial.photoMarketingConsent,
  );
  const [servicePoliciesConsent, setServicePoliciesConsent] = useState(
    initial.servicePoliciesConsent,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (cancelled) return;
        setLoggedIn(Boolean(user));
        if (user) {
          setEmail(user.email ?? "");
          const { data } = await supabase
            .from("profiles")
            .select("phone, first_name, last_name")
            .maybeSingle();
          if (cancelled) return;
          if (data?.first_name) setFirstName((current) => current || data.first_name);
          if (data?.last_name) setLastName((current) => current || data.last_name);
          if (data?.phone) setPhone((current) => current || data.phone);
        }
        setCheckingSession(false);
      }).catch(() => {
        if (!cancelled) {
          setLoggedIn(false);
          setCheckingSession(false);
        }
      });
    } catch {
      setLoggedIn(false);
      setCheckingSession(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  async function persistLoggedInProfile() {
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        preferredContact: "Text Message",
        emergencyContactName: null,
        emergencyContactPhone: null,
        emergencyContactRelationship: null,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Could not save your details.");
    }
  }

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: signInPassword,
      });
      if (signInError) {
        setError(authErrorMessage(signInError.message));
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("phone, first_name, last_name, email")
        .maybeSingle();
      if (data?.first_name) setFirstName(data.first_name);
      if (data?.last_name) setLastName(data.last_name);
      if (data?.phone) setPhone(data.phone);
      setLoggedIn(true);
      setShowSignIn(false);
    } catch {
      setError("Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue(event: React.FormEvent) {
    event.preventDefault();
    const missing = missingCustomerProfileFieldLabels({
      firstName,
      lastName,
      phone,
      email: loggedIn ? undefined : email,
    });
    if (missing.length > 0) {
      setError(formatMissingProfileFieldsMessage(missing));
      return;
    }
    if (!isValidSmsPhone(phone)) {
      setError(
        "Please enter a valid US mobile number so we can text appointment updates.",
      );
      return;
    }
    if (!smsConsent) {
      setError("Please confirm you agree to receive appointment text messages.");
      return;
    }
    if (!photoMarketingConsent) {
      setError(
        "Please confirm you consent to photographing and filming your pet for marketing.",
      );
      return;
    }
    if (!servicePoliciesConsent) {
      setError(
        "Please confirm you have read and agree to the cancellation, rescheduling, payment, and incomplete service policies.",
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (!loggedIn) {
        if (password.length < MIN_CUSTOMER_PASSWORD_LENGTH) {
          setError(
            `Choose a login password of at least ${MIN_CUSTOMER_PASSWORD_LENGTH} characters.`,
          );
          setLoading(false);
          return;
        }
        const response = await fetch("/api/booking/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim(),
          }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error ?? "Could not create your account.");
        }
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) {
          throw new Error(authErrorMessage(signInError.message));
        }
      } else {
        await persistLoggedInProfile();
      }

      onComplete({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        smsConsent: true,
        photoMarketingConsent: true,
        servicePoliciesConsent: true,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save your details.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <p className="font-body mt-8 text-sm text-taupe">Preparing your details…</p>
    );
  }

  return (
    <section>
      <button type="button" onClick={onBack} className={bookingBackLinkClass}>
        ← Back
      </button>
      <p className="font-body mt-8 text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
        Your Details
      </p>
      <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
        How may we reach you?
      </h2>
      <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
        {loggedIn
          ? "Confirm the owner details we should keep on this household profile."
          : "These details create your K9 Atelier profile. Add a login password so you can return to manage this appointment."}
      </p>

      {!loggedIn ? (
        <div className={`${bookingNoticeClass} mt-6`}>
          {showSignIn ? (
            <form onSubmit={(event) => void handleSignIn(event)} className="space-y-4">
              <p className="font-body text-sm text-ink">
                Sign in to use an existing account.
              </p>
              <label className="block">
                <span className={bookingLabelClass}>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={bookingFieldClass}
                  required
                />
              </label>
              <label className="block">
                <span className={bookingLabelClass}>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={signInPassword}
                  onChange={(event) => setSignInPassword(event.target.value)}
                  className={bookingFieldClass}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className={bookingPrimaryBtnClass}
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => setShowSignIn(false)}
                className={`${bookingBackLinkClass} mt-2 block`}
              >
                New here? Create a profile instead
              </button>
            </form>
          ) : (
            <p className="font-body text-sm text-taupe">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setShowSignIn(true)}
                className="text-ink underline"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      ) : null}

      {(!showSignIn || loggedIn) && (
        <form onSubmit={(event) => void handleContinue(event)} className="mt-8 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className={bookingLabelClass}>First Name *</span>
              <input
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className={bookingFieldClass}
                required
              />
            </label>
            <label className="block">
              <span className={bookingLabelClass}>Last Name *</span>
              <input
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className={bookingFieldClass}
                required
              />
            </label>
          </div>
          <label className="block">
            <span className={bookingLabelClass}>Email *</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={bookingFieldClass}
              required
              readOnly={loggedIn}
            />
          </label>
          <label className="block">
            <span className={bookingLabelClass}>Mobile phone for appointment texts *</span>
            <input
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(561) 555-0123"
              className={bookingFieldClass}
              required
            />
          </label>
          {!loggedIn ? (
            <label className="block">
              <span className={bookingLabelClass}>Create a login password *</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={MIN_CUSTOMER_PASSWORD_LENGTH}
                className={bookingFieldClass}
                required
              />
              <span className="font-body mt-2 block text-[13px] leading-relaxed text-taupe">
                At least {MIN_CUSTOMER_PASSWORD_LENGTH} characters. Use this
                password to sign in and view this appointment later.
              </span>
            </label>
          ) : null}

          <label className="mt-3 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={smsConsent}
              onChange={(event) => setSmsConsent(event.target.checked)}
              required
              className="mt-0.5 size-4 shrink-0 accent-deep-lavender"
            />
            <span className="font-body min-w-0 text-[13px] leading-relaxed text-taupe">
              {smsConsentCopy} See our{" "}
              <Link href="/privacy" className="underline decoration-champagne underline-offset-2">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/terms" className="underline decoration-champagne underline-offset-2">
                Terms
              </Link>
              .
            </span>
          </label>
          <label className="mt-3 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={photoMarketingConsent}
              onChange={(event) => setPhotoMarketingConsent(event.target.checked)}
              required
              className="mt-0.5 size-4 shrink-0 accent-deep-lavender"
            />
            <span className="font-body min-w-0 text-[13px] leading-relaxed text-taupe">
              {photoMarketingConsentCopy}
            </span>
          </label>
          <label className="mt-3 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={servicePoliciesConsent}
              onChange={(event) => setServicePoliciesConsent(event.target.checked)}
              required
              className="mt-0.5 size-4 shrink-0 accent-deep-lavender"
            />
            <span className="font-body min-w-0 text-[13px] leading-relaxed text-taupe">
              I have read and agree to the{" "}
              <PolicyTermButton onOpen={() => onOpenPolicy("cancellation")}>
                cancellation
              </PolicyTermButton>
              ,{" "}
              <PolicyTermButton onOpen={() => onOpenPolicy("rescheduling")}>
                rescheduling
              </PolicyTermButton>
              ,{" "}
              <PolicyTermButton onOpen={() => onOpenPolicy("payment")}>
                payment
              </PolicyTermButton>
              , and{" "}
              <PolicyTermButton onOpen={() => onOpenPolicy("incomplete-service")}>
                incomplete service
              </PolicyTermButton>{" "}
              policies.
            </span>
          </label>

          {error ? (
            <p
              className="font-body rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className={`${bookingPrimaryBtnClass} mt-4`}
          >
            {loading ? "Saving…" : "Continue"}
          </button>
        </form>
      )}
    </section>
  );
}
