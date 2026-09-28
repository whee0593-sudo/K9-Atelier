import React from "react";
import {
  business,
  getBrandSchemaTelephone,
  getBrandSearchName,
  getCommunitiesServed,
} from "@/lib/business";

export function LocalBusinessJsonLd() {
  const { brand, booking, serviceArea } = business;
  const communities = getCommunitiesServed();
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
    description: brand.intro,
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
    areaServed: communities.map((name) => ({
      "@type": "City",
      name,
      containedInPlace: {
        "@type": "State",
        name: "Florida",
      },
    })),
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
