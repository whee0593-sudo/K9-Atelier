import React from "react";
import { getBrandSearchName, getBrandWebsiteUrl } from "@/lib/business";
import {
  LONG_COAT_CARE_AREA_SERVED,
  LONG_COAT_CARE_PAGE_DESCRIPTION,
  LONG_COAT_CARE_PATH,
  LONG_COAT_CARE_SERVICE_NAME,
  LONG_COAT_CARE_SERVICE_TYPE,
} from "@/lib/long-coat-care-page";
import { SERVICES_PAGE_CANONICAL, absoluteSiteUrl } from "@/lib/service-page";

function businessEntityId() {
  return `${getBrandWebsiteUrl().replace(/\/$/, "")}/#business`;
}

function areaServed() {
  return LONG_COAT_CARE_AREA_SERVED.map((name) => ({
    "@type": "City",
    name,
    containedInPlace: {
      "@type": "State",
      name: "Florida",
    },
  }));
}

export function LongCoatCareJsonLd() {
  const url = absoluteSiteUrl(LONG_COAT_CARE_PATH);
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
            name: LONG_COAT_CARE_SERVICE_NAME,
            item: url,
          },
        ],
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: LONG_COAT_CARE_SERVICE_NAME,
        serviceType: LONG_COAT_CARE_SERVICE_TYPE,
        url,
        description: LONG_COAT_CARE_PAGE_DESCRIPTION,
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
