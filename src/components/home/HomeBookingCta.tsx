import React from "react";
import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { PhoneIcon } from "@/components/icons/PhoneIcon";
import { business } from "@/lib/business";

const buttonClass = "inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-sm bg-ivory px-8 text-base font-semibold text-deep-lavender focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ivory sm:w-auto";

export function HomeBookingCta() {
  return (
    <section aria-labelledby="home-booking-heading" className="bg-deep-lavender py-10 text-ivory md:py-12">
      <Container className="flex flex-col items-center justify-between gap-6 text-center lg:flex-row lg:text-left">
        <h2 id="home-booking-heading" className="font-display text-3xl font-semibold !text-ivory md:text-4xl">
          Private care. At your doorstep.
        </h2>
        <div className="flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row sm:gap-7">
          <BookServiceLink className={buttonClass}>Book Online</BookServiceLink>
          <Link href={`tel:${business.brand.phone}`} className={buttonClass}>
            <PhoneIcon />
            {business.brand.phoneDisplay}
          </Link>
        </div>
      </Container>
    </section>
  );
}
