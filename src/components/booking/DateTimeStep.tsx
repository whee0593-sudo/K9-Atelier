"use client";

import { useState } from "react";
import { getTimeSlots, getUpcomingBookableDates } from "@/lib/booking-slots";

type Props = {
  initialDate?: string | null;
  initialTime?: string | null;
  onConfirmed: (date: string, time: string) => void;
  onBack: () => void;
};

export function DateTimeStep({
  initialDate,
  initialTime,
  onConfirmed,
  onBack,
}: Props) {
  const dates = getUpcomingBookableDates(20);
  const times = getTimeSlots();
  const [date, setDate] = useState(initialDate ?? dates[0]?.value ?? "");
  const [time, setTime] = useState(initialTime ?? "");

  return (
    <div className="mx-auto max-w-xl">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-gold-dark underline"
      >
        ← Back to address
      </button>

      <h2 className="mt-6 text-lg font-medium text-gold-dark">
        Date &amp; Time
      </h2>
      <p className="mt-2 text-sm text-text-muted">
        Available Monday–Friday, 9:00 AM – 4:00 PM (Eastern Time).
      </p>

      <div className="mt-6">
        <p className="text-sm font-medium text-text">Select a date</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {dates.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setDate(d.value)}
              className={`rounded-xl px-3 py-3 text-sm transition ${
                date === d.value
                  ? "bg-gold text-white"
                  : "border border-lavender/40 bg-cream text-text hover:border-gold/40"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <p className="text-sm font-medium text-text">Select a time</p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {times.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setTime(slot)}
              className={`rounded-xl px-2 py-2.5 text-sm transition ${
                time === slot
                  ? "bg-gold text-white"
                  : "border border-lavender/40 bg-cream text-text hover:border-gold/40"
              }`}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={!date || !time}
        onClick={() => onConfirmed(date, time)}
        className="mt-8 w-full rounded-2xl bg-gold px-6 py-3 text-sm font-medium text-white hover:bg-gold-dark disabled:opacity-50"
      >
        Continue to review
      </button>
    </div>
  );
}
