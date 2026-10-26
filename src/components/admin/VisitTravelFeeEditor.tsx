"use client";

import React, { useEffect, useState } from "react";
import { TravelFeeControl } from "@/components/admin/TravelFeeControl";
import { formatPrice } from "@/lib/business";
import { parseTravelFeeOverride } from "@/lib/visits/travel-fee";

export function VisitTravelFeeEditor({ appointmentId, preview = false, onSaved }: {
  appointmentId: string; preview?: boolean; onSaved?: () => void;
}) {
  const [data, setData] = useState<{ automatic: number; effective: number; override: number | null } | null>(null);
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const url = `/api/admin/appointments/${appointmentId}/travel-fee`;
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    setData(null);
    setMessage("");
    void fetch(url, { credentials: "include", signal: controller.signal }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load travel fee.");
      setData(body);
      setValue(body.override == null ? null : String(body.override));
    }).catch((error) => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, [url, preview]);

  async function save(restore = false) {
    setMessage("");
    let override: number | null;
    try {
      if (!restore && value === "") throw new Error("Enter a travel fee or restore automatic calculation.");
      override = parseTravelFeeOverride(restore || value === null ? null : Number(value));
    } catch (error) { setMessage((error as Error).message); return; }
    setBusy(true);
    try {
      const response = await fetch(url, { method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ override }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not save travel fee.");
      setData(body);
      setValue(body.override == null ? null : String(body.override));
      setMessage("Visit travel fee saved.");
      onSaved?.();
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  if (preview) return <p className="mt-3 text-sm">Travel fee editing is available on saved visits.</p>;
  return <div className="mt-3">
    {data ? <>
      <p className="text-sm">Saved visit travel fee: {formatPrice(data.effective)}</p>
      <TravelFeeControl automatic={data.automatic} value={value} onChange={setValue} onRestore={() => void save(true)} disabled={busy} />
      <button type="button" disabled={busy} onClick={() => void save()} className="mt-2 rounded-lg border px-4 py-2 text-sm">
        {busy ? "Saving…" : "Save visit travel fee"}
      </button>
    </> : !message ? <p className="text-sm">Loading visit travel fee…</p> : null}
    {message ? <p className="mt-2 text-sm" role="status">{message}</p> : null}
  </div>;
}
