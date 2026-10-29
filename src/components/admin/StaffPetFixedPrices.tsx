"use client";
import React, { useState } from "react";
import { fixedPriceServices, validFixedAmount, type FixedServicePrices } from "@/lib/pets/fixed-prices";
import { getServiceDisplayName } from "@/lib/service-display";
import { formatChargeMoney } from "@/lib/charges/money";

export function StaffPetFixedPrices({ customerId, petId, prices = {}, preview = false, onSaved }: {
  customerId:string; petId:string; prices?:FixedServicePrices; preview?:boolean;
  onSaved:(prices:FixedServicePrices)=>void;
}) {
  const services=fixedPriceServices();
  const [serviceId,setServiceId]=useState(Object.keys(prices)[0] ?? services[0]?.id ?? "");
  const [amount,setAmount]=useState(prices[serviceId] == null ? "" : String(prices[serviceId]));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  async function save(useStandard=false) {
    const value=useStandard ? null : amount.trim() ? Number(amount) : NaN;
    if (!serviceId || (value !== null && !validFixedAmount(value))) {setError("Enter a price from $0 to $5,000, with at most two decimal places.");return;}
    setBusy(true);setError(null);setNotice(null);
    try {
      let next={...prices};
      if (value === null) delete next[serviceId]; else next[serviceId]=value;
      if (!preview) {
        const response=await fetch('/api/admin/customers/'+customerId+'/pets/'+petId+'/prices',{
          method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({serviceId,amount:value}),
        });
        const body=await response.json();
        if(!response.ok) {setError(body.error ?? "Could not save this price.");return;}
        next=body.fixedServicePrices;
      }
      onSaved(next);setAmount(value === null ? "" : String(value));
      setNotice(value === null ? "Standard pricing restored for future bookings." : "Fixed price saved for future bookings.");
    } catch {setError("Could not save this price.");} finally {setBusy(false);}
  }
  return <section className="border-t border-lavender/30 px-4 py-5 text-left" aria-label="Fixed service prices">
    <h4 className="font-medium text-text">Fixed service prices</h4>
    {Object.entries(prices).length ? <ul className="mt-3 space-y-1 text-sm">{Object.entries(prices).map(([id,price])=><li key={id}>{getServiceDisplayName(id,id)} · {formatChargeMoney(price)}</li>)}</ul> : <p className="mt-3 text-sm text-text-muted">Standard pricing</p>}
    <fieldset disabled={busy} className="mt-4 space-y-3">
      <label className="block text-sm">Service<select value={serviceId} onChange={event=>{const id=event.target.value;setServiceId(id);setAmount(prices[id] == null ? "" : String(prices[id]));setError(null);setNotice(null);}}
        className="mt-1 w-full rounded-xl border border-lavender/40 bg-white px-3 py-2">{services.map(service=><option key={service.id} value={service.id}>{getServiceDisplayName(service.id,service.name)}</option>)}</select></label>
      <label className="block text-sm">Fixed price ($)<input type="number" min="0" max="5000" step="0.01" inputMode="decimal" value={amount} onChange={event=>{setAmount(event.target.value);setNotice(null);}}
        className="mt-1 w-full rounded-xl border border-lavender/40 bg-white px-3 py-2" /></label>
      <div className="flex flex-wrap gap-3"><button type="button" onClick={()=>void save()} className="rounded-xl bg-gold px-4 py-2 text-sm text-white">{busy ? "Saving…" : "Save fixed price"}</button>
        <button type="button" onClick={()=>void save(true)} className="px-3 py-2 text-sm underline">Use standard pricing</button></div>
    </fieldset>
    {error ? <p role="alert" className="mt-3 text-sm text-red-800">{error}</p> : null}
    {notice ? <p role="status" className="mt-3 text-sm text-text-muted">{notice}</p> : null}
  </section>;
}
