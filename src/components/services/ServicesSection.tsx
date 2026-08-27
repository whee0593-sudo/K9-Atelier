import type { ReactNode } from "react";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { Container } from "@/components/luxury/Container";
import { Eyebrow } from "@/components/luxury/Eyebrow";

type Props = {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  tone?: "ivory" | "white" | "mist";
  children: ReactNode;
  showRequestLink?: boolean;
};

const tones = {
  ivory: "bg-ivory",
  white: "bg-white/60",
  mist: "bg-dusty-lavender/15",
};

export function ServicesSection({
  id,
  eyebrow,
  title,
  intro,
  tone = "ivory",
  children,
  showRequestLink = true,
}: Props) {
  return (
    <section id={id} className={`scroll-mt-40 ${tones[tone]} py-14 md:py-16`}>
      <Container>
        <header className="mx-auto max-w-2xl text-center">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
            {title}
          </h2>
          {intro && (
            <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
              {intro}
            </p>
          )}
        </header>
        <div className="mt-10">{children}</div>
        {showRequestLink && (
          <p className="mt-10 text-center">
            <BookServiceLink className="font-body inline-flex min-h-[44px] items-center text-[10px] font-medium uppercase tracking-[0.16em] text-taupe transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne">
              Request This Service
            </BookServiceLink>
          </p>
        )}
      </Container>
    </section>
  );
}
