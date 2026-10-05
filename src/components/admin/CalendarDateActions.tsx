"use client";

import React, { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildDayTimeline,
  formatBlockRange,
  formatFullDate,
  formatMenuDate,
  formatMonthDay,
  listBlockTimeOptions,
  type AvailabilityBlock,
} from "@/lib/appointments/availability-blocks";
import { formatMinutesLabel } from "@/lib/appointments/closures";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";

export type DateMenuAction =
  | "book"
  | "block-time"
  | "block-all-day"
  | "view-day"
  | "manage";

const menuItemClass =
  "flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm text-text hover:bg-lavender-light";
const fieldClass =
  "mt-1 w-full rounded-xl border border-lavender/40 bg-white px-4 py-2.5 text-sm text-text";
const labelClass = "block text-sm font-medium text-text";

function useEscape(onClose: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
}

export function CalendarDateActionMenu({
  date,
  variant,
  top,
  left,
  hasBlocks,
  onClose,
  onAction,
}: {
  date: string;
  variant: "popover" | "sheet";
  top: number;
  left: number;
  hasBlocks: boolean;
  onClose: () => void;
  onAction: (action: DateMenuAction) => void;
}) {
  useEscape(onClose);
  const actions: Array<{ id: DateMenuAction; label: string }> = [
    { id: "book", label: "Book for Customer" },
    { id: "block-time", label: "Block Time" },
    { id: "block-all-day", label: "Block All Day" },
    { id: "view-day", label: "View Day" },
  ];
  if (hasBlocks) {
    actions.push({ id: "manage", label: "Manage Availability" });
  }

  const body = (
    <>
      <h3 className="text-base font-medium text-gold-dark">{formatMenuDate(date)}</h3>
      <div className="mt-2 grid gap-1">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            data-date-action={action.id}
            className={menuItemClass}
            onClick={() => onAction(action.id)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </>
  );

  const panel =
    variant === "sheet" ? (
      <div
        className="fixed inset-0 z-[80] flex items-end bg-ink/40"
        data-variant="sheet"
        data-date-actions
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-label="Date actions"
          className="w-full rounded-t-2xl border border-lavender/40 bg-cream px-4 pb-6 pt-3 shadow-sm"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-lavender" />
          {body}
        </div>
      </div>
    ) : (
      <div className="fixed inset-0 z-[80]" data-variant="popover" data-date-actions onClick={onClose}>
        <div
          role="menu"
          aria-label="Date actions"
          style={{ top, left, width: 260 }}
          className="absolute rounded-2xl border border-lavender/40 bg-cream p-3 shadow-sm"
          onClick={(event) => event.stopPropagation()}
        >
          {body}
        </div>
      </div>
    );

  if (typeof document === "undefined") return panel;
  return createPortal(panel, document.body);
}

function DialogFrame({
  title,
  titleId,
  onClose,
  children,
}: {
  title: string;
  titleId: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEscape(onClose);
  const panel = (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-lavender/40 bg-cream p-5 shadow-sm sm:max-w-md sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id={titleId} className="text-lg font-medium text-gold-dark">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
  if (typeof document === "undefined") return panel;
  return createPortal(panel, document.body);
}

export function BlockTimeDialog({
  date,
  block,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  date: string;
  block: AvailabilityBlock | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: {
    startMinutes: number;
    endMinutes: number;
    reason: string;
  }) => void;
}) {
  const titleId = useId();
  const options = listBlockTimeOptions();
  const [startMinutes, setStartMinutes] = useState(
    block?.startMinutes ?? 10 * 60,
  );
  const [endMinutes, setEndMinutes] = useState(block?.endMinutes ?? 14 * 60);
  const [reason, setReason] = useState(block?.reason ?? "");
  const endOptions = options.filter((minute) => minute > startMinutes);

  return (
    <DialogFrame
      title="Block Time"
      titleId={titleId}
      onClose={onClose}
    >
      <form
        className="mt-4 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ startMinutes, endMinutes, reason });
        }}
      >
        <div>
          <p className={labelClass}>Date</p>
          <p className="mt-1 text-sm text-text">{formatMonthDay(date)}</p>
        </div>
        <label className={labelClass}>
          Start Time
          <select
            className={fieldClass}
            value={startMinutes}
            onChange={(event) => {
              const next = Number(event.target.value);
              setStartMinutes(next);
              if (endMinutes <= next) {
                const later = options.find((minute) => minute > next);
                if (later != null) setEndMinutes(later);
              }
            }}
          >
            {options.slice(0, -1).map((minute) => (
              <option key={minute} value={minute}>
                {formatMinutesLabel(minute)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          End Time
          <select
            className={fieldClass}
            value={endMinutes}
            onChange={(event) => setEndMinutes(Number(event.target.value))}
          >
            {endOptions.map((minute) => (
              <option key={minute} value={minute}>
                {formatMinutesLabel(minute)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Reason (optional)
          <input
            className={fieldClass}
            value={reason}
            maxLength={160}
            placeholder="Personal, appointment, maintenance, etc."
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {error ? (
          <p className="text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="min-h-11 rounded-xl border border-lavender/40 px-4 text-sm text-text"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-xl bg-gold px-4 text-sm font-medium text-white hover:bg-gold-dark disabled:opacity-60"
          >
            {block ? "Save" : "Block Time"}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}

export function BlockAllDayDialog({
  date,
  block,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  date: string;
  block: AvailabilityBlock | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const titleId = useId();
  const [reason, setReason] = useState(block?.reason ?? "");
  return (
    <DialogFrame title="Block Entire Day?" titleId={titleId} onClose={onClose}>
      <form
        className="mt-4 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(reason);
        }}
      >
        <p className="text-sm text-text">
          Customers will not be able to book appointments on this date.
        </p>
        <p className="text-sm font-medium text-gold-dark">{formatFullDate(date)}</p>
        <label className={labelClass}>
          Reason (optional)
          <input
            className={fieldClass}
            value={reason}
            maxLength={160}
            placeholder="Personal, holiday, training, maintenance, etc."
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {error ? (
          <p className="text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="min-h-11 rounded-xl border border-lavender/40 px-4 text-sm text-text"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-xl bg-gold px-4 text-sm font-medium text-white hover:bg-gold-dark disabled:opacity-60"
          >
            {block ? "Save" : "Block All Day"}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}

export function ManageAvailabilityDialog({
  blocks,
  busyId,
  error,
  onClose,
  onEdit,
  onRemove,
}: {
  blocks: AvailabilityBlock[];
  busyId: string | null;
  error: string | null;
  onClose: () => void;
  onEdit: (block: AvailabilityBlock) => void;
  onRemove: (block: AvailabilityBlock) => void;
}) {
  const titleId = useId();
  return (
    <DialogFrame title="Manage Availability" titleId={titleId} onClose={onClose}>
      <ul className="mt-4 space-y-3">
        {blocks.map((block) => (
          <li
            key={block.id}
            className="rounded-xl border border-lavender/30 bg-white px-4 py-3"
          >
            <p className="text-sm font-medium text-gold-dark">
              {formatBlockRange(block)}
            </p>
            {block.reason ? (
              <p className="mt-1 text-sm text-text-muted">{block.reason}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-11 rounded-xl border border-lavender/40 px-4 text-sm text-text"
                onClick={() => onEdit(block)}
              >
                Edit
              </button>
              <button
                type="button"
                className="min-h-11 rounded-xl border border-lavender/40 px-4 text-sm text-text"
                disabled={busyId === block.id}
                onClick={() => onRemove(block)}
              >
                {busyId === block.id ? "Removing…" : "Remove"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="mt-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="mt-4 min-h-11 rounded-xl border border-lavender/40 px-4 text-sm text-text"
        onClick={onClose}
      >
        Cancel
      </button>
    </DialogFrame>
  );
}

export function ViewDayDialog({
  date,
  loading,
  appointments,
  blocks,
  onClose,
}: {
  date: string;
  loading: boolean;
  appointments: AdminAppointmentRecord[];
  blocks: AvailabilityBlock[];
  onClose: () => void;
}) {
  const titleId = useId();
  const timeline = buildDayTimeline({ appointments, blocks });
  return (
    <DialogFrame title={formatMonthDay(date)} titleId={titleId} onClose={onClose}>
      {loading ? (
        <p className="mt-4 text-sm text-text-muted">Loading this day…</p>
      ) : timeline.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">Nothing scheduled on this day.</p>
      ) : (
        <ol className="mt-4 space-y-4">
          {timeline.map((entry) => (
            <li key={`${entry.kind}-${entry.id}`}>
              <p className="text-sm font-medium text-gold-dark">{entry.timeLabel}</p>
              <p className="mt-1 text-sm text-text">{entry.title}</p>
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        className="mt-5 min-h-11 rounded-xl border border-lavender/40 px-4 text-sm text-text"
        onClick={onClose}
      >
        Close
      </button>
    </DialogFrame>
  );
}
