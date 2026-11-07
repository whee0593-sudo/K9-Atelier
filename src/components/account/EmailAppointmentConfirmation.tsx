"use client";

import { ConfirmAccountForm } from "./ConfirmAccountForm";
import React, { useEffect, useState } from "react";

export const EMAIL_CONFIRMATION_SUCCESS = "Your appointment is confirmed! See you soon.💜";

export function EmailAppointmentConfirmation({ token, preview = false }: { token: string; preview?: boolean }) {
  const [state, setState] = useState<"loading" | "confirmed" | "error" | "details">(preview ? "confirmed" : "loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (preview) return;
    let active = true;
    setState("loading");
    fetch("/api/confirm-account/appointment", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
    }).then(async (response) => {
      const body = await response.json();
      if (response.ok && body.needsAddress === true) { if (active) setState("details"); return; }
      if (!response.ok || body.confirmed !== true) throw new Error(body.error || "We could not confirm your appointment. Please try again.");
      if (active) setState("confirmed");
    }).catch((failure) => {
      if (!active) return;
      setError(failure instanceof Error ? failure.message : "We could not confirm your appointment. Please try again.");
      setState("error");
    });
    return () => { active = false; };
  }, [token, preview, attempt]);
  if (state === "details") return <div><h1 className="font-display text-3xl text-ink">Complete your appointment details</h1><ConfirmAccountForm token={token} /></div>;
  if (state === "confirmed") return <h1 className="font-display text-3xl leading-relaxed text-ink md:text-4xl" role="status">{EMAIL_CONFIRMATION_SUCCESS}</h1>;
  if (state === "loading") return <p role="status" className="font-body text-taupe">Confirming your appointment…</p>;
  return <div><p role="alert" className="font-body text-red-700">{error}</p><button type="button" className="mt-6 rounded-xl border border-gold px-6 py-3 text-gold-dark" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div>;
}
