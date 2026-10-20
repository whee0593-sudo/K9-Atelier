import Link from "next/link";
import { business, formatPrice } from "@/lib/business";
import { SPECIALTY_CARE_PATH, getServiceById } from "@/lib/service-page";
import { PolicyAccordion } from "@/components/services/PolicyAccordion";

export function FeesPoliciesSection() {
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
          <ul className="mt-4 space-y-2 text-base text-ink">
            {fleaItems.map((item) => (
              <li key={item.name}>
                {item.name}: From {formatPrice(item.rate)}
              </li>
            ))}
          </ul>
        </PolicyAccordion>
      )}

      {behavior && (
        <PolicyAccordion
          title={behavior.name}
        >
          <p className="font-body mt-3 text-base text-ink">
            From {formatPrice(behaviorMin)}, based on the level of anxiety,
            resistance, or aggression shown on-site.
          </p>
        </PolicyAccordion>
      )}

      {travel && "rate" in travel && typeof travel.rate === "number" && (
        <PolicyAccordion
          title="Travel Fee"
        >
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
        </PolicyAccordion>
      )}

      <PolicyAccordion
        title="Pricing Adjustments"
      >
        <p className="font-body text-base leading-relaxed text-ink">
          Prices start at the listed rate and may vary with coat condition,
          styling, temperament and time needed.
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
