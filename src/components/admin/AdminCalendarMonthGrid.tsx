"use client";

import React from "react";
import type { AdminCalendarDay } from "@/lib/appointments/calendar";
import {
  ADMIN_CALENDAR_WEEKDAYS,
  adminCalendarDayButtonClass,
  calendarMonthLeadingBlanks,
  formatCalendarMonthLabel,
} from "@/lib/appointments/calendar-month";

export function AdminCalendarMonthGrid({
  month,
  days,
  selectedDate,
  loading = false,
  selectableDates,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
}: {
  month: string;
  days: AdminCalendarDay[];
  selectedDate: string | null;
  loading?: boolean;
  selectableDates?: ReadonlySet<string>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: string) => void;
}) {
  const leadingBlanks = calendarMonthLeadingBlanks(days);

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          className="rounded-xl border border-lavender/40 px-3 py-1.5 text-sm text-text"
        >
          Previous
        </button>
        <p className="text-sm font-medium text-gold-dark">
          {formatCalendarMonthLabel(month)}
        </p>
        <button
          type="button"
          onClick={onNextMonth}
          className="rounded-xl border border-lavender/40 px-3 py-1.5 text-sm text-text"
        >
          Next
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-lavender/30 bg-cream">
        <div className="grid grid-cols-7 border-b border-lavender/20 bg-lavender-light/40 text-center text-xs font-medium uppercase tracking-wide text-text-muted">
          {ADMIN_CALENDAR_WEEKDAYS.map((day) => (
            <div key={day} className="px-1 py-2">
              {day}
            </div>
          ))}
        </div>
        {loading ? (
          <p className="px-4 py-8 text-sm text-text-muted">Loading calendar…</p>
        ) : (
          <div className="grid grid-cols-7">
            {Array.from({ length: leadingBlanks }).map((_, index) => (
              <div key={`blank-${index}`} className="min-h-16 bg-lavender-light/20" />
            ))}
            {days.map((day) => {
              const selected = selectedDate === day.date;
              const canSelect = selectableDates
                ? selectableDates.has(day.date)
                : true;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => {
                    if (!canSelect) return;
                    onSelectDate(day.date);
                  }}
                  aria-disabled={!canSelect}
                  className={`${adminCalendarDayButtonClass(day, selected)} ${
                    canSelect ? "" : "cursor-default"
                  }`}
                >
                  <span
                    className={`text-sm ${
                      day.isToday ? "font-semibold text-gold-dark" : ""
                    }`}
                  >
                    {Number(day.date.slice(-2))}
                  </span>
                  {day.closureLabel ? (
                    <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-gold-dark">
                      {day.closureLabel}
                    </span>
                  ) : null}
                  {day.appointmentCount > 0 ? (
                    <span className="mt-1 block text-[11px]">
                      {day.appointmentCount} booked
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
