"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { PriceTiers } from "@/components/services/PriceTiers";
import { formatPrice } from "@/lib/business";
import type { BookableService } from "@/lib/services";
import {
  serviceCardAccessLabel,
  serviceCardBestFor,
  serviceCardPriceValue,
  serviceCardSummary,
  serviceDurationLabel,
} from "@/lib/service-page";

type Props = {
  service: BookableService;
  featured?: boolean;
  quiet?: boolean;
  requestLabel?: string;
  anchorId?: string;
};

export function ServiceCard({
  service,
  featured = false,
  quiet = false,
  requestLabel = "Request This Service",
  anchorId,
}: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const bestFor = serviceCardBestFor(service);
  const duration = serviceDurationLabel(service);
  const price = serviceCardPriceValue(service);
  const access = serviceCardAccessLabel(service);
  const priceLabel =
    service.pricingType === "free" ? "Care" : "From";
  const detailsLabel = open ? "Hide Details" : "View Details";
  const membersOnly = Boolean(service.membersOnly);

  return (
    <article
      id={anchorId}
      className={`scroll-mt-[15rem] border border-gray-line/80 ${
        quiet ? "bg-ivory/70" : "bg-ivory"
      } p-6 md:p-8`}
    >
      <h3 className="font-display text-2xl text-ink md:text-[1.75rem]">
        {service.name}
      </h3>
      <p className="font-body mt-3 text-sm leading-relaxed text-taupe">
        {serviceCardSummary(service)}
      </p>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        {bestFor && (
          <div>
            <dt className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-taupe">
              Best for
            </dt>
            <dd className="font-body mt-1 text-sm text-ink">{bestFor}</dd>
          </div>
        )}
        {price && (
          <div>
            <dt className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-taupe">
              {priceLabel}
            </dt>
            <dd className="font-body mt-1 text-sm text-ink">{price}</dd>
          </div>
        )}
        {duration && (
          <div>
            <dt className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-taupe">
              Time
            </dt>
            <dd className="font-body mt-1 text-sm text-ink">{duration}</dd>
          </div>
        )}
        {access && (
          <div>
            <dt className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-taupe">
              Access
            </dt>
            <dd className="font-body mt-1 text-sm text-ink">{access}</dd>
          </div>
        )}
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="inline-flex min-h-[48px] items-center justify-center rounded-sm border border-champagne bg-transparent px-5 text-[10px] font-medium uppercase tracking-[0.16em] text-ink transition hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={
            open
              ? `Hide details for ${service.name}`
              : `View details for ${service.name}`
          }
          onClick={() => setOpen((value) => !value)}
        >
          {detailsLabel}
        </button>
        {!quiet && !membersOnly && (
          <BookServiceLink className="inline-flex min-h-[48px] items-center justify-center rounded-sm bg-deep-lavender px-5 text-[10px] font-medium uppercase tracking-[0.16em] text-ivory transition hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne">
            {featured ? "Request This Service" : requestLabel}
          </BookServiceLink>
        )}
        {membersOnly && (
          <Link
            href="/login"
            className="inline-flex min-h-[48px] items-center justify-center rounded-sm border border-gray-line bg-transparent px-5 text-[10px] font-medium uppercase tracking-[0.16em] text-ink transition hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
          >
            Member Sign In
          </Link>
        )}
      </div>

      <div
        id={panelId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "mt-6 grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden" inert={!open || undefined}>
          <ServiceDetails service={service} />
        </div>
      </div>
    </article>
  );
}

function ServiceDetails({ service }: { service: BookableService }) {
  return (
    <div className="border-t border-gray-line/70 pt-6">
      <p className="font-body whitespace-pre-line text-sm leading-relaxed text-taupe">
        {service.description}
      </p>

      {service.bestFor && (
        <p className="font-body mt-4 text-sm text-taupe">
          <span className="font-medium uppercase tracking-[0.1em] text-ink">
            Best for:{" "}
          </span>
          {service.bestFor}
        </p>
      )}

      {service.includes && service.includes.length > 0 && (
        <div className="mt-5">
          <p className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-taupe">
            What’s Included
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {service.includes.map((item) => (
              <li key={item} className="font-body text-sm text-ink">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {service.tiers && service.pricingType === "tiered" && (
        <PriceTiers tiers={service.tiers} />
      )}

      {service.pricingType === "hourly" && service.hourlyRate != null && (
        <p className="font-body mt-4 text-sm text-ink">
          From {formatPrice(service.hourlyRate)} / hour
        </p>
      )}

      {service.pricingType === "add_on" && service.tiers && (
        <PriceTiers
          tiers={service.tiers}
          priceOnly
          feeSuffix="added to the base service"
        />
      )}

      {service.pricingType === "add_on" &&
        service.flatRate != null &&
        !service.tiers && (
          <p className="font-body mt-4 text-sm text-ink">
            {service.durationMin != null
              ? `From ${formatPrice(service.flatRate)} / ${service.durationMin} min`
              : `From ${formatPrice(service.flatRate)}`}
          </p>
        )}

      {service.pricingType === "free" && (
        <p className="font-body mt-4 text-sm text-ink">
          Complimentary
          {service.membersOnly ? " · Members only" : ""} · By appointment only
        </p>
      )}

      {service.suitableFor && (
        <p className="font-body mt-4 text-sm text-taupe">
          <span className="font-medium text-ink">Suitable for: </span>
          {service.suitableFor}
        </p>
      )}

      {service.note && (
        <p className="font-body mt-4 text-sm text-taupe">{service.note}</p>
      )}

      {service.policyNote && (
        <p className="font-body mt-4 text-sm text-taupe">
          <span className="font-medium text-ink">Please note: </span>
          {service.policyNote}
        </p>
      )}
    </div>
  );
}
