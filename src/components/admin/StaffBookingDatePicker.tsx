"use client";

import React, { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { AdminCalendarMonthGrid } from "@/components/admin/AdminCalendarMonthGrid";
import type { AdminCalendarDay } from "@/lib/appointments/calendar";
import {
  buildEmptyOccupancyMonth,
  calendarMonthFromDate,
  currentBusinessCalendarMonth,
  shiftCalendarMonth,
} from "@/lib/appointments/calendar-month";
import { buildPreviewCalendarMonth } from "@/lib/appointments/calendar-preview";
import { todayInBusinessTimezone } from "@/lib/sms/schedule";
import { formatStaffDateOption } from "@/lib/staff/book-for-customer-schedule";

function monthForPicker(value: string, openDates: string[]) {
  if (value) return calendarMonthFromDate(value);
  if (openDates[0]) return calendarMonthFromDate(openDates[0]!);
  return currentBusinessCalendarMonth();
}

export function StaffBookingDatePicker({
  id = "appointment-date",
  value,
  onChange,
  openDates,
  disabled = false,
  preview = false,
  defaultOpen = false,
}: {
  id?: string;
  value: string;
  onChange: (date: string) => void;
  openDates: string[];
  disabled?: boolean;
  preview?: boolean;
  defaultOpen?: boolean;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const [month, setMonth] = useState(() => monthForPicker(value, openDates));
  const [days, setDays] = useState<AdminCalendarDay[]>(() =>
    preview
      ? buildPreviewCalendarMonth(monthForPicker(value, openDates)).days
      : buildEmptyOccupancyMonth(
          monthForPicker(value, openDates),
          todayInBusinessTimezone(),
        ),
  );
  const [occupancyLoading, setOccupancyLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadMonth = useCallback(
    async (nextMonth: string) => {
      setOccupancyLoading(true);
      if (preview) {
        setDays(buildPreviewCalendarMonth(nextMonth).days);
        setOccupancyLoading(false);
        return;
      }
      try {
        const response = await fetch(`/api/admin/calendar?month=${nextMonth}`, {
          credentials: "include",
        });
        const body = (await response.json()) as {
          error?: string;
          days?: AdminCalendarDay[];
        };
        if (!response.ok || !body.days) {
          setDays(buildEmptyOccupancyMonth(nextMonth, todayInBusinessTimezone()));
          return;
        }
        setDays(body.days);
      } catch {
        setDays(buildEmptyOccupancyMonth(nextMonth, todayInBusinessTimezone()));
      } finally {
        setOccupancyLoading(false);
      }
    },
    [preview],
  );

  useEffect(() => {
    if (!open) return;
    void loadMonth(month);
  }, [loadMonth, month, open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function openPicker() {
    if (disabled) return;
    setMonth(monthForPicker(value, openDates));
    setOpen(true);
  }

  const overlay = open ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 p-4"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="pointer-events-auto relative z-[101] max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-lavender/30 bg-cream p-6 shadow-sm"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id={titleId} className="text-lg font-medium text-gold-dark">
              Choose a date
            </h3>
          </div>
          <button
            type="button"
            className="rounded-xl border border-lavender/40 px-3 py-1.5 text-sm text-text-muted hover:text-text"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>

        <div className="mt-4">
          <AdminCalendarMonthGrid
            month={month}
            days={days}
            selectedDate={value || null}
            loading={occupancyLoading && days.length === 0}
            onPrevMonth={() =>
              setMonth((current) => shiftCalendarMonth(current, -1))
            }
            onNextMonth={() =>
              setMonth((current) => shiftCalendarMonth(current, 1))
            }
            onSelectDate={(date) => {
              onChange(date);
              setOpen(false);
            }}
          />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div>
      <button
        type="button"
        id={id}
        className="mt-1 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-left text-sm text-text disabled:opacity-60"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPicker}
      >
        {value ? formatStaffDateOption(value) : "Select a date"}
      </button>
      <input
        tabIndex={-1}
        required
        value={value}
        onChange={() => {}}
        className="sr-only"
        aria-hidden="true"
      />

      {mounted && overlay ? createPortal(overlay, document.body) : overlay}
    </div>
  );
}
