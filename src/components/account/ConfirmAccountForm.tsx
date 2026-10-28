"use client";

import React, { useEffect, useState } from "react";
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

type Preview = {
  appointment: AppointmentRecord;
  appointments?: AppointmentRecord[];
  customer: { email: string; firstName: string };
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
    | { status: "done"; appointmentDate: string }
  >(
    preview
      ? { status: "ready", preview }
      : { status: "loading" },
  );
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loadState.status !== "ready") return;
    setError(null);
    const appointment = loadState.preview.appointment;

    const selectedPaymentMethodId = preferredPaymentMethodId(usableConfirmationCards(paymentMethods));
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
        setError("Please confirm this appointment and agree to the service policies.");
        return;
      }
      setLoadState({ status: "done", appointmentDate: appointment.appointmentDate });
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
        email?: string;
        signedInWithPassword?: boolean;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not confirm this appointment.");
      }

      setLoadState({ status: "done", appointmentDate: appointment.appointmentDate });
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
    return <AppointmentConfirmationSuccess appointmentDate={loadState.appointmentDate} />;
  }

  const { appointment, requiresPassword } = loadState.preview;
  const appointments = loadState.preview.appointments ?? [appointment];

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 space-y-5 text-left">
      <div className="border border-gray-line/80 bg-ivory p-6">
        <p className="font-body mt-2 text-sm text-taupe">
          {formatAppointmentDateLabel(appointment.appointmentDate)} ·{" "}
          {appointment.appointmentTime}
        </p>
        <p className="font-body mt-2 text-sm text-taupe">
          {appointment.addressStreet}, {appointment.addressCity},{" "}
          {appointment.addressState} {appointment.addressZip}
        </p>
        <ul className="mt-4 space-y-2">
          {appointments.map(pet => (
            <li key={pet.id} className="font-body text-sm text-ink">
              {pet.petName} - {pet.serviceName}
            </li>
          ))}
        </ul>
      </div>

      <ConfirmAccountPayment
        token={token}
        preview={Boolean(preview)}
        methods={paymentMethods}
        stripeConfigured={loadState.preview.stripeConfigured}
        onChange={(methods) => {
          setPaymentMethods(methods);
          if (methods.length > 0) setError(null);
        }}
      />

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

      <label className="font-body flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="mt-1"
          checked={acceptPolicies}
          onChange={(event) => setAcceptPolicies(event.target.checked)}
          required
        />
        I confirm this appointment and agree to K9 Atelier’s cancellation,
        payment, photo, and text-message policies.
      </label>

      {error ? (
        <p className="font-body text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={submitting || usableConfirmationCards(paymentMethods).length === 0} className={bookingPrimaryBtnClass}>
        {submitting ? "Confirming…" : "Confirm"}
      </button>
    </form>
  );
}

export function AppointmentConfirmationSuccess({ appointmentDate }: { appointmentDate: string }) {
  return <section className="mt-8 space-y-4 text-center" role="status">
    <h2 className="font-display text-3xl text-ink">Your appointment is confirmed.</h2>
    <p className="font-body text-base text-taupe">Thank you, see you on {formatAppointmentDateLabel(appointmentDate)}!</p>
  </section>;
}
