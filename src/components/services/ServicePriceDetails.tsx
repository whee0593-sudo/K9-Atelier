import { formatPrice } from "@/lib/business";
import type { BookableService } from "@/lib/services";
import { FullGroomPriceMatrix } from "@/components/services/FullGroomPriceMatrix";
import { PriceTiers } from "@/components/services/PriceTiers";

/** Staff-only price tables. Guests do not receive this component. */
export function ServicePriceDetails({ service }: { service: BookableService }) {
  return (
    <>
      {service.pricingType === "tiered" && service.coatTypePrices?.length ? (
        <FullGroomPriceMatrix service={service} />
      ) : service.tiers && service.pricingType === "tiered" ? (
        <PriceTiers tiers={service.tiers} />
      ) : null}

      {service.pricingType === "hourly" && service.hourlyRate != null ? (
        <p className="font-body mt-4 text-sm text-ink">
          From {formatPrice(service.hourlyRate)} / hour
        </p>
      ) : null}

      {service.pricingType === "add_on" &&
      service.tiers &&
      service.flatRate == null ? (
        <PriceTiers
          tiers={service.tiers}
          priceOnly
          feeSuffix="added to the base service"
        />
      ) : null}

      {service.pricingType === "add_on" && service.flatRate != null ? (
        <p className="font-body mt-4 text-sm text-ink">
          {service.durationMin != null
            ? `From ${formatPrice(service.flatRate)} / ${service.durationMin} min`
            : `From ${formatPrice(service.flatRate)}`}
        </p>
      ) : null}

      {service.pricingType === "free" ? (
        <p className="font-body mt-4 text-sm text-ink">
          Complimentary
          {service.membersOnly ? " · Members only" : ""} · By appointment only
        </p>
      ) : null}
    </>
  );
}
