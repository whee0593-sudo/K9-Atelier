import React from "react";
import { business } from "@/lib/business";
import {
  ABOUT_PAGE_CANONICAL,
  ABOUT_PAGE_DESCRIPTION,
  ABOUT_PAGE_TITLE,
} from "@/lib/about-page";

const HOME_URL = "https://k9atelier.com/";

export function AboutJsonLd() {
  const { brand } = business;
  const origin = brand.website.replace(/\/$/, "");
  const businessId = `${origin}/#business`;
  const siteId = `${origin}/#website`;
  const personId = `${ABOUT_PAGE_CANONICAL}#penny`;
  const breadcrumbId = `${ABOUT_PAGE_CANONICAL}#breadcrumb`;

  // Same official profiles already published on the shared business entity.
  const sameAs = [
    brand.social.facebookUrl,
    business.site.underConstruction?.instagramUrl,
    brand.google.businessProfileUrl,
  ].filter((url): url is string => Boolean(url));

  const person: Record<string, unknown> = {
    "@type": "Person",
    "@id": personId,
    name: "Penny",
    url: ABOUT_PAGE_CANONICAL,
    jobTitle: "Professional Groomer",
    worksFor: { "@id": businessId },
  };

  if (sameAs.length > 0) person.sameAs = sameAs;

  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
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
            name: "About",
            item: ABOUT_PAGE_CANONICAL,
          },
        ],
      },
      {
        "@type": "WebPage",
        "@id": ABOUT_PAGE_CANONICAL,
        url: ABOUT_PAGE_CANONICAL,
        name: ABOUT_PAGE_TITLE,
        description: ABOUT_PAGE_DESCRIPTION,
        breadcrumb: { "@id": breadcrumbId },
        isPartOf: { "@id": siteId },
        mainEntity: { "@id": personId },
      },
      person,
      {
        "@id": businessId,
        founder: { "@id": personId },
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
