"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/business";
import {
  formatServiceAddress,
  formatTravelMiles,
  type ServiceAddress,
  type TravelQuote,
} from "@/lib/travel";
import type { PetProfile } from "@/lib/pets";
import { bookingDogsDuration, type BookingDogService } from "@/lib/booking/dogs";
import {
  DateTimeStep,
  type AvailabilityDay,
} from "@/components/booking/DateTimeStep";
import { bookingTravelAreaCopy } from "@/lib/booking-price";
import { ARRIVAL_WINDOW_PENDING_LABEL } from "@/lib/appointments/arrival-window";
import type { TimePreference } from "@/lib/booking-schedule";
import {
  bookingBackLinkClass,
  bookingFieldClass,
  bookingLabelClass,
  bookingNoticeClass,
  bookingPrimaryBtnClass,
  bookingSecondaryBtnClass,
} from "@/components/booking/booking-ui";

const EMPTY_ADD_ON_IDS: string[] = [];

type Props = {
  pet: PetProfile;
  dogs?: BookingDogService[];
  serviceId?: string | null;
  addOnIds?: string[];
  initialAddress?: ServiceAddress | null;
  initialQuote?: TravelQuote | null;
  initialDate?: string | null;
  initialSlotStartMinutes?: number | null;
  showPrices?: boolean;
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
  dogs,
  serviceId = "",
  addOnIds = EMPTY_ADD_ON_IDS,
  initialAddress,
  initialQuote,
  initialDate,
  initialSlotStartMinutes,
  showPrices = false,
  onBack,
  onComplete,
}: Props) {
  const [phase, setPhase] = useState<"address" | "schedule">(
    initialAddress && initialQuote ? "schedule" : "address",
  );
  const [street, setStreet] = useState(initialAddress?.street ?? "");
  const [city, setCity] = useState(initialAddress?.city ?? "");
  const [state, setState] = useState(initialAddress?.state?.trim() || "FL");
  const [zip, setZip] = useState(initialAddress?.zip ?? "");
  const [quote, setQuote] = useState<TravelQuote | null>(initialQuote ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<AvailabilityDay[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const totalDurationMinutes = dogs?.length
    ? bookingDogsDuration(dogs)
    : undefined;

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
          weightLbs: String(pet.weightLbs),
        });
        if (serviceId) params.set("serviceId", serviceId);
        if (totalDurationMinutes) params.set("durationMinutes", String(totalDurationMinutes));
        if (addOnIds.length > 0) params.set("addOnIds", addOnIds.join(","));
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
  }, [phase, quote, zip, serviceId, pet.weightLbs, addOnIds.join(","), totalDurationMinutes]);

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
          durationMinutes: totalDurationMinutes,
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
      if (!res.ok) {
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
        data.appointmentTime?.trim() || ARRIVAL_WINDOW_PENDING_LABEL,
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
        <h2 className="font-display mt-8 text-center text-3xl text-ink md:text-4xl">
          <span className="block">Choose a date and start time for</span>
          <span className="block break-words">{dogs?.length ? dogs.map((dog) => dog.pet.name).join(", ") : pet.name}</span>
        </h2>
        <div className="mt-8">
          <DateTimeStep
            compactHeader
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

      <h2 className="font-display mt-8 text-3xl text-ink md:text-4xl">
        Where shall we visit {dogs && dogs.length > 1 ? dogs.map((dog) => dog.pet.name).join(", ") : pet.name}?
      </h2>
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
        <div className="grid gap-5 md:grid-cols-3">
          <div>
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
          {(() => {
            const area = bookingTravelAreaCopy(quote.zone, showPrices);
            return (
            <>
              <p className="font-body text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
                {area.heading}
              </p>
              {quote.zone !== "complimentary" ? (
                <p className="font-body mt-4 text-sm text-taupe">{area.body}</p>
              ) : null}
              {area.showFee ? (
                <>
                  <p className="font-body mt-4 text-sm text-ink">
                    Distance · {formatTravelMiles(quote.distanceMiles)} miles
                  </p>
                  <p className="font-body mt-2 text-sm text-ink">
                    Extended Travel · +{formatPrice(quote.fee)}
                  </p>
                </>
              ) : null}
            </>
            );
          })()}
          {quote.zone !== "complimentary" ? <p className="font-body mt-4 text-xs text-taupe">
            {formatServiceAddress({
              street: street.trim(),
              city: city.trim(),
              state: state.trim(),
              zip: zip.trim(),
            })}
          </p> : null}
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
          <p className="text-sm text-red-700">{quote.summary}</p>
          <Link href="/contact" className={`${bookingSecondaryBtnClass} mt-6`}>
            Contact Us
          </Link>
        </div>
      )}
    </section>
  );
}
