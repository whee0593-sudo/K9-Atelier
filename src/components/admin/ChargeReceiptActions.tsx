"use client";

import Link from "next/link";

export function ChargeReceiptActions({
  customerEmail,
  busy = false,
  sent = false,
  onSendEmail,
  doneHref = "/admin/appointments",
}: {
  customerEmail?: string | null;
  busy?: boolean;
  sent?: boolean;
  onSendEmail?: () => void;
  doneHref?: string;
}) {
  const hasEmail = Boolean(customerEmail?.trim());

  return (
    <div className="mx-auto mt-8 w-full max-w-[560px] text-center">
      {onSendEmail ? (
        <div className="mb-8">
          <p className="font-body text-sm leading-relaxed text-[#766F75]">
            Would you like a copy of this receipt by email?
          </p>
          <button
            type="button"
            disabled={busy || sent || !hasEmail}
            onClick={onSendEmail}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-[8px] border border-[#C4A882] bg-[#FFFDFC] px-6 text-[12px] font-medium uppercase tracking-[0.16em] text-[#2F2930] transition hover:bg-[#C4A882]/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sent
              ? "Receipt sent"
              : busy
                ? "Sending…"
                : "Send receipt by email"}
          </button>
          {!hasEmail ? (
            <p className="font-body mt-3 text-xs text-[#9A3D3D]">
              Add an email to the customer profile to send a receipt.
            </p>
          ) : sent ? (
            <p className="font-body mt-3 text-xs text-[#766F75]">
              Sent to {customerEmail}
            </p>
          ) : (
            <p className="font-body mt-3 text-xs text-[#766F75]">
              {customerEmail}
            </p>
          )}
        </div>
      ) : null}
      <Link
        href={doneHref}
        className="font-body inline-flex min-h-11 items-center justify-center text-sm text-[#756578] underline decoration-[#756578]/40 underline-offset-4 hover:text-[#635366] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#756578]/40 focus-visible:ring-offset-2"
      >
        Done
      </Link>
    </div>
  );
}
