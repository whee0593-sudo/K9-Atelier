import React from "react";
import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { LONG_COAT_CARE_PATH } from "@/lib/long-coat-care-page";
import {
  SERVICE_CATEGORIES,
  SERVICES_DIRECTORY_DESCRIPTIONS,
  directoryPriceLabel,
  type ServiceCategory,
} from "@/lib/service-page";

const cardClass =
  "group flex h-full w-full flex-col border border-gray-line bg-ivory px-7 py-8 transition duration-500 hover:border-champagne focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne motion-reduce:transition-none md:px-8 md:py-9";

const titleClass =
  "font-display text-[1.75rem] leading-[1.15] font-medium text-ink md:text-3xl";

const descriptionClass = "font-body mt-3 text-base leading-[1.65] text-taupe";

const priceClass =
  "font-body mt-5 min-h-[1.5rem] text-base font-medium tracking-[0.01em] text-ink md:min-h-[1.7rem] md:text-[17px]";

const exploreClass =
  "font-body mt-auto inline-flex min-h-[48px] items-center pt-7 text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition duration-500 group-hover:text-ink motion-reduce:transition-none md:pt-8";

function ExploreLabel() {
  return (
    <span className={exploreClass}>
      Explore
      <span
        aria-hidden="true"
        className="ml-1.5 inline-block transition-transform duration-500 group-hover:translate-x-1 motion-reduce:transition-none"
      >
        →
      </span>
    </span>
  );
}

function PriceLine({ price }: { price: string | null }) {
  if (!price) {
    return <div className="mt-5 min-h-[1.5rem] md:min-h-[1.7rem]" aria-hidden="true" />;
  }

  return <p className={priceClass}>{price}</p>;
}

function DirectoryCard({ category }: { category: ServiceCategory }) {
  const price = directoryPriceLabel(category);
  const description = SERVICES_DIRECTORY_DESCRIPTIONS[category.slug];

  if (category.slug !== "bath-coat-care") {
    return (
      <Link href={category.path} className={cardClass}>
        <h2 className={titleClass}>{category.directoryName}</h2>
        <p className={descriptionClass}>{description}</p>
        <PriceLine price={price} />
        <ExploreLabel />
      </Link>
    );
  }

  return (
    <div className={`relative ${cardClass}`}>
      <h2 className={titleClass}>
        <Link
          href={category.path}
          className="after:absolute after:inset-0 after:z-[1] after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-champagne"
        >
          {category.directoryName}
        </Link>
      </h2>
      <p className={descriptionClass}>{description}</p>
      <Link
        href={LONG_COAT_CARE_PATH}
        className="font-body relative z-[2] mt-4 inline-flex min-h-12 max-w-full items-center self-start text-left text-sm leading-snug text-deep-lavender underline decoration-champagne/70 underline-offset-4 transition duration-500 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne motion-reduce:transition-none"
      >
        Show-Level Long-Coat Care
      </Link>
      <PriceLine price={price} />
      <ExploreLabel />
    </div>
  );
}

export function ServiceDirectory() {
  return (
    <section aria-label="Service directory" className="bg-ivory pb-20 pt-2 md:pb-24 md:pt-3 lg:pb-28">
      <Container>
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-10">
          {SERVICE_CATEGORIES.map((category) => (
            <li
              key={category.slug}
              className="min-h-0 w-full md:last:col-span-2 md:last:w-[calc((100%-2rem)/2)] md:last:justify-self-center lg:last:col-span-1 lg:last:col-start-2 lg:last:w-auto lg:last:justify-self-stretch"
            >
              <DirectoryCard category={category} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
