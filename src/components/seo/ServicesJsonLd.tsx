import React from "react";
import {
  SERVICES_PAGE_CANONICAL,
  SERVICES_PAGE_DESCRIPTION,
  SERVICES_PAGE_TITLE,
} from "@/lib/service-page";

const HOME_URL = "https://k9atelier.com/";

export function ServicesJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${SERVICES_PAGE_CANONICAL}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: HOME_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Services",
            item: SERVICES_PAGE_CANONICAL,
          },
        ],
      },
      {
        "@type": "WebPage",
        "@id": SERVICES_PAGE_CANONICAL,
        url: SERVICES_PAGE_CANONICAL,
        name: SERVICES_PAGE_TITLE,
        description: SERVICES_PAGE_DESCRIPTION,
        breadcrumb: { "@id": `${SERVICES_PAGE_CANONICAL}#breadcrumb` },
        isPartOf: { "@id": "https://k9atelier.com/#website" },
        about: { "@id": "https://k9atelier.com/#business" },
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
