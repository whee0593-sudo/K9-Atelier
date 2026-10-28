"use client";
import React, { useReducer } from "react";
import Link from "next/link";
import { initialReceiptEmailState, receiptEmailAddress, receiptEmailReducer } from "@/lib/charges/receipt-recipient";

export function ChargeReceiptActions({ customerEmail, busy = false, sentTo = null, onSendEmail, doneHref = "/admin/appointments" }: {
  customerEmail?: string | null;
  busy?: boolean;
  sentTo?: string | null;
  onSendEmail?: (email: string) => void;
  doneHref?: string;
}) {
  const [state, dispatch] = useReducer(receiptEmailReducer, customerEmail, initialReceiptEmailState);
  const email = receiptEmailAddress(state.email);
  const sent = Boolean(email && sentTo === email);
  return <div className="mx-auto mt-8 w-full max-w-[560px] text-center">
    {onSendEmail ? <div className="mb-8">
      <p className="font-body text-sm leading-relaxed text-[#766F75]">Would you like a copy of this receipt by email?</p>
      <button type="button" disabled={busy || sent || state.editing || !email}
        onClick={() => { if (email && !state.editing) onSendEmail(email); }}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-[8px] border border-[#C4A882] bg-[#FFFDFC] px-6 text-[12px] font-medium uppercase tracking-[0.16em] text-[#2F2930] transition hover:bg-[#C4A882]/10 disabled:cursor-not-allowed disabled:opacity-50">
        {sent ? "Receipt sent" : busy ? "Sending…" : "Send receipt by email"}
      </button>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm text-[#766F75]">
        {state.editing ? <form className="flex w-full flex-wrap items-center gap-3" onSubmit={event => { event.preventDefault(); dispatch({type:"save"}); }}>
          <label className="sr-only" htmlFor="receipt-email">Receipt email address</label>
          <input id="receipt-email" type="email" autoComplete="email" required maxLength={254} value={state.draft}
            disabled={busy} onChange={event => dispatch({type:"change",value:event.target.value})}
            className="min-w-0 flex-1 rounded-lg border border-[#C4A882] bg-white px-3 py-2 text-base text-[#2F2930]" />
          <button type="submit" disabled={busy} className="min-h-11 px-3 font-medium underline">Save</button>
          <button type="button" disabled={busy} onClick={() => dispatch({type:"cancel"})} className="min-h-11 px-3 underline">Cancel</button>
        </form> : <>
          <span className="min-w-0 break-all">{state.email || "No email on file"}</span>
          <button type="button" disabled={busy} onClick={() => dispatch({type:"edit"})} className="min-h-11 underline">Use a different email</button>
        </>}
      </div>
      {state.error ? <p className="mt-2 text-sm text-red-800" role="alert">{state.error}</p> : null}
      {sent && !state.editing ? <p className="mt-2 text-sm text-[#766F75]" role="status">Sent to {email}</p> : null}
    </div> : null}
    <Link href={doneHref} className="font-body inline-flex min-h-11 items-center justify-center text-sm text-[#756578] underline underline-offset-4">Done</Link>
  </div>;
}
