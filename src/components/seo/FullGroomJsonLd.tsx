import React from "react";
import { getBrandSearchName, getBrandWebsiteUrl } from "@/lib/business";
import {
  FULL_GROOM_AREA_SERVED,
  FULL_GROOM_PAGE_DESCRIPTION,
  FULL_GROOM_PATH,
  FULL_GROOM_SERVICE_TYPE,
  SERVICES_PAGE_CANONICAL,
  absoluteSiteUrl,
} from "@/lib/service-page";

function businessEntityId() {
  return `${getBrandWebsiteUrl().replace(/\/$/, "")}/#business`;
}

function areaServed() {
  return FULL_GROOM_AREA_SERVED.map((name) => ({
    "@type": "City",
    name,
    containedInPlace: {
      "@type": "State",
      name: "Florida",
    },
  }));
}

export function FullGroomJsonLd() {
  const url = absoluteSiteUrl(FULL_GROOM_PATH);
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
            name: "Full Grooming",
            item: url,
          },
        ],
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: "Full Grooming",
        serviceType: FULL_GROOM_SERVICE_TYPE,
        url,
        description: FULL_GROOM_PAGE_DESCRIPTION,
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
