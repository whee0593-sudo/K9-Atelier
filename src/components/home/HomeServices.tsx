import React from "react";
import Link from "next/link";
import { Container } from "@/components/luxury/Container";

export const homeServicesHeading = "Grooming, tailored to the individual.";
export const homeServicesCopy =
  "From precision haircuts and coat care to traditional hand stripping, each appointment is tailored to the dog\u2019s coat, comfort and individual needs.";

export const homeServiceLinks = [
  { name: "Full Grooming", href: "/services/full-groom" },
  { name: "Bath & Coat Care", href: "/services/bath-coat-care" },
  { name: "Hand Stripping", href: "/services/hand-stripping" },
] as const;

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

        <ul className="mt-10 grid list-none gap-4 p-0 md:mt-14 md:grid-cols-3 md:gap-8">
          {homeServiceLinks.map((service) => (
            <li key={service.href} className="min-w-0">
              <Link
                href={service.href}
                className="flex h-full min-h-[52px] items-center justify-center border border-gray-line/80 bg-ivory px-5 py-6 text-center font-display text-[1.5rem] leading-[1.2] font-medium text-balance text-ink transition duration-500 hover:border-champagne focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne motion-reduce:transition-none md:px-6 md:py-8 md:text-[1.75rem]"
              >
                {service.name}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
