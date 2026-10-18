"use client";

import { useEffect, useRef, useState } from "react";
import { formatFixedCapPreview } from "@/lib/policy-fees/amounts";
import {
  NO_SHOW_CONTACT_CHANNELS,
  noShowBusinessInputToInstant,
  noShowInstantToBusinessInput,
} from "@/lib/policy-fees/no-show-evidence";

type Evidence = {
  id?: string;
  arrived_at?: string;
  contact_attempted_at?: string;
  contact_channel?: string;
  customer_replied?: boolean;
  handoff_arranged?: boolean;
  note?: string | null;
  status?: string;
  recorded_by?: string;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
};

export function NoShowEvidencePanel({
  appointmentId,
  preview = false,
  onReady,
}: {
  appointmentId: string;
  preview?: boolean;
  onReady: (charged: number) => void;
}) {
  const [visitId, setVisitId] = useState("");
  const [computed, setComputed] = useState(0);
  const [cap, setCap] = useState("");
  const [evidence, setEvidence] = useState<Evidence>({});
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    void fetch(`/api/admin/policy-fees?appointmentId=${appointmentId}`, {
      credentials: "include",
    })
      .then((response) => response.json())
      .then((body) => {
        if (cancelled) return;
        setVisitId(body.visitId ?? "");
        const charged = Number(body.noShow?.charged ?? 0);
        setComputed(Number(body.noShow?.computed ?? charged));
        if (body.noShow?.collectCap != null) setCap(String(body.noShow.collectCap));
        setEvidence(body.evidence ?? {});
        if (body.evidence?.status === "confirmed") onReadyRef.current(charged);
        if (body.noShow?.message) setMessage(body.noShow.message);
      })
      .catch(() => {
        if (!cancelled) setMessage("Could not load no-show evidence.");
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentId, preview]);

  const capNumber = cap.trim() === "" ? null : Number(cap);
  const priced = formatFixedCapPreview({
    computed,
    collectCap: capNumber != null && Number.isFinite(capNumber) ? capNumber : null,
  });

  async function save(confirm: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      if (priced && capNumber != null) {
        if (reason.trim().length < 3) {
          setMessage("Enter a reason for this fixed dollar cap.");
          setBusy(false);
          return;
        }
        const waiver = await fetch("/api/admin/policy-fees", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "authorize-waiver",
            visitId,
            appointmentId,
            feeAction: "no_show",
            idempotencyKey: `no_show:visit:${visitId}`,
            collectCap: capNumber,
            reason: reason.trim(),
          }),
        });
        if (!waiver.ok) {
          const body = (await waiver.json()) as { error?: string };
          setMessage(body.error ?? "Could not save the fixed cap.");
          return;
        }
      }
      const response = await fetch("/api/admin/policy-fees", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: confirm ? "confirm-no-show" : "save-no-show",
          visitId,
          arrivedAt: evidence.arrived_at,
          contactAttemptedAt: evidence.contact_attempted_at,
          contactChannel: evidence.contact_channel,
          customerReplied: Boolean(evidence.customer_replied),
          handoffArranged: Boolean(evidence.handoff_arranged),
          note: evidence.note ?? "",
        }),
      });
      const body = (await response.json()) as { error?: string; status?: string };
      if (!response.ok) {
        setMessage(body.error ?? "Could not save the evidence.");
        return;
      }
      setEvidence((current) => ({ ...current, status: body.status }));
      if (body.status === "confirmed") onReady(priced?.charged ?? computed);
      setMessage(body.status === "confirmed" ? "Evidence confirmed. You can charge next." : "Draft saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-lavender/40 bg-cream p-4">
      <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        No-show evidence
      </p>
      <p className="font-body mt-2 text-sm text-taupe">
        Confirming evidence does not charge the customer. A text already sent, or the appointment start time, is not enough. Times use Eastern Time.
      </p>
      <div className="mt-4 grid gap-3">
        <label className="text-sm">
          Arrived
          <input
            type="datetime-local"
            value={noShowInstantToBusinessInput(evidence.arrived_at)}
            onChange={(event) =>
              setEvidence((current) => ({
                ...current,
                arrived_at: noShowBusinessInputToInstant(event.target.value),
              }))
            }
            className="mt-1 w-full rounded-xl border border-lavender/40 bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Contact attempted
          <input
            type="datetime-local"
            value={noShowInstantToBusinessInput(evidence.contact_attempted_at)}
            onChange={(event) =>
              setEvidence((current) => ({
                ...current,
                contact_attempted_at: noShowBusinessInputToInstant(event.target.value),
              }))
            }
            className="mt-1 w-full rounded-xl border border-lavender/40 bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Contact channel
          <select
            value={evidence.contact_channel ?? ""}
            onChange={(event) =>
              setEvidence((current) => ({ ...current, contact_channel: event.target.value }))
            }
            className="mt-1 w-full rounded-xl border border-lavender/40 bg-white px-3 py-2"
          >
            <option value="">Choose</option>
            {NO_SHOW_CONTACT_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {channel.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(evidence.customer_replied)}
            onChange={(event) =>
              setEvidence((current) => ({ ...current, customer_replied: event.target.checked }))
            }
          />
          Customer replied
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(evidence.handoff_arranged)}
            onChange={(event) =>
              setEvidence((current) => ({ ...current, handoff_arranged: event.target.checked }))
            }
          />
          Handoff was arranged
        </label>
      </div>
      {priced ? (
        <div className="mt-4 text-sm">
          <p className="font-medium">{priced.heading}</p>
          <p className="text-taupe">{priced.note}</p>
          <p className="mt-2">Computed fee {priced.computedLabel}</p>
          <p>Cap {priced.capLabel}</p>
          <p>Amount to charge {priced.chargedLabel}</p>
          <p>Waived {priced.waiverLabel}</p>
          <label className="mt-3 block">
            Maximum amount to charge
            <input
              type="number"
              min="0"
              step="0.01"
              value={cap}
              onChange={(event) => setCap(event.target.value)}
              className="mt-1 w-full rounded-xl border border-lavender/40 bg-white px-3 py-2"
            />
          </label>
          <label className="mt-3 block">
            Reason for this cap
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 min-h-20 w-full rounded-xl border border-lavender/40 bg-white px-3 py-2"
            />
          </label>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm text-ink">{message}</p> : null}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy || preview}
          onClick={() => void save(false)}
          className="rounded-xl border border-lavender/40 px-4 py-2 text-sm"
        >
          Save draft
        </button>
        <button
          type="button"
          disabled={busy || preview}
          onClick={() => void save(true)}
          className="rounded-xl bg-deep-lavender px-4 py-2 text-sm text-ivory"
        >
          Confirm evidence
        </button>
      </div>
    </div>
  );
}

