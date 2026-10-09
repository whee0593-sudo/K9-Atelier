import React from "react";
import { ABOUT_PAGE_CANONICAL } from "@/lib/about-page";
import {
  business,
  getBrandSchemaTelephone,
  getBrandSearchName,
} from "@/lib/business";

const LOCAL_BUSINESS_DESCRIPTION =
  "K9 Atelier is a private mobile dog grooming spa serving Palm Beach, Palm Beach Gardens, Jupiter, Jupiter Island, Tequesta and West Palm Beach. Led by multiple award-winning show groomer Penny, K9 Atelier provides personalized one-on-one grooming for dogs up to 45 lbs, including full grooming, hand stripping, show-level long-coat care and extra-gentle senior care.";

const AREAS_SERVED = [
  "Palm Beach",
  "Palm Beach Gardens",
  "Jupiter",
  "Jupiter Island",
  "Tequesta",
  "West Palm Beach",
] as const;

const PENNY_ID = `${ABOUT_PAGE_CANONICAL}#penny`;

function areaServedCity(name: string) {
  return {
    "@type": "City",
    name,
    containedInPlace: {
      "@type": "State",
      name: "Florida",
    },
  };
}

function serviceOffer(name: string, serviceType: string, url?: string) {
  return {
    "@type": "Offer",
    itemOffered: {
      "@type": "Service",
      name,
      serviceType,
      ...(url ? { url } : {}),
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
  const origin = brand.website.replace(/\/$/, "");
  const siteId = `${origin}/#website`;
  const businessId = `${origin}/#business`;

  // LocalBusiness only. Self-serving Review and AggregateRating markup is omitted
  // so Google does not treat testimonials about K9 Atelier as review snippets.
  const localBusiness: Record<string, unknown> = {
    "@type": "LocalBusiness",
    "@id": businessId,
    name: searchName,
    alternateName: brand.name,
    slogan: brand.tagline,
    description: LOCAL_BUSINESS_DESCRIPTION,
    url: brand.website,
    image: `${brand.website}${brand.logo}`,
    email: brand.email,
    telephone: getBrandSchemaTelephone(),
    founder: { "@id": PENNY_ID },
    priceRange: "$90–$350+",
    address: {
      "@type": "PostalAddress",
      addressLocality: serviceArea.publicLocality,
      addressRegion: serviceArea.publicRegion,
      addressCountry: "US",
    },
    areaServed: AREAS_SERVED.map((name) => areaServedCity(name)),
    makesOffer: [
      serviceOffer(
        "Full Grooming",
        "Mobile Dog Grooming",
        `${origin}/services/full-groom`,
      ),
      serviceOffer(
        "Hand Stripping",
        "Mobile Hand Stripping",
        `${origin}/services/hand-stripping`,
      ),
      serviceOffer("Show-Level Long-Coat Care", "Long-Coat Dog Grooming"),
      serviceOffer("Extra-Gentle Senior Care", "Senior Dog Grooming"),
    ],
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
