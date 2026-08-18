"use client";

import { useMemo, useState } from "react";
import { Cormorant_Garamond, Jost, Playfair_Display } from "next/font/google";
import {
  getAvailableTimeSlotsForDate,
  getTimeSlots,
  isDateBookable,
  parseDateValue,
  toDateValue,
} from "@/lib/booking-slots";
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

type Props = {
  initialDate?: string | null;
  initialTime?: string | null;
  onConfirmed: (date: string, time: string) => void;
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
  initialTime,
  onConfirmed,
  onBack,
}: Props) {
  const allSlots = getTimeSlots();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);

  const [viewDate, setViewDate] = useState(() => {
    const base = initialDate ? parseDateValue(initialDate) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0, 0);
  });

  const [selectedDate, setSelectedDate] = useState(initialDate ?? "");
  const [selectedTime, setSelectedTime] = useState(initialTime ?? "");

  const selectedDateObj = selectedDate ? parseDateValue(selectedDate) : null;
  const availableSlots = selectedDateObj
    ? getAvailableTimeSlotsForDate(selectedDateObj)
    : [];

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
    viewDate.getFullYear() === today.getFullYear() &&
    viewDate.getMonth() <= today.getMonth();

  function selectDate(date: Date) {
    setSelectedDate(toDateValue(date));
    setSelectedTime("");
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
            const bookable = isDateBookable(date);
            const selected =
              selectedDateObj != null && isSameDay(date, selectedDateObj);

            return (
              <button
                key={toDateValue(date)}
                type="button"
                disabled={!bookable}
                onClick={() => selectDate(date)}
                className={`${styles.dayButton} ${
                  selected ? styles.dayButtonSelected : ""
                }`}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>

        <div className={styles.rule} />

        <p className={styles.sectionLabel}>Available Time Windows</p>

        {!selectedDate ? (
          <p className={styles.noTimes}>
            Please select a date to view available times.
          </p>
        ) : availableSlots.length === 0 ? (
          <p className={styles.noTimes}>
            No openings this day — please choose another date.
          </p>
        ) : (
          <div className={styles.times}>
            {allSlots.map((slot) => {
              const open = availableSlots.includes(slot);
              const selected = slot === selectedTime;

              return (
                <button
                  key={slot}
                  type="button"
                  disabled={!open}
                  onClick={() => setSelectedTime(slot)}
                  className={`${styles.timeButton} ${
                    selected ? styles.timeButtonSelected : ""
                  } ${!open ? styles.timeUnavailable : ""}`}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            disabled={!selectedDate || !selectedTime}
            onClick={() => onConfirmed(selectedDate, selectedTime)}
            className={styles.continueBtn}
          >
            Continue
          </button>
          <button type="button" onClick={onBack} className={styles.backLink}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
