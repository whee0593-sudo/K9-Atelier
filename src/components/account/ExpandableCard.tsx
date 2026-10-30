"use client";

import React, { useId, useState } from "react";

export function ExpandableCard({ summary, children, initiallyOpen = false, open: controlledOpen, onOpenChange, disabled = false }: {
  summary: React.ReactNode; children: React.ReactNode; initiallyOpen?: boolean;
  open?: boolean; onOpenChange?: (open: boolean) => void; disabled?: boolean;
}) {
  const [localOpen, setLocalOpen] = useState(initiallyOpen);
  const open = controlledOpen ?? localOpen;
  const id = useId();
  return <div className="rounded-2xl border border-lavender/40 bg-lavender-light/40">
    <button type="button" aria-expanded={open} aria-controls={id} disabled={disabled}
      onClick={() => { setLocalOpen(!open); onOpenChange?.(!open); }}
      className="flex w-full items-center justify-between gap-4 rounded-2xl p-5 text-left text-sm text-text focus-visible:outline-2 focus-visible:outline-gold">
      <span className="min-w-0 space-y-1 break-words">{summary}</span>
      <span aria-hidden="true">{open ? "−" : "+"}</span>
    </button>
    <div id={id} hidden={!open} className="border-t border-lavender/30 p-5">{children}</div>
  </div>;
}
