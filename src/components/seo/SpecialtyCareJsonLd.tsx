import React from "react";
import { getBrandSearchName, getBrandWebsiteUrl } from "@/lib/business";
import {
  SERVICES_PAGE_CANONICAL,
  SPECIALTY_CARE_AREA_SERVED,
  SPECIALTY_CARE_PAGE_DESCRIPTION,
  SPECIALTY_CARE_PATH,
  SPECIALTY_CARE_SENIOR_NAME,
  SPECIALTY_CARE_SERVICE_TYPE,
  absoluteSiteUrl,
} from "@/lib/service-page";

function businessEntityId() {
  return `${getBrandWebsiteUrl().replace(/\/$/, "")}/#business`;
}

function areaServed() {
  return SPECIALTY_CARE_AREA_SERVED.map((name) => ({
    "@type": "City",
    name,
    containedInPlace: {
      "@type": "State",
      name: "Florida",
    },
  }));
}

export function SpecialtyCareJsonLd() {
  const url = absoluteSiteUrl(SPECIALTY_CARE_PATH);
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
            name: SPECIALTY_CARE_SENIOR_NAME,
            item: url,
          },
        ],
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: SPECIALTY_CARE_SENIOR_NAME,
        serviceType: SPECIALTY_CARE_SERVICE_TYPE,
        url,
        description: SPECIALTY_CARE_PAGE_DESCRIPTION,
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
