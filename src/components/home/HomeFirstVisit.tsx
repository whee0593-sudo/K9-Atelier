import React from "react";
import { Container } from "@/components/luxury/Container";
import { homeFirstVisitSteps } from "@/components/home/home-first-visit";

export function HomeFirstVisit() {
  return (
    <section
      id="first-visit"
      className="scroll-mt-24 bg-dusty-lavender py-12 md:py-16"
    >
      <Container>
        <h2 className="font-display text-center text-4xl font-semibold text-ink md:text-5xl">Your First Visit</h2>

        <ol className="mt-10 grid list-none gap-8 p-0 md:mt-14 md:grid-cols-4 md:gap-8">
          {homeFirstVisitSteps.map((step) => (
            <li
              key={step.number}
              className="relative pl-14 text-left md:border-l md:border-deep-lavender/25 md:pl-5"
            >
              <p className="font-body absolute top-0 left-0 flex h-10 w-10 items-center justify-center rounded-full bg-deep-lavender/10 text-base font-semibold text-deep-lavender md:static">
                {step.number}
              </p>
              <h3 className="font-display text-2xl font-semibold text-ink md:mt-3">
                {step.title}
              </h3>
              <p className="font-body mt-2 text-base leading-relaxed text-ink">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

      </Container>
    </section>
  );
}
