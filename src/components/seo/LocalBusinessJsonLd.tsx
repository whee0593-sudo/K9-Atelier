import { business, getBrandPhoneTelHref, getBrandSearchName, getCommunitiesServedLabel } from "@/lib/business";
import { reviews } from "@/lib/reviews";

function e164Phone() {
  const href = getBrandPhoneTelHref();
  return href ? href.replace("tel:", "") : undefined;
}

export function LocalBusinessJsonLd() {
  const { brand, booking, serviceArea } = business;
  const communities = getCommunitiesServedLabel()
    .split(" · ")
    .map((name) => name.trim())
    .filter(Boolean);
  const sameAs = [
    brand.social.facebookUrl,
    business.site.underConstruction?.instagramUrl,
    brand.google.businessProfileUrl,
  ].filter((url): url is string => Boolean(url));

  const searchName = getBrandSearchName();
  const siteId = `${brand.website.replace(/\/$/, "")}/#website`;
  const businessId = `${brand.website.replace(/\/$/, "")}/#business`;

  const localBusiness: Record<string, unknown> = {
    "@type": "PetGroomer",
    "@id": businessId,
    name: searchName,
    alternateName: brand.name,
    slogan: brand.tagline,
    description: brand.intro,
    url: brand.website,
    image: `${brand.website}${brand.logo}`,
    email: brand.email,
    telephone: e164Phone(),
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      addressLocality: serviceArea.publicLocality,
      addressRegion: serviceArea.publicRegion,
      addressCountry: "US",
    },
    areaServed: communities.map((name) => ({
      "@type": "City",
      name,
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

  if (reviews.items.length > 0) {
    const rated = reviews.items.filter(
      (item) => typeof item.rating === "number",
    );
    if (rated.length > 0) {
      const average =
        rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) / rated.length;
      localBusiness.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: Number(average.toFixed(1)),
        reviewCount: rated.length,
        bestRating: 5,
        worstRating: 1,
      };
    }
    localBusiness.review = reviews.items.map((item) => ({
      "@type": "Review",
      reviewBody: item.quote,
      author: { "@type": "Person", name: item.name },
      ...(typeof item.rating === "number"
        ? {
            reviewRating: {
              "@type": "Rating",
              ratingValue: item.rating,
              bestRating: 5,
              worstRating: 1,
            },
          }
        : {}),
    }));
  }

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
