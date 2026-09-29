import React from "react";
import { getBrandSearchName, getBrandWebsiteUrl, getCommunitiesServed } from "@/lib/business";
import {
  HAND_STRIPPING_PAGE_DESCRIPTION,
  HAND_STRIPPING_PATH,
  SERVICES_PAGE_CANONICAL,
  absoluteSiteUrl,
} from "@/lib/service-page";

function businessEntityId() {
  return `${getBrandWebsiteUrl().replace(/\/$/, "")}/#business`;
}

function areaServed() {
  return getCommunitiesServed().map((name) => ({
    "@type": "City",
    name,
    containedInPlace: {
      "@type": "State",
      name: "Florida",
    },
  }));
}

export function HandStrippingJsonLd() {
  const url = absoluteSiteUrl(HAND_STRIPPING_PATH);
  const homeUrl = `${getBrandWebsiteUrl().replace(/\/$/, "")}/`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: homeUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Services",
            item: SERVICES_PAGE_CANONICAL,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "Hand Stripping",
            item: url,
          },
        ],
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: "Hand Stripping",
        url,
        description: HAND_STRIPPING_PAGE_DESCRIPTION,
        provider: {
          "@id": businessEntityId(),
          name: getBrandSearchName(),
        },
        areaServed: areaServed(),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
