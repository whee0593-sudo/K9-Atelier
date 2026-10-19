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
          summary="Applied only if fleas or ticks are found during the pre-groom check."
        >
          <p className="font-body text-sm leading-relaxed text-taupe">
            {flea.description}
          </p>
          {showPrices ? (
            <ul className="mt-4 space-y-2 text-sm text-ink">
              {fleaItems.map((item) => (
                <li key={item.name}>
                  {item.name}: From {formatPrice(item.rate)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body mt-4 text-sm text-ink">
              Any treatment or sanitation charge is included in the estimate
              when you confirm the appointment.
            </p>
          )}
        </PolicyAccordion>
      )}

      {behavior && (
        <PolicyAccordion
          title={behavior.name}
          summary={
            showPrices
              ? `From ${formatPrice(behaviorMin)}, assessed on-site when extra handling is needed.`
              : "Assessed on-site when extra handling is needed. The amount is shown when you confirm the appointment."
          }
        >
          <p className="font-body text-sm leading-relaxed text-taupe">
            {behavior.description}
          </p>
          {showPrices ? (
            <p className="font-body mt-3 text-sm text-ink">
              From {formatPrice(behaviorMin)}, based on the level of anxiety,
              resistance, or aggression shown on-site.
            </p>
          ) : null}
        </PolicyAccordion>
      )}

      {travel && "rate" in travel && typeof travel.rate === "number" && (
        <PolicyAccordion
          title="Travel Fee"
          summary={
            showPrices
              ? `Complimentary within ${freeRadiusMiles} miles, then ${formatPrice(travelFeePerMile)} per mile through ${maxDistanceMiles}, and ${formatPrice(extendedTravelFeePerMile)} per mile through ${standardServiceMiles}.`
              : `Included within ${freeRadiusMiles} miles. Any travel fee is shown when you confirm the appointment.`
          }
        >
          {showPrices ? (
            <ul className="font-body space-y-2 text-sm text-ink">
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
            <ul className="font-body space-y-2 text-sm text-ink">
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
            <p className="font-body mt-3 text-sm leading-relaxed text-taupe">
              {travel.description}
            </p>
          ) : null}
        </PolicyAccordion>
      )}

      <PolicyAccordion
        title="Pricing Adjustments"
        summary={
          showPrices
            ? "Starting prices may change with coat condition, temperament, and time required."
            : "The estimate may change with coat condition, temperament, and time required."
        }
      >
        <p className="font-body text-sm leading-relaxed text-taupe">
          {showPrices
            ? "Starting prices reflect a typical appointment within each weight range. Final pricing may vary based on coat condition, grooming requirements, temperament, and the time required to complete the service comfortably."
            : "The estimate shown when you confirm the appointment reflects the services you selected. It may vary based on coat condition, grooming requirements, temperament, and the time required to complete the service comfortably."}
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
          Extra-Gentle Senior Care is listed under{" "}
          <Link
            href={SPECIALTY_CARE_PATH}
            className="underline decoration-champagne/70 underline-offset-4 transition hover:text-ink"
          >
            Specialty Care
          </Link>
          .
        </p>
      )}
    </div>
  );
}
