import { business, formatPrice } from "@/lib/business";
import { getServiceById } from "@/lib/service-page";
import { PolicyAccordion } from "@/components/services/PolicyAccordion";

export function FeesPoliciesSection() {
  const travel = business.fees.find((fee) => fee.type === "travel");
  const flea = business.fees.find((fee) => fee.id === "flea-tick-fee");
  const behavior = business.fees.find((fee) => fee.id === "behavior-fee");
  const dematting = getServiceById("dematting-brush-out");
  const senior = getServiceById("senior-comfort-care");
  const { freeRadiusMiles, maxDistanceMiles, travelFeePerMile } =
    business.serviceArea;
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
          summary="Applied only if fleas or ticks are found during the pre-groom check."
        >
          <p className="font-body text-sm leading-relaxed text-taupe">
            {flea.description}
          </p>
          <ul className="mt-4 space-y-2 text-sm text-ink">
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
          summary={`From ${formatPrice(behaviorMin)}, assessed on-site when extra handling is needed.`}
        >
          <p className="font-body text-sm leading-relaxed text-taupe">
            {behavior.description}
          </p>
          <p className="font-body mt-3 text-sm text-ink">
            From {formatPrice(behaviorMin)}, based on the level of anxiety,
            resistance, or aggression shown on-site.
          </p>
        </PolicyAccordion>
      )}

      {travel && "rate" in travel && typeof travel.rate === "number" && (
        <PolicyAccordion
          title="Travel Fee"
          summary={`Complimentary within ${freeRadiusMiles} miles, then ${formatPrice(travelFeePerMile)} per one-way mile.`}
        >
          <ul className="font-body space-y-2 text-sm text-ink">
            <li>Complimentary within {freeRadiusMiles} miles</li>
            <li>
              {freeRadiusMiles}–{maxDistanceMiles} miles:{" "}
              {formatPrice(travelFeePerMile)} per one-way mile
            </li>
            <li>Calculated by GPS driving distance</li>
            <li>
              Beyond {maxDistanceMiles} miles considered case by case
            </li>
          </ul>
          <p className="font-body mt-3 text-sm leading-relaxed text-taupe">
            {travel.description}
          </p>
        </PolicyAccordion>
      )}

      <PolicyAccordion
        title="Pricing Adjustments"
        summary="Starting prices may change with coat condition, temperament, and time required."
      >
        <p className="font-body text-sm leading-relaxed text-taupe">
          Starting prices reflect a typical appointment within each weight
          range. Final pricing may vary based on coat condition, grooming
          requirements, temperament, and the time required to complete the
          service comfortably.
        </p>
      </PolicyAccordion>

      <PolicyAccordion
        title="Dogs Over 45 lbs"
        summary={business.weightPolicy.over45Note}
      >
        <p className="font-body text-sm leading-relaxed text-taupe">
          {business.weightPolicy.over45Note}
        </p>
      </PolicyAccordion>

      {dematting?.policyNote && (
        <PolicyAccordion
          title="Dematting Policy"
          summary="Dematting is limited in time to protect skin and keep the visit low-stress."
        >
          <p className="font-body text-sm leading-relaxed text-taupe">
            {dematting.policyNote}
          </p>
        </PolicyAccordion>
      )}

      {senior && (
        <p className="font-body px-1 pt-2 text-sm leading-relaxed text-taupe">
          Senior & Gentle Comfort Care is listed under Gentle & End-of-Life
          Care, including starting prices by weight.
        </p>
      )}
    </div>
  );
}
