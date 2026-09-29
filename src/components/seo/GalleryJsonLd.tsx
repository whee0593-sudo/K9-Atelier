import React from "react";
import {
  GALLERY_PAGE_CANONICAL,
  GALLERY_PAGE_DESCRIPTION,
  GALLERY_PAGE_TITLE,
} from "@/lib/gallery-page";

const HOME_URL = "https://k9atelier.com/";

export function GalleryJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${GALLERY_PAGE_CANONICAL}#breadcrumb`,
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
            name: "Gallery",
            item: GALLERY_PAGE_CANONICAL,
          },
        ],
      },
      {
        "@type": "WebPage",
        "@id": GALLERY_PAGE_CANONICAL,
        url: GALLERY_PAGE_CANONICAL,
        name: GALLERY_PAGE_TITLE,
        description: GALLERY_PAGE_DESCRIPTION,
        breadcrumb: { "@id": `${GALLERY_PAGE_CANONICAL}#breadcrumb` },
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
