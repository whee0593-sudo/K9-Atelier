"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  hasConcernBeenSubmitted,
  markConcernSubmitted,
  readConcernContext,
} from "@/lib/support-concern";

function inputClassName() {
  return "mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-base text-text placeholder:text-text-muted/50 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20";
}

export function SupportContactForm({
  variant = "default",
}: {
  variant?: "default" | "concern";
}) {
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sending, setSending] = useState(false);
  const [chargeId, setChargeId] = useState<string | undefined>();
  const [appointmentId, setAppointmentId] = useState<string | undefined>();
  const alreadySubmitted = useMemo(
    () => hasConcernBeenSubmitted(chargeId),
    [chargeId, success],
  );

  useEffect(() => {
    const context = readConcernContext();
    setAppointmentId(context?.appointmentId);
    setChargeId(context?.chargeId);
    if (hasConcernBeenSubmitted(context?.chargeId)) {
      setSuccess(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending || success || alreadySubmitted) return;
    setError(null);
    setSending(true);

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact,
          message,
          topic: variant === "concern" ? "concern" : undefined,
          appointmentId,
          chargeId,
        }),
      });

      const data = (await res.json()) as { error?: string; ok?: boolean };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
      markConcernSubmitted(chargeId);
      setContact("");
      setMessage("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (success || alreadySubmitted) {
    return (
      <div className="mt-10 text-left">
        <p
          className="rounded-xl border border-lavender/40 bg-lavender-light/30 px-4 py-3 text-base text-gold-dark"
          role="status"
        >
          Thank you — your message has been sent. We&apos;ll get back to you soon.
        </p>
        <Link
          href="/"
          className="mt-6 block text-center text-sm text-gold-dark underline"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 space-y-6 text-left">
      <div>
        <label htmlFor="support-contact" className="block text-sm font-medium text-text">
          Email or phone number
          <span className="text-gold"> *</span>
        </label>
        <input
          id="support-contact"
          type="text"
          required
          autoComplete="email tel"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="you@example.com or (561) 555-0123"
          className={inputClassName()}
        />
      </div>

      <div>
        <label htmlFor="support-message" className="block text-sm font-medium text-text">
          Your message
          <span className="text-gold"> *</span>
        </label>
        <textarea
          id="support-message"
          required
          rows={8}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            variant === "concern"
              ? "PLEASE TELL US WHAT HAPPENED AND WE WILL GET BACK TO YOU SOON"
              : "Tell us about your dog, your question, or how we can help…"
          }
          className={`${inputClassName()} resize-y min-h-[10rem]`}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="w-full min-h-11 rounded-2xl bg-gold px-8 py-4 text-lg font-medium text-white transition hover:bg-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sending ? "Sending…" : "Send message"}
      </button>

      <Link href="/" className="block text-center text-sm text-gold-dark underline">
        Back to Home
      </Link>
    </form>
  );
}
