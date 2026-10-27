"use client";
import React, { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function CallRequestActions({ id, contacted, linked, canLink }: { id: string; contacted: boolean; linked: boolean; canLink: boolean }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [email, setEmail] = useState("");
  async function update(body: Record<string, string>) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/call-requests/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Please try again.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { setBusy(false); }
  }
  function link(event: FormEvent) { event.preventDefault(); void update({ action: "link", customerEmail: email }); }
  return <div className="mt-5 space-y-4">
    {!contacted && <button type="button" disabled={busy} onClick={() => void update({ action: "contacted" })} className="min-h-11 rounded-sm border border-gray-line px-4 text-sm text-ink">Mark as contacted</button>}
    {canLink && !linked && <details className="border-t border-gray-line pt-3">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm text-deep-lavender">Link card to a customer profile</summary>
      <form onSubmit={link} className="mt-3 space-y-3">
        <p className="text-sm text-ink">After the call, create or complete the customer profile in Customers &amp; Pets. Enter that profile’s email to link this saved card. This does not create an appointment.</p>
        <label htmlFor={`link-${id}`} className="block text-sm text-ink">Customer email</label>
        <input id={`link-${id}`} type="email" required value={email} onChange={e => setEmail(e.target.value)} className="min-h-11 w-full rounded-sm border border-gray-line bg-ivory px-3 text-base text-ink" />
        <button disabled={busy} className="min-h-11 rounded-sm bg-deep-lavender px-4 text-sm text-ivory">Link saved card</button>
      </form>
    </details>}
    {linked && <p className="text-sm text-ink">Card linked to customer profile.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
