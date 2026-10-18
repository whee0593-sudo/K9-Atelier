"use client";

import { useState } from "react";
import { formatFixedCapPreview } from "@/lib/policy-fees/amounts";
import { policyFeeIdempotencyKey } from "@/lib/policy-fees/keys";

export function VisitFeeControls({
  appointmentId,
  visitId,
  appointmentDate,
  scheduledStart,
}: {
  appointmentId: string;
  visitId: string | null;
  appointmentDate: string;
  scheduledStart: number | null;
}) {
  const [cap, setCap] = useState("");
  const [reason, setReason] = useState("");
  const [computed, setComputed] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [feeAction, setFeeAction] = useState<"cancel" | "remove_dog" | "reschedule">("cancel");
  const [toDate, setToDate] = useState("");
  const [toSlot, setToSlot] = useState("540");

  if (!visitId) return null;
  const capNumber = cap.trim() === "" ? null : Number(cap);
  const preview =
    computed == null
      ? null
      : formatFixedCapPreview({
          computed,
          collectCap: capNumber != null && Number.isFinite(capNumber) ? capNumber : null,
        });
  const idempotencyKey =
    feeAction === "remove_dog"
      ? policyFeeIdempotencyKey({
          action: "remove_dog",
          visitId,
          appointmentId,
        })
      : feeAction === "reschedule"
        ? policyFeeIdempotencyKey({
            action: "reschedule",
            visitId,
            fromDate: appointmentDate,
            fromSlot: scheduledStart,
            toDate,
            toSlot: Number(toSlot),
          })
        : policyFeeIdempotencyKey({
            action: "cancel",
            visitId,
          });

  async function loadPreview() {
    const response = await fetch(`/api/admin/policy-fees?appointmentId=${appointmentId}`, {
      credentials: "include",
    });
    const body = await response.json();
    const fee = feeAction === "remove_dog" ? body.removeFee : body.cancelFee;
    setComputed(Number(fee?.fee ?? 0));
  }

  async function authorize() {
    if (!preview || capNumber == null || reason.trim().length < 3) {
      setMessage("Enter a fixed dollar cap and a reason. This is not a percentage.");
      return;
    }
    const response = await fetch("/api/admin/policy-fees", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "authorize-waiver",
        visitId,
        appointmentId,
        feeAction,
        idempotencyKey,
        collectCap: capNumber,
        reason: reason.trim(),
      }),
    });
    const body = (await response.json()) as { error?: string };
    setMessage(
      response.ok
        ? "Fixed cap saved. The saved card will charge the preview amount."
        : body.error ?? "Could not save the cap.",
    );
  }

  return (
    <details className="mt-4 w-full rounded-2xl border border-lavender/40 bg-cream p-4">
      <summary className="cursor-pointer text-sm font-medium">Fee cap before the customer is charged</summary>
      <p className="mt-3 text-sm text-taupe">
        Fixed dollar cap for the next saved-card charge. This is not a percentage waiver. Date {appointmentDate}, start {scheduledStart ?? "unscheduled"}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => setFeeAction("cancel")}>
          Cancel visit
        </button>
        <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => setFeeAction("remove_dog")}>
          Remove this dog
        </button>
        <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => setFeeAction("reschedule")}>
          Reschedule
        </button>
        <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => void loadPreview()}>
          Preview
        </button>
      </div>
      <label className="mt-3 block text-sm">
        Reschedule target, if you are capping a specific move
        <input value={toDate} onChange={(event) => setToDate(event.target.value)} placeholder="YYYY-MM-DD" className="mt-1 w-full rounded-xl border px-3 py-2" />
      </label>
      <input value={toSlot} onChange={(event) => setToSlot(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2 text-sm" />
      {preview ? (
        <div className="mt-3 text-sm">
          <p className="font-medium">{preview.heading}</p>
          <p>{preview.note}</p>
          <p>Computed fee {preview.computedLabel}</p>
          <p>Cap {preview.capLabel}</p>
          <p>Amount to charge {preview.chargedLabel}</p>
          <p>Waived {preview.waiverLabel}</p>
        </div>
      ) : null}
      <label className="mt-3 block text-sm">
        Maximum amount to charge
        <input type="number" min="0" step="0.01" value={cap} onChange={(event) => setCap(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      </label>
      <label className="mt-3 block text-sm">
        Reason
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border px-3 py-2" />
      </label>
      <button type="button" onClick={() => void authorize()} className="mt-3 rounded-xl bg-deep-lavender px-4 py-2 text-sm text-ivory">
        Save fixed cap
      </button>
      {message ? <p className="mt-2 text-sm">{message}</p> : null}
    </details>
  );
}
