import React from "react";
import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import {
  SERVICE_CATEGORIES,
  directoryPriceLabel,
  type ServiceCategory,
} from "@/lib/service-page";

export const homeServicesHeading = "Grooming, tailored to the individual.";
export const homeServicesCopy =
  "From precision haircuts and coat care to traditional hand stripping, each appointment is tailored to the dog\u2019s coat, comfort and individual needs.";

const HOME_SERVICE_SLUGS = [
  "full-groom",
  "bath-coat-care",
  "hand-stripping",
  "spa",
  "color",
  "specialty-care",
] as const;

export const homeServiceLinks = HOME_SERVICE_SLUGS.map((slug) => {
  const category = SERVICE_CATEGORIES.find((item) => item.slug === slug);
  if (!category) {
    throw new Error(`Missing homepage service category: ${slug}`);
  }
  return category;
});

function HomeServiceCard({ category }: { category: ServiceCategory }) {
  const price = directoryPriceLabel(category);

  return (
    <li className="min-w-0">
      <Link
        href={category.path}
        className="group flex h-full w-full flex-col border border-gray-line bg-ivory px-7 py-8 text-left transition duration-500 hover:border-champagne focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne motion-reduce:transition-none md:px-8 md:py-9"
      >
        <h3 className="font-display text-[1.75rem] leading-[1.15] font-medium text-ink md:text-3xl">
          {category.directoryName}
        </h3>
        <p className="font-body mt-3 text-base leading-[1.65] text-taupe">
          {category.directoryDescription}
        </p>
        {price ? (
          <p className="font-body mt-5 min-h-[1.5rem] text-base font-medium tracking-[0.01em] text-ink md:min-h-[1.7rem] md:text-[17px]">
            {price}
          </p>
        ) : (
          <div className="mt-5 min-h-[1.5rem] md:min-h-[1.7rem]" aria-hidden="true" />
        )}
        <span className="font-body mt-auto inline-flex min-h-[48px] items-center pt-7 text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition duration-500 group-hover:text-ink motion-reduce:transition-none md:pt-8">
          Explore
          <span
            aria-hidden="true"
            className="ml-1.5 inline-block transition-transform duration-500 group-hover:translate-x-1 motion-reduce:transition-none"
          >
            →
          </span>
        </span>
      </Link>
    </li>
  );
}

export function HomeServices() {
  return (
    <section
      aria-labelledby="home-services-heading"
      className="border-b border-gray-line/60 py-16 md:py-20"
    >
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h2
            id="home-services-heading"
            className="font-display text-pretty text-[2.625rem] leading-[1.08] font-medium text-ink md:text-5xl lg:text-[3.5rem]"
          >
            {homeServicesHeading}
          </h2>
          <p className="font-body mt-5 text-pretty text-base leading-relaxed text-taupe md:text-[17px]">
            {homeServicesCopy}
          </p>
        </div>

        <ul className="mt-10 grid list-none grid-cols-1 gap-6 p-0 md:mt-14 md:grid-cols-2 md:gap-8 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-10">
          {homeServiceLinks.map((category) => (
            <HomeServiceCard key={category.slug} category={category} />
          ))}
        </ul>
      </Container>
    </section>
  );
}
