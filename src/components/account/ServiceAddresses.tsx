"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExpandableCard } from "@/components/account/ExpandableCard";
import type { SavedServiceAddress } from "@/lib/profiles/customer-addresses";
import type { ServiceAddress } from "@/lib/travel";

export function AddressCard({ initial, onSaved, onDeleted }: {
  initial: SavedServiceAddress;
  onSaved: (address: SavedServiceAddress) => void;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState<ServiceAddress>(initial);
  const [open, setOpen] = useState(!initial.id);
  const [pending, setPending] = useState<"save" | "delete" | null>(null);
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function save() {
    if (busy.current) return;
    const snapshot = { street: draft.street.trim(), city: draft.city.trim(), state: draft.state.trim(), zip: draft.zip.trim() };
    if (!Object.values(snapshot).every(Boolean)) {
      setError("Complete the address to save it.");
      return;
    }
    busy.current = true;
    setPending("save");
    setError(null);
    try {
        const response = await fetch("/api/account/addresses", {
          method: initial.id ? "PATCH" : "POST", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...snapshot, ...(initial.id ? { id: initial.id } : {}) }),
        });
        const body = await response.json();
        if (!response.ok || !body.address) throw new Error(body.error ?? "Could not save your address.");
        setDraft(body.address);
        onSaved(body.address);
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save your address.");
      } finally {
        busy.current = false;
        setPending(null);
      }
  }

  async function remove() {
    if (busy.current) return;
    if (!initial.id) return;
    busy.current = true;
    setPending("delete");
    setError(null);
    try {
      const response = await fetch("/api/account/addresses", {
        method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: initial.id }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Could not delete this address.");
      onDeleted();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete this address.");
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  return <ExpandableCard open={open} onOpenChange={setOpen} disabled={pending != null} summary={<>
    <span className="block font-medium">{draft.street || "New address"}</span>
    <span className="block">{[draft.city, draft.state, draft.zip].filter(Boolean).join(", ")}</span>
  </>}>
    <form onSubmit={e => { e.preventDefault(); void save(); }} noValidate>
      <fieldset disabled={pending != null} className="space-y-4 disabled:opacity-60">
      {([['street', 'Street Address'], ['city', 'City'], ['state', 'State'], ['zip', 'ZIP Code']] as const).map(([key, label]) => <label key={key} className="block text-sm font-medium text-text">
        {label}<input required autoComplete={{ street: "street-address", city: "address-level2", state: "address-level1", zip: "postal-code" }[key]}
          maxLength={{street:200,city:120,state:40,zip:20}[key]} value={draft[key]}
          onChange={e => setDraft(current => ({ ...current, [key]: e.target.value }))}
          className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm" />
      </label>)}
      {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
      <div className="flex items-center justify-between gap-4 pt-2">
        <button type="submit" className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white transition hover:bg-gold-dark">{pending === "save" ? "Saving…" : "Save"}</button>
        {initial.id ? <button type="button" onClick={() => void remove()} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60">{pending === "delete" ? "Deleting…" : "Delete this address"}</button> : null}
      </div>
      </fieldset>
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
    {addresses.map(address => <AddressCard key={address.key} initial={address}
      onSaved={saved => setAddresses(current => current.map(a => a.key === address.key ? { ...saved, key: a.key } : a))}
      onDeleted={() => setAddresses(current => current.filter(a => a.key !== address.key))} />)}
    <button type="button" className="rounded-xl border border-dashed border-gold/50 px-4 py-2 text-sm text-gold-dark"
      onClick={() => setAddresses(current => [...current, { key: crypto.randomUUID(), id: "", street: "", city: "", state: "FL", zip: "" }])}>
      Add another address
    </button>
  </div>;
}
