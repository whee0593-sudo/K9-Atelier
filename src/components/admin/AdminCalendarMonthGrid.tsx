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
  onPrevMonth,
  onNextMonth,
  onSelectDate,
}: {
  month: string;
  days: AdminCalendarDay[];
  selectedDate: string | null;
  loading?: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: string, anchor?: HTMLButtonElement) => void;
}) {
  const leadingBlanks = calendarMonthLeadingBlanks(days);

  return (
    <div className="w-full max-w-full">
      <div className="flex items-center justify-between gap-2">
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

      <div className="mt-4 w-full max-w-full rounded-2xl border border-lavender/30 bg-cream">
        <div className="grid w-full grid-cols-7 border-b border-lavender/20 bg-lavender-light/40 text-center text-xs font-medium uppercase tracking-wide text-text-muted">
          {ADMIN_CALENDAR_WEEKDAYS.map((day) => (
            <div key={day} className="px-1 py-2">
              {day}
            </div>
          ))}
        </div>
        {loading ? (
          <p className="px-4 py-8 text-sm text-text-muted">Loading calendar…</p>
        ) : (
          <div className="grid w-full grid-cols-7">
            {Array.from({ length: leadingBlanks }).map((_, index) => (
              <div key={`blank-${index}`} className="min-h-16 min-w-0 bg-lavender-light/20" />
            ))}
            {days.map((day) => {
              const selected = selectedDate === day.date;
              const note = day.availabilityLabel ?? day.closureLabel;
              return (
                <button
                  key={day.date}
                  type="button"
                  data-calendar-date={day.date}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectDate(day.date, event.currentTarget);
                  }}
                  className={`${adminCalendarDayButtonClass(day, selected)} relative z-[1] min-w-0 max-w-full cursor-pointer touch-manipulation`}
                >
                  <span
                    className={`text-sm ${
                      day.isToday ? "font-semibold text-gold-dark" : ""
                    }`}
                  >
                    {Number(day.date.slice(-2))}
                  </span>
                  {note ? (
                    <span
                      className={`mt-1 block text-[10px] leading-tight text-gold-dark [overflow-wrap:anywhere] ${
                        day.availabilityLabel
                          ? ""
                          : "font-medium uppercase tracking-wide"
                      }`}
                    >
                      {note}
                    </span>
                  ) : null}
                  {day.appointmentCount > 0 ? (
                    <span className="mt-1 block text-[10px] leading-tight">
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
