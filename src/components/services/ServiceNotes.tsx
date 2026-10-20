import React from "react";
import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { FEES_POLICIES_PATH } from "@/lib/service-page";

export function ServiceNotes() {
  return (
    <section className="border-t border-gray-line/40 bg-ivory">
      <Container className="py-8 md:py-10">
        <div className="mx-auto max-w-[32rem] text-center">
          <p className="font-body mb-3 text-base text-ink">
            Dogs up to 45 lbs · By appointment only
          </p>
          <Link
            href={FEES_POLICIES_PATH}
            className="font-body inline-flex min-h-[48px] items-center justify-center text-sm font-medium uppercase tracking-[0.12em] text-deep-lavender transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
          >
            View Fees &amp; Policies
            <span aria-hidden="true" className="ml-1.5">
              →
            </span>
          </Link>
        </div>
      </Container>
    </section>
  );
}
