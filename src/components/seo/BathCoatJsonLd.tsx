import React from "react";
import { getBrandSearchName, getBrandWebsiteUrl, getCommunitiesServed } from "@/lib/business";
import {
  BATH_COAT_PAGE_DESCRIPTION,
  BATH_COAT_PATH,
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

export function BathCoatJsonLd() {
  const url = absoluteSiteUrl(BATH_COAT_PATH);
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
            name: "Bath & Coat Care",
            item: url,
          },
        ],
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: "Bath & Coat Care",
        url,
        description: BATH_COAT_PAGE_DESCRIPTION,
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
