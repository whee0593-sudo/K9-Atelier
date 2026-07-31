"use client";

import { useState } from "react";
import { business, formatPrice } from "@/lib/business";
import {
  formatServiceAddress,
  type ServiceAddress,
  type TravelQuote,
} from "@/lib/travel";

type Props = {
  initialAddress?: ServiceAddress | null;
  initialQuote?: TravelQuote | null;
  onConfirmed: (address: ServiceAddress, quote: TravelQuote) => void;
  onBack: () => void;
};

export function AddressStep({
  initialAddress,
  initialQuote,
  onConfirmed,
  onBack,
}: Props) {
  const [street, setStreet] = useState(initialAddress?.street ?? "");
  const [city, setCity] = useState(initialAddress?.city ?? "");
  const [state, setState] = useState(initialAddress?.state ?? "FL");
  const [zip, setZip] = useState(initialAddress?.zip ?? "");
  const [quote, setQuote] = useState<TravelQuote | null>(initialQuote ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { freeRadiusMiles, maxDistanceMiles, travelFeePerMile } =
    business.serviceArea;

  async function handleCalculate(e: React.FormEvent) {
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
        setError(data.error ?? "Could not calculate travel fee.");
        return;
      }

      setQuote(data.quote);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleContinue() {
    if (!quote?.withinServiceArea) return;
    onConfirmed(
      { street: street.trim(), city: city.trim(), state: state.trim(), zip: zip.trim() },
      quote,
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-gold-dark underline"
      >
        ← Back
      </button>

      <h2 className="mt-6 text-lg font-medium text-gold-dark">
        Service Address
      </h2>
      <p className="mt-2 text-sm text-text-muted">
        Enter the address where we should come. Travel is free within{" "}
        {freeRadiusMiles} miles; then {formatPrice(travelFeePerMile)}/mile
        one-way (max {maxDistanceMiles} miles).
      </p>

      <form onSubmit={handleCalculate} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-text">
            Street address
          </label>
          <input
            required
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="123 Main St"
            className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-text">City</label>
            <input
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Palm Beach Gardens"
              className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text">State</label>
            <input
              required
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text">ZIP</label>
            <input
              required
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="33418"
              className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gold px-6 py-2.5 text-sm font-medium text-white hover:bg-gold-dark disabled:opacity-60"
        >
          {loading ? "Calculating…" : "Calculate travel fee"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {quote && (
        <div
          className={`mt-6 rounded-2xl border px-5 py-4 text-sm ${
            quote.withinServiceArea
              ? "border-gold/30 bg-lavender-light/30 text-text"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <p className="font-medium text-text">
            {formatServiceAddress({
              street: street.trim(),
              city: city.trim(),
              state: state.trim(),
              zip: zip.trim(),
            })}
          </p>
          <p className="mt-2 text-text-muted">{quote.summary}</p>
          {quote.withinServiceArea && (
            <p className="mt-2 font-medium text-gold-dark">
              Travel fee: {formatPrice(quote.fee)}
              {quote.fee === 0 ? " (included)" : ""}
            </p>
          )}
        </div>
      )}

      {quote?.withinServiceArea && (
        <button
          type="button"
          onClick={handleContinue}
          className="mt-6 w-full rounded-2xl bg-gold px-6 py-3 text-sm font-medium text-white hover:bg-gold-dark"
        >
          Continue to date &amp; time
        </button>
      )}
    </div>
  );
}
