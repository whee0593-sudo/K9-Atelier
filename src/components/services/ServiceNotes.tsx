import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { Eyebrow } from "@/components/luxury/Eyebrow";
import {
  servicesBodyClass,
  servicesCtaClass,
} from "@/components/services/services-type";
import { FEES_POLICIES_PATH } from "@/lib/service-page";

export function ServiceNotes() {
  return (
    <section className="border-t border-gray-line/60 bg-ivory">
      <Container className="py-20 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Service Notes</Eyebrow>
          <div
            className={`${servicesBodyClass} mx-auto mt-6 max-w-xl space-y-5`}
          >
            <p>
              Starting prices may vary based on coat condition, temperament,
              styling requirements and time.
            </p>
            <p>Dogs up to 45 lbs · By appointment only</p>
            <p>
              Travel fees may apply outside the complimentary service area.
            </p>
          </div>
          <Link
            href={FEES_POLICIES_PATH}
            className={`${servicesCtaClass} mt-8 justify-center transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne`}
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
