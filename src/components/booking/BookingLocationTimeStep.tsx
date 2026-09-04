"use client";

import { useEffect, useState } from "react";
import { business, formatPrice } from "@/lib/business";
import {
  formatServiceAddress,
  type ServiceAddress,
  type TravelQuote,
} from "@/lib/travel";
import type { PetProfile } from "@/lib/pets";
import {
  DateTimeStep,
  type AvailabilityDay,
} from "@/components/booking/DateTimeStep";
import type { TimePreference } from "@/lib/booking-schedule";
import {
  bookingBackLinkClass,
  bookingFieldClass,
  bookingLabelClass,
  bookingNoticeClass,
  bookingPrimaryBtnClass,
} from "@/components/booking/booking-ui";

type Props = {
  pet: PetProfile;
  serviceId: string;
  addOnIds: string[];
  initialAddress?: ServiceAddress | null;
  initialQuote?: TravelQuote | null;
  initialDate?: string | null;
  initialSlotStartMinutes?: number | null;
  onBack: () => void;
  onComplete: (
    address: ServiceAddress,
    quote: TravelQuote,
    date: string,
    time: string,
    preference: TimePreference,
    slotStartMinutes: number,
  ) => void;
};

export function BookingLocationTimeStep({
  pet,
  serviceId,
  addOnIds,
  initialAddress,
  initialQuote,
  initialDate,
  initialSlotStartMinutes,
  onBack,
  onComplete,
}: Props) {
  const [phase, setPhase] = useState<"address" | "schedule">(
    initialAddress && initialQuote ? "schedule" : "address",
  );
  const [street, setStreet] = useState(initialAddress?.street ?? "");
  const [city, setCity] = useState(initialAddress?.city ?? "");
  const [state, setState] = useState(initialAddress?.state ?? "FL");
  const [zip, setZip] = useState(initialAddress?.zip ?? "");
  const [quote, setQuote] = useState<TravelQuote | null>(initialQuote ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<AvailabilityDay[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const { freeRadiusMiles } = business.serviceArea;

  useEffect(() => {
    if (phase !== "schedule" || !quote?.lat || !quote.lon) return;
    let cancelled = false;

    async function loadDays() {
      setAvailabilityLoading(true);
      setScheduleError(null);
      try {
        const params = new URLSearchParams({
          lat: String(quote!.lat),
          lon: String(quote!.lon),
          zip: zip.trim(),
          serviceId,
          weightLbs: String(pet.weightLbs),
          addOnIds: addOnIds.join(","),
        });
        const res = await fetch(`/api/booking/availability?${params}`, {
          credentials: "include",
        });
        const data = (await res.json()) as {
          error?: string;
          days?: AvailabilityDay[];
        };
        if (cancelled) return;
        if (!res.ok) {
          setScheduleError(data.error ?? "Could not load available dates.");
          return;
        }
        setDays(data.days ?? []);
      } catch {
        if (!cancelled) {
          setScheduleError("Could not load available dates.");
        }
      } finally {
        if (!cancelled) setAvailabilityLoading(false);
      }
    }

    void loadDays();
    return () => {
      cancelled = true;
    };
  }, [phase, quote, zip, serviceId, pet.weightLbs, addOnIds]);

  async function handleCheckArea(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setQuote(null);

    try {
      const res = await fetch("/api/travel-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ street, city, state, zip }),
      });
      const data = (await res.json()) as {
        error?: string;
        quote?: TravelQuote;
      };

      if (!res.ok || !data.quote) {
        setError(data.error ?? "Could not verify this address.");
        return;
      }

      setQuote(data.quote);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleContinueToSchedule() {
    if (!quote?.withinServiceArea || quote.lat == null || quote.lon == null) {
      setError("We could not locate that address. Please check it and try again.");
      return;
    }
    setPhase("schedule");
  }

  async function handleDateConfirmed(date: string, slotStartMinutes: number) {
    if (!quote || quote.lat == null || quote.lon == null) return;
    setAssigning(true);
    setScheduleError(null);
    try {
      const res = await fetch("/api/booking/availability", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: quote.lat,
          lon: quote.lon,
          zip: zip.trim(),
          serviceId,
          weightLbs: pet.weightLbs,
          addOnIds,
          date,
          slotStartMinutes,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        appointmentTime?: string;
        usedPreference?: TimePreference;
        slotStartMinutes?: number;
      };
      if (!res.ok || !data.appointmentTime) {
        setScheduleError(data.error ?? "Could not reserve that start time.");
        return;
      }
      onComplete(
        {
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          zip: zip.trim(),
        },
        quote,
        date,
        data.appointmentTime,
        data.usedPreference ?? "morning",
        data.slotStartMinutes ?? slotStartMinutes,
      );
    } catch {
      setScheduleError("Could not reserve that start time.");
    } finally {
      setAssigning(false);
    }
  }

  if (phase === "schedule") {
    return (
      <section>
        <button type="button" onClick={() => setPhase("address")} className={bookingBackLinkClass}>
          ← Back to address
        </button>
        <p className="font-body mt-8 text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
          Choose Your Appointment
        </p>
        <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
          Available private appointments for {pet.name}.
        </h2>
        <p className="font-body mt-4 text-sm text-taupe">
          Monday–Friday · 9:00 AM–4:00 PM Eastern · Choose an available start
          hour. Arrival is estimated for our mobile route and may vary slightly.
        </p>
        <div className="mt-8">
          <DateTimeStep
            initialDate={initialDate}
            initialSlotStartMinutes={initialSlotStartMinutes}
            days={days}
            loading={availabilityLoading}
            assigning={assigning}
            error={scheduleError}
            onBack={() => setPhase("address")}
            onConfirmed={handleDateConfirmed}
          />
        </div>
      </section>
    );
  }

  return (
    <section>
      <button type="button" onClick={onBack} className={bookingBackLinkClass}>
        ← Back
      </button>

      <p className="font-body mt-8 text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        Location
      </p>
      <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
        Where Shall We Meet You?
      </h2>
      <p className="font-body mt-4 max-w-2xl text-sm leading-relaxed text-taupe">
        K9 Atelier provides complimentary travel within our primary{" "}
        {freeRadiusMiles}-mile service area. Extended appointments up to
        approximately {business.serviceArea.maxDistanceMiles} miles may be
        accommodated with a travel fee.
      </p>

      <form onSubmit={handleCheckArea} className="mt-8 space-y-5">
        <div>
          <label htmlFor="street" className={bookingLabelClass}>
            Street Address
          </label>
          <input
            id="street"
            required
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            className={bookingFieldClass}
            autoComplete="street-address"
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label htmlFor="city" className={bookingLabelClass}>
              City
            </label>
            <input
              id="city"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={bookingFieldClass}
              autoComplete="address-level2"
            />
          </div>
          <div>
            <label htmlFor="state" className={bookingLabelClass}>
              State
            </label>
            <input
              id="state"
              required
              value={state}
              onChange={(e) => setState(e.target.value)}
              className={bookingFieldClass}
              autoComplete="address-level1"
            />
          </div>
          <div>
            <label htmlFor="zip" className={bookingLabelClass}>
              ZIP
            </label>
            <input
              id="zip"
              required
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className={bookingFieldClass}
              autoComplete="postal-code"
              inputMode="numeric"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={bookingPrimaryBtnClass}
        >
          {loading ? "Checking…" : "Check Service Area"}
        </button>
      </form>

      {error && (
        <div className={`${bookingNoticeClass} mt-6 border-[#c4a882]/40`}>
          <p className="text-sm text-ink">{error}</p>
        </div>
      )}

      {quote && quote.withinServiceArea && (
        <div className={`${bookingNoticeClass} mt-8`}>
          {quote.fee === 0 ? (
            <>
              <p className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
                Your Address Is Within Our Complimentary Service Area
              </p>
              <p className="font-display mt-3 text-2xl text-ink">{city}</p>
              <p className="font-body mt-4 text-sm text-taupe">
                Travel · Complimentary
              </p>
            </>
          ) : (
            <>
              <p className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
                Extended Service Area
              </p>
              <p className="font-body mt-3 text-sm text-taupe">
                We would be delighted to come to you.
              </p>
              <p className="font-body mt-4 text-sm text-ink">
                Distance · {quote.distanceMiles} miles
              </p>
              <p className="font-body mt-2 text-sm text-ink">
                Extended Travel · +{formatPrice(quote.fee)}
              </p>
            </>
          )}
          <p className="font-body mt-4 text-xs text-taupe">
            {formatServiceAddress({
              street: street.trim(),
              city: city.trim(),
              state: state.trim(),
              zip: zip.trim(),
            })}
          </p>
          <button
            type="button"
            onClick={handleContinueToSchedule}
            className={`${bookingPrimaryBtnClass} mt-6`}
          >
            Continue to Date &amp; Time
          </button>
        </div>
      )}

      {quote && !quote.withinServiceArea && (
        <div className={`${bookingNoticeClass} mt-8`}>
          <p className="text-sm text-ink">{quote.summary}</p>
        </div>
      )}
    </section>
  );
}
