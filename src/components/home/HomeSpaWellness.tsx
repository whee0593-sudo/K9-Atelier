"use client";

import Link from "next/link";
import React, { useId, useState } from "react";
import { Container } from "@/components/luxury/Container";
import { SectionIntro } from "@/components/luxury/SectionIntro";
import {
  homeSpaWellnessIntro,
  homeSpaWellnessServices,
  spaDetailsToggleLabel,
  type HomeSpaWellnessService,
} from "@/components/home/home-spa-wellness";

type RitualProps = {
  service: HomeSpaWellnessService;
  defaultOpen?: boolean;
  className?: string;
};

export function HomeSpaRitualItem({
  service,
  defaultOpen = false,
  className = "",
}: RitualProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const label = spaDetailsToggleLabel(open);

  return (
    <article className={`min-w-0 ${className}`}>
      <h3 className="font-display text-[18px] leading-snug text-ink md:text-[1.65rem]">
        {service.title}
      </h3>
      <p className="font-body mt-3 text-[14px] leading-[1.7] text-taupe md:text-sm md:leading-relaxed">
        {service.suitability}
      </p>

      <button
        type="button"
        className="font-body mt-5 inline-flex min-h-[44px] items-center gap-1.5 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-taupe transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{label}</span>
        <span
          aria-hidden="true"
          className={`inline-block text-[10px] leading-none transition-transform duration-200 ease-out motion-reduce:transition-none ${
            open ? "rotate-180" : "rotate-0"
          }`}
        >
          ▾
        </span>
      </button>

      <div
        id={panelId}
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          open ? "mt-4 grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-w-0 overflow-hidden" inert={!open || undefined}>
          <p className="font-body text-[14px] leading-[1.7] text-taupe md:text-sm md:leading-relaxed">
            {service.details}
          </p>
        </div>
      </div>
    </article>
  );
}

export function HomeSpaWellness() {
  const intro = homeSpaWellnessIntro;

  return (
    <section className="border-b border-gray-line/60 py-14 md:py-20">
      <Container>
        <SectionIntro
          eyebrow={intro.eyebrow}
          title={intro.title}
          body={intro.body}
        />

        <div className="mt-12 grid gap-10 md:mt-14 md:grid-cols-3 md:gap-0">
          {homeSpaWellnessServices.map((service, index) => (
            <HomeSpaRitualItem
              key={service.id}
              service={service}
              className={
                index === 0
                  ? "md:pr-8 lg:pr-10"
                  : "border-t border-gray-line/70 pt-10 md:border-t-0 md:border-l md:px-8 md:pt-0 lg:px-10"
              }
            />
          ))}
        </div>

        <div className="mt-12 max-w-2xl md:mx-auto md:mt-14 md:text-center">
          <p className="font-body text-[13px] leading-relaxed text-taupe md:text-sm">
            {intro.note}
          </p>
          <Link
            href={intro.ctaHref}
            className="font-body mt-6 inline-flex min-h-[44px] items-center justify-center border border-champagne px-7 text-[11px] font-medium uppercase tracking-[0.16em] text-ink transition hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
          >
            {intro.ctaLabel}
          </Link>
        </div>
      </Container>
    </section>
  );
}
