"use client";

import { useState } from "react";
import { BookingPoliciesModal } from "@/components/booking/BookingPoliciesModal";

export default function BookingPoliciesPreviewPage() {
  const [open, setOpen] = useState(true);

  return (
    <div className="mx-auto w-full max-w-xl py-8 text-center">
      <p className="rounded-[8px] border border-[#B99A5E] bg-[#FFFDFC] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#766F75]">
        Preview only · booking policy window
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-body mt-8 text-sm text-ink underline"
      >
        View Service Policies
      </button>
      <BookingPoliciesModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
