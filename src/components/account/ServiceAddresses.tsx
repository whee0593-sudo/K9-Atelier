"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExpandableCard } from "@/components/account/ExpandableCard";
import type { SavedServiceAddress } from "@/lib/profiles/customer-addresses";
import type { ServiceAddress } from "@/lib/travel";

function AddressCard({ initial, onSaved }: { initial: SavedServiceAddress; onSaved: (address: SavedServiceAddress) => void }) {
  const [draft, setDraft] = useState<ServiceAddress>(initial);
  const id = useRef(initial.id);
  const baseline = useRef(JSON.stringify({street:initial.street.trim(),city:initial.city.trim(),state:initial.state.trim(),zip:initial.zip.trim()}));
  const queue = useRef(Promise.resolve());
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function save() {
    const snapshot = { street: draft.street.trim(), city: draft.city.trim(), state: draft.state.trim(), zip: draft.zip.trim() };
    if (!Object.values(snapshot).every(Boolean)) {
      setStatus("Complete the address to save it.");
      return;
    }
    queue.current = queue.current.then(async () => {
      if (baseline.current === JSON.stringify(snapshot)) return;
      setStatus("Saving…");
      setError(null);
      try {
        const response = await fetch("/api/account/addresses", {
          method: id.current ? "PATCH" : "POST", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...snapshot, ...(id.current ? { id: id.current } : {}) }),
        });
        const body = await response.json();
        if (!response.ok || !body.address) throw new Error(body.error ?? "Could not save your address.");
        id.current = body.address.id;
        baseline.current = JSON.stringify(snapshot);
        onSaved(body.address);
        setStatus("Saved");
        router.refresh();
      } catch (e) {
        setStatus("");
        setError(e instanceof Error ? e.message : "Could not save your address.");
      }
    });
  }

  return <ExpandableCard initiallyOpen={!initial.id} summary={<>
    <span className="block font-medium">{draft.street || "New address"}</span>
    <span className="block">{[draft.city, draft.state, draft.zip].filter(Boolean).join(", ")}</span>
  </>}>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); save(); }} onBlur={e => {
      if (e.target instanceof HTMLInputElement) save();
    }}>
      {([['street', 'Street Address'], ['city', 'City'], ['state', 'State'], ['zip', 'ZIP Code']] as const).map(([key, label]) => <label key={key} className="block text-sm font-medium text-text">
        {label}<input required autoComplete={{ street: "street-address", city: "address-level2", state: "address-level1", zip: "postal-code" }[key]}
          maxLength={{street:200,city:120,state:40,zip:20}[key]} value={draft[key]}
          onChange={e => { setDraft(current => ({ ...current, [key]: e.target.value })); setStatus("Unsaved changes"); }}
          className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm" />
      </label>)}
      <p aria-live="polite" className="text-xs text-text-muted">{status}</p>
      {error ? <div role="alert" className="text-sm text-red-800">{error} <button type="submit" className="underline">Retry save</button></div> : null}
    </form>
  </ExpandableCard>;
}

export function ServiceAddresses() {
  const [addresses, setAddresses] = useState<Array<SavedServiceAddress & { key: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/account/addresses", { credentials: "include" }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load your address book.");
      if (active) setAddresses(body.addresses.map((a: SavedServiceAddress) => ({ ...a, key: a.id })));
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (loading) return <p className="text-sm text-text-muted">Loading your address book…</p>;
  if (error) return <p role="alert">{error}</p>;
  return <div className="space-y-4">
    {!addresses.length ? <p className="text-sm text-text-muted">No saved addresses yet.</p> : null}
    {addresses.map(address => <AddressCard key={address.key} initial={address} onSaved={saved => setAddresses(current => current.map(a => a.key === address.key ? { ...saved, key: a.key } : a))} />)}
    <button type="button" className="rounded-xl border border-dashed border-gold/50 px-4 py-2 text-sm text-gold-dark"
      onClick={() => setAddresses(current => [...current, { key: crypto.randomUUID(), id: "", street: "", city: "", state: "FL", zip: "" }])}>
      Add another address
    </button>
  </div>;
}
