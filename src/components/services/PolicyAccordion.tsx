"use client";

import { useId, useState, type ReactNode } from "react";

type Props = {
  title: string;
  summary?: string;
  children: ReactNode;
};

export function PolicyAccordion({ title, summary, children }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const label = open ? `Hide ${title} details` : `View ${title} details`;

  return (
    <article className="border border-gray-line/80 bg-ivory">
      <h3 className="m-0">
        <button
          type="button"
          className="flex w-full min-h-[56px] items-start justify-between gap-4 px-5 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={label}
          onClick={() => setOpen((value) => !value)}
        >
          <span>
            <span className="font-display text-xl text-ink">{title}</span>
            {summary && <span className="font-body mt-1 block text-base font-normal text-ink">
              {summary}
            </span>}
          </span>
          <span aria-hidden="true" className="font-body shrink-0 text-xl text-deep-lavender">
            {open ? "−" : "+"}
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden" inert={!open || undefined}>
          <div className="border-t border-gray-line/70 px-5 py-5">{children}</div>
        </div>
      </div>
    </article>
  );
}
