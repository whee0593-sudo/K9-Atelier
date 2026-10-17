import React from "react";
import {
  business,
  getBrandSchemaTelephone,
  getBrandSearchName,
} from "@/lib/business";

const BUSINESS_DESCRIPTION =
  "A private mobile pet spa for small breeds, providing gentle, personalized one-on-one dog grooming throughout Palm Beach, Palm Beach Gardens, Jupiter, Jupiter Island, Tequesta and West Palm Beach.";

/** Cities named on the business entity. Not the shorter public communities label. */
const CITIES_SERVED = [
  "Palm Beach",
  "Palm Beach Gardens",
  "Jupiter",
  "Jupiter Island",
  "Tequesta",
  "West Palm Beach",
] as const;

/**
 * Expertise topics on the business entity. Text values avoid a second Service
 * node for offerings that already have their own Service markup.
 */
const EXPERTISE = [
  "Mobile Dog Grooming",
  "Full Grooming",
  "Hand Stripping",
  "Show-Level Long-Coat Care",
  "Extra-Gentle Senior Grooming",
] as const;

function cityServed(name: string) {
  return {
    "@type": "City",
    name,
    containedInPlace: {
      "@type": "State",
      name: "Florida",
      containedInPlace: {
        "@type": "Country",
        name: "United States",
        alternateName: "US",
      },
    },
  };
}

export function LocalBusinessJsonLd() {
  const { brand, booking, serviceArea } = business;
  const sameAs = [
    brand.social.facebookUrl,
    business.site.underConstruction?.instagramUrl,
    brand.google.businessProfileUrl,
  ].filter((url): url is string => Boolean(url));

  const searchName = getBrandSearchName();
  const siteId = `${brand.website.replace(/\/$/, "")}/#website`;
  const businessId = `${brand.website.replace(/\/$/, "")}/#business`;

  // LocalBusiness only. Self-serving Review and AggregateRating markup is omitted
  // so Google does not treat testimonials about K9 Atelier as review snippets.
  const localBusiness: Record<string, unknown> = {
    "@type": "LocalBusiness",
    "@id": businessId,
    name: searchName,
    alternateName: brand.name,
    slogan: brand.tagline,
    description: BUSINESS_DESCRIPTION,
    url: brand.website,
    image: `${brand.website}${brand.logo}`,
    email: brand.email,
    telephone: getBrandSchemaTelephone(),
    priceRange: "$90–$350+",
    address: {
      "@type": "PostalAddress",
      addressLocality: serviceArea.publicLocality,
      addressRegion: serviceArea.publicRegion,
      addressCountry: "US",
    },
    areaServed: CITIES_SERVED.map((name) => cityServed(name)),
    knowsAbout: [...EXPERTISE],
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
        ],
        opens: booking.hoursStart,
        closes: booking.hoursEnd,
      },
    ],
  };

  if (sameAs.length > 0) localBusiness.sameAs = sameAs;

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": siteId,
        name: searchName,
        url: brand.website,
        publisher: { "@id": businessId },
      },
      localBusiness,
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
