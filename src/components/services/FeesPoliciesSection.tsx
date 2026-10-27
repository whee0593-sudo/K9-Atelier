import Link from "next/link";
import { business, formatPrice } from "@/lib/business";
import { SPECIALTY_CARE_PATH, getServiceById } from "@/lib/service-page";
import { PolicyAccordion } from "@/components/services/PolicyAccordion";

export function FeesPoliciesSection({
  showPrices = false,
}: {
  showPrices?: boolean;
}) {
  const travel = business.fees.find((fee) => fee.type === "travel");
  const flea = business.fees.find((fee) => fee.id === "flea-tick-fee");
  const behavior = business.fees.find((fee) => fee.id === "behavior-fee");
  const dematting = getServiceById("dematting-brush-out");
  const senior = getServiceById("senior-comfort-care");
  const {
    freeRadiusMiles,
    maxDistanceMiles,
    travelFeePerMile,
    extendedTravelFeePerMile,
    standardServiceMiles,
  } = business.serviceArea;
  const standardTravelPortion = (maxDistanceMiles - freeRadiusMiles) * travelFeePerMile;
  const fleaItems =
    flea && "lineItems" in flea
      ? (flea.lineItems as Array<{ name: string; rate: number; note?: string }>)
      : [];
  const behaviorMin =
    behavior && "rateMin" in behavior && typeof behavior.rateMin === "number"
      ? behavior.rateMin
      : 25;

  return (
    <div className="space-y-4">
      {flea && (
        <PolicyAccordion
          title={flea.name}
        >
          <p className="font-body text-base leading-relaxed text-ink">
            If fleas or ticks are found, we will notify you. A medicated bath
            and vehicle sanitation are required; both fees apply.
          </p>
          {showPrices ? (
            <ul className="mt-4 space-y-2 text-base text-ink">
              {fleaItems.map((item) => (
                <li key={item.name}>
                  {item.name}: From {formatPrice(item.rate)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body mt-4 text-base text-ink">
              Any treatment or sanitation charge is included in the estimate
              when you confirm the appointment.
            </p>
          )}
        </PolicyAccordion>
      )}

      {behavior && (
        <PolicyAccordion
          title={behavior.name}
        >
          <p className="font-body text-base leading-relaxed text-ink">
            {behavior.description}
          </p>
          {showPrices ? (
            <p className="font-body mt-3 text-base text-ink">
              From {formatPrice(behaviorMin)}, based on the level of anxiety,
              resistance, or aggression shown on-site.
            </p>
          ) : null}
        </PolicyAccordion>
      )}

      {travel && "rate" in travel && typeof travel.rate === "number" && (
        <PolicyAccordion
          title="Travel Fee"
        >
          {showPrices ? (
            <ul className="font-body space-y-2 text-base text-ink">
              <li>Complimentary within {freeRadiusMiles} miles</li>
              <li>
                Above {freeRadiusMiles} through {maxDistanceMiles} miles:{" "}
                {formatPrice(travelFeePerMile)} per one-way mile beyond{" "}
                {freeRadiusMiles}
              </li>
              <li>
                Above {maxDistanceMiles} through {standardServiceMiles} miles:{" "}
                {formatPrice(standardTravelPortion)} plus{" "}
                {formatPrice(extendedTravelFeePerMile)} per mile beyond{" "}
                {maxDistanceMiles}
              </li>
              <li>One-way GPS driving distance. The travel fee is rounded to the nearest dollar</li>
              <li>
                Beyond {standardServiceMiles} miles, please contact us. Online
                booking is not available.
              </li>
            </ul>
          ) : (
            <ul className="font-body space-y-2 text-base text-ink">
              <li>Included within {freeRadiusMiles} miles</li>
              <li>
                Above {freeRadiusMiles} through {standardServiceMiles} miles, a
                travel fee may apply
              </li>
              <li>The amount is shown when you confirm the appointment</li>
              <li>
                Beyond {standardServiceMiles} miles, please contact us. Online
                booking is not available.
              </li>
            </ul>
          )}
          {showPrices ? (
            <p className="font-body mt-3 text-base leading-relaxed text-ink">
              {travel.description}
            </p>
          ) : null}
        </PolicyAccordion>
      )}

      <PolicyAccordion
        title="Pricing Adjustments"
      >
        <p className="font-body text-base leading-relaxed text-ink">
          {showPrices
            ? "Starting prices reflect a typical appointment within each weight range. Final pricing may vary based on coat condition, grooming requirements, temperament, and the time required to complete the service comfortably."
            : "The estimate shown when you confirm the appointment reflects the services you selected. It may vary based on coat condition, grooming requirements, temperament, and the time required to complete the service comfortably."}
        </p>
      </PolicyAccordion>

      <PolicyAccordion
        title="Dogs Over 45 lbs"
      >
        <p className="font-body text-base leading-relaxed text-ink">
          {business.weightPolicy.over45Note}
        </p>
      </PolicyAccordion>

      {dematting?.policyNote && (
        <PolicyAccordion
          title="Dematting Policy"
        >
          <p className="font-body text-base leading-relaxed text-ink">
            {dematting.policyNote}
          </p>
        </PolicyAccordion>
      )}

      {senior && (
        <p className="font-body px-1 pt-2 text-base leading-relaxed text-ink">
          <Link
            href={SPECIALTY_CARE_PATH}
            className="underline decoration-champagne/70 underline-offset-4 transition hover:text-ink"
          >
            Senior &amp; Gentle Comfort Care →
          </Link>
        </p>
      )}
    </div>
  );
}
