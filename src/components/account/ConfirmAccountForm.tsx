"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatAppointmentDateLabel } from "@/lib/email/html-templates";
import {
  bookingFieldClass,
  bookingLabelClass,
  bookingPrimaryBtnClass,
} from "@/components/booking/booking-ui";
import { ConfirmAccountPayment } from "@/components/account/ConfirmAccountPayment";
import type { AppointmentRecord } from "@/lib/appointments/types";
import type { PaymentMethodRecord } from "@/lib/payments/types";
import {
  preferredPaymentMethodId,
  usableConfirmationCards,
  SECURE_APPOINTMENT_CARD_MESSAGE,
} from "@/lib/staff/customer-confirm-status";

import { BookingPoliciesModal } from "@/components/booking/BookingPoliciesModal";

type Preview = {
  appointment: AppointmentRecord;
  appointments?: AppointmentRecord[];
  customer: { email: string; firstName: string; lastName?: string; phone?: string };
  requiresPassword: boolean;
  paymentMethods?: PaymentMethodRecord[];
  stripeConfigured?: boolean;
};

type Props = {
  token: string;
  preview?: Preview;
};

export function ConfirmAccountForm({ token, preview }: Props) {
  const [loadState, setLoadState] = useState<
    | { status: "loading" }
    | { status: "ready"; preview: Preview }
    | { status: "error"; message: string }
    | { status: "done"; appointmentDate: string; awaitingSmsConfirmation: boolean }
  >(
    preview
      ? { status: "ready", preview }
      : { status: "loading" },
  );
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const policiesButtonRef = useRef<HTMLButtonElement>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acceptPolicies, setAcceptPolicies] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRecord[]>(
    preview?.paymentMethods ?? [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/confirm-account?token=${encodeURIComponent(token)}`,
        );
        const body = (await response.json()) as Preview & { error?: string };
        if (cancelled) return;
        if (!response.ok || !body.appointment) {
          setLoadState({
            status: "error",
            message: body.error ?? "This confirmation link is not valid.",
          });
          return;
        }
        setPaymentMethods(body.paymentMethods ?? []);
        setLoadState({
          status: "ready",
          preview: {
            appointment: body.appointment,
            appointments: body.appointments,
            customer: body.customer,
            requiresPassword: body.requiresPassword,
            paymentMethods: body.paymentMethods ?? [],
            stripeConfigured: body.stripeConfigured,
          },
        });
      } catch {
        if (!cancelled) {
          setLoadState({
            status: "error",
            message: "This confirmation link is not valid.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preview, token]);

  async function handleSubmit(event?: React.FormEvent, savedMethod?: PaymentMethodRecord) {
    event?.preventDefault();
    if (loadState.status !== "ready") return;
    setError(null);
    const appointment = loadState.preview.appointment;

    const selectedPaymentMethodId = savedMethod?.id ?? preferredPaymentMethodId(usableConfirmationCards(paymentMethods));
    if (!selectedPaymentMethodId) {
      setError(SECURE_APPOINTMENT_CARD_MESSAGE);
      return;
    }

    if (preview) {
      if (loadState.preview.requiresPassword) {
        if (password.length < 8) {
          setError("Use at least 8 characters.");
          return;
        }
        if (password !== confirm) {
          setError("Passwords do not match.");
          return;
        }
      }
      if (!acceptPolicies) {
        setError("Please agree to the service policies.");
        return;
      }
      setLoadState({ status: "done", appointmentDate: appointment.appointmentDate, awaitingSmsConfirmation: false });
      return;
    }

    if (loadState.preview.requiresPassword) {
      if (password.length < 8) {
        setError("Use at least 8 characters.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/confirm-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: loadState.preview.requiresPassword ? password : null,
          acceptPolicies,
          paymentMethodId: selectedPaymentMethodId,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        appointment?: AppointmentRecord;
        email?: string;
        signedInWithPassword?: boolean;
      };
      if (!response.ok || body.appointment?.status !== "confirmed") {
        throw new Error(body.error ?? "Your card is saved, but this appointment could not be confirmed. Please try again or contact K9 Atelier.");
      }

      setLoadState({ status: "done", appointmentDate: appointment.appointmentDate, awaitingSmsConfirmation: body.appointment?.status !== "confirmed" });
      if (body.signedInWithPassword && body.email && password) {
        try {
          const supabase = createClient();
          await supabase.auth.signInWithPassword({ email: body.email, password });
        } catch (signInError) {
          console.error("Post-confirmation sign-in failed:", signInError);
        }
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not confirm this appointment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadState.status === "loading") {
    return <p className="font-body mt-6 text-sm text-taupe">Loading your appointment…</p>;
  }

  if (loadState.status === "error") {
    return (
      <div className="mt-6">
        <p className="font-body text-sm text-red-700" role="alert">
          {loadState.message}
        </p>
        <Link href="/login" className="font-body mt-6 inline-block text-sm text-ink underline">
          Sign in
        </Link>
      </div>
    );
  }

  if (loadState.status === "done") {
    return <AppointmentConfirmationSuccess appointmentDate={loadState.appointmentDate} awaitingSmsConfirmation={loadState.awaitingSmsConfirmation} />;
  }

  const { appointment, requiresPassword, customer } = loadState.preview;
  const appointments = loadState.preview.appointments ?? [appointment];

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 space-y-5 text-left">
      <div className="border border-gray-line/80 bg-ivory p-6">
        <p className="font-body text-sm text-ink">{[customer.firstName, customer.lastName].filter(Boolean).join(" ")}</p>
        <p className="font-body mt-2 text-sm text-taupe">{customer.email}</p>
        {customer.phone ? <p className="font-body mt-2 text-sm text-taupe">{customer.phone}</p> : null}
        <p className="font-body mt-2 text-sm text-taupe">
          {formatAppointmentDateLabel(appointment.appointmentDate)} ·{" "}
          {appointment.appointmentTime}
        </p>
        <p className="font-body mt-2 text-sm text-taupe">
          {appointment.addressStreet}, {appointment.addressCity}
        </p>
        <ul className="mt-4 space-y-2">
          {appointments.map(pet => (
            <li key={pet.id} className="font-body text-sm text-ink">
              {pet.petName} - {pet.serviceName}
              {pet.petBreed ? <span className="mt-1 block text-taupe">{pet.petBreed}{pet.petWeightLbs != null ? ` · ${pet.petWeightLbs} lbs` : ""}</span> : null}
            </li>
          ))}
        </ul>
      </div>



      {requiresPassword ? (
        <>
          <div>
            <label className={bookingLabelClass} htmlFor="confirm-password">
              Create a password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              className={bookingFieldClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <div>
            <label className={bookingLabelClass} htmlFor="confirm-password-again">
              Confirm password
            </label>
            <input
              id="confirm-password-again"
              type="password"
              autoComplete="new-password"
              minLength={8}
              className={bookingFieldClass}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </div>
        </>
      ) : null}

      <div className="font-body flex items-start gap-2 text-sm text-ink">
        <input
          id="confirm-account-policies"
          type="checkbox"
          className="mt-1 shrink-0"
          checked={acceptPolicies}
          onChange={(event) => setAcceptPolicies(event.target.checked)}
          required
        />
        <span>
          <label htmlFor="confirm-account-policies">I agree to K9 Atelier’s cancellation, payment, photo, and text-message policies.</label>{" "}
          <button ref={policiesButtonRef} type="button" onClick={() => setPoliciesOpen(true)} className="inline whitespace-nowrap text-sm text-ink underline underline-offset-4">View The Policies</button>
        </span>
      </div>
      <BookingPoliciesModal open={policiesOpen} onClose={() => setPoliciesOpen(false)} returnFocusRef={policiesButtonRef} includeConsentPolicies />

      <ConfirmAccountPayment
        token={token}
        preview={Boolean(preview)}
        methods={paymentMethods}
        stripeConfigured={loadState.preview.stripeConfigured}
        beforeSave={() => {
          if (requiresPassword && (password.length < 8 || password !== confirm)) {
            setError(password.length < 8 ? "Use at least 8 characters." : "Passwords do not match.");
            return false;
          }
          if (!acceptPolicies) {
            setError("Please agree to the service policies.");
            return false;
          }
          setError(null);
          return true;
        }}
        onSaved={(method) => void handleSubmit(undefined, method)}
        onChange={(methods) => {
          setPaymentMethods(methods);
          if (methods.length > 0) setError(null);
        }}
      />

      {error ? (
        <p className="font-body text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {usableConfirmationCards(paymentMethods).length > 0 ? <button type="submit" disabled={submitting} className={bookingPrimaryBtnClass}>
        {submitting ? "Saving & confirming…" : "Save & confirm appointment"}
      </button> : null}
    </form>
  );
}

export function AppointmentConfirmationSuccess({ appointmentDate, awaitingSmsConfirmation = false }: { appointmentDate: string; awaitingSmsConfirmation?: boolean }) {
  return <section className="mt-8 space-y-4 text-center" role="status">
    <h2 className="font-display text-3xl text-ink">{awaitingSmsConfirmation ? "Your account details are saved." : "Your appointment is confirmed."}</h2>
    <p className="font-body text-base text-taupe">{awaitingSmsConfirmation ? `Please reply C to our appointment text to confirm your visit on ${formatAppointmentDateLabel(appointmentDate)}.` : `Thank you, see you on ${formatAppointmentDateLabel(appointmentDate)}!`}</p>
  </section>;
}
