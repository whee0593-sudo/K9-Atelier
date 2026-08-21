"use client";

import { useMemo, useState } from "react";
import { Cormorant_Garamond, Jost, Playfair_Display } from "next/font/google";
import {
  getEarliestBookableDate,
  parseDateValue,
  toDateValue,
} from "@/lib/booking-slots";
import type { TimePreference } from "@/lib/booking-schedule";
import styles from "./datetime-step.module.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-dt-playfair",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["italic"],
  variable: "--font-dt-cormorant",
});

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dt-jost",
});

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type AvailabilityDay = {
  date: string;
  available: boolean;
  morning: boolean;
  afternoon: boolean;
};

type Props = {
  initialDate?: string | null;
  initialPreference?: TimePreference | null;
  days: AvailabilityDay[];
  loading?: boolean;
  assigning?: boolean;
  error?: string | null;
  onConfirmed: (date: string, preference: TimePreference) => void;
  onBack: () => void;
};

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function DateTimeStep({
  initialDate,
  initialPreference,
  days,
  loading = false,
  assigning = false,
  error,
  onConfirmed,
  onBack,
}: Props) {
  const earliest = getEarliestBookableDate();
  const availability = useMemo(() => {
    const map = new Map<string, AvailabilityDay>();
    for (const day of days) map.set(day.date, day);
    return map;
  }, [days]);

  const [viewDate, setViewDate] = useState(() => {
    const base = initialDate
      ? parseDateValue(initialDate)
      : getEarliestBookableDate();
    return new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0, 0);
  });

  const [selectedDate, setSelectedDate] = useState(initialDate ?? "");
  const [preference, setPreference] = useState<TimePreference | "">(
    initialPreference ?? "",
  );

  const selectedDateObj = selectedDate ? parseDateValue(selectedDate) : null;
  const selectedAvailability = selectedDate
    ? availability.get(selectedDate)
    : undefined;

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1, 12, 0, 0, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ type: "empty" } | { type: "day"; date: Date }> = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({ type: "empty" });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ type: "day", date: new Date(year, month, d, 12, 0, 0, 0) });
    }

    return cells;
  }, [viewDate]);

  const prevMonthDisabled =
    viewDate.getFullYear() < earliest.getFullYear() ||
    (viewDate.getFullYear() === earliest.getFullYear() &&
      viewDate.getMonth() <= earliest.getMonth());

  function selectDate(date: Date) {
    const value = toDateValue(date);
    setSelectedDate(value);
    const next = availability.get(value);
    if (preference === "morning" && !next?.morning) setPreference("");
    if (preference === "afternoon" && !next?.afternoon) setPreference("");
  }

  function goPrevMonth() {
    setViewDate(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() - 1, 1, 12, 0, 0, 0),
    );
  }

  function goNextMonth() {
    setViewDate(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + 1, 1, 12, 0, 0, 0),
    );
  }

  const canContinue =
    Boolean(selectedDate) &&
    (preference === "morning" || preference === "afternoon") &&
    !assigning &&
    !loading &&
    ((preference === "morning" && selectedAvailability?.morning) ||
      (preference === "afternoon" && selectedAvailability?.afternoon));

  return (
    <div
      className={`${playfair.variable} ${cormorant.variable} ${jost.variable}`}
    >
      <div className={styles.card}>
        <div className={styles.brand}>
          <p className={styles.wordmark}>K9 ATELIER</p>
          <p className={styles.subline}>Private Mobile Bathing Salon</p>
        </div>

        <div className={styles.steps} aria-label="Booking progress">
          <div className={`${styles.step} ${styles.stepDone}`}>
            <div className={styles.stepCircle}>1</div>
            <span className={styles.stepLabel}>Your Pet</span>
          </div>
          <div className={styles.stepConnector} />
          <div className={`${styles.step} ${styles.stepDone}`}>
            <div className={styles.stepCircle}>2</div>
            <span className={styles.stepLabel}>Your Service</span>
          </div>
          <div className={styles.stepConnector} />
          <div className={`${styles.step} ${styles.stepActive}`}>
            <div className={styles.stepCircle}>3</div>
            <span className={styles.stepLabel}>Your Time</span>
          </div>
        </div>

        <h1 className={styles.title}>Select Date &amp; Time</h1>
        <p className={styles.routeNote}>
          Arrival windows are assigned to fit that day&apos;s route.
        </p>

        <div className={styles.monthNav}>
          <button
            type="button"
            aria-label="Previous month"
            onClick={goPrevMonth}
            disabled={prevMonthDisabled}
          >
            &#8249;
          </button>
          <span className={styles.monthLabel}>
            {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
          </span>
          <button type="button" aria-label="Next month" onClick={goNextMonth}>
            &#8250;
          </button>
        </div>

        <div className={styles.weekdays}>
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className={styles.days}>
          {calendarDays.map((cell, index) => {
            if (cell.type === "empty") {
              return (
                <span
                  key={`empty-${index}`}
                  className={`${styles.dayButton} ${styles.dayButtonEmpty}`}
                  aria-hidden="true"
                />
              );
            }

            const { date } = cell;
            const value = toDateValue(date);
            const bookable = !loading && Boolean(availability.get(value)?.available);
            const selected =
              selectedDateObj != null && isSameDay(date, selectedDateObj);

            return (
              <button
                key={value}
                type="button"
                disabled={!bookable}
                onClick={() => selectDate(date)}
                className={`${styles.dayButton} ${
                  selected ? styles.dayButtonSelected : ""
                }`}
              >
                <span className={styles.dayNum}>{date.getDate()}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.rule} />

        <p className={styles.sectionLabel}>Time of Day</p>
        <div className={styles.times}>
          {(
            [
              ["morning", "Morning"],
              ["afternoon", "Afternoon"],
            ] as const
          ).map(([id, label]) => {
            const open =
              id === "morning"
                ? Boolean(selectedAvailability?.morning)
                : Boolean(selectedAvailability?.afternoon);
            const selected = preference === id;

            return (
              <button
                key={id}
                type="button"
                disabled={!open}
                onClick={() => setPreference(id)}
                className={`${styles.timeButton} ${
                  selected ? styles.timeButtonSelected : ""
                }`}
              >
                <span className={styles.timeLabel}>{label}</span>
              </button>
            );
          })}
        </div>

        {error ? <p className={styles.errorNote}>{error}</p> : null}

        <div className={styles.actions}>
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => {
              if (preference !== "morning" && preference !== "afternoon") return;
              onConfirmed(selectedDate, preference);
            }}
            className={styles.continueBtn}
          >
            {assigning ? "Assigning window…" : "Continue"}
          </button>
          <button type="button" onClick={onBack} className={styles.backLink}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
