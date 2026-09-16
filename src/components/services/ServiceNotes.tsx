import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { FEES_POLICIES_PATH } from "@/lib/service-page";

export function ServiceNotes() {
  return (
    <section className="border-t border-gray-line/70 bg-ivory">
      <Container className="py-14 md:py-16">
        <div className="mx-auto max-w-xl text-center">
          <p className="font-body text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
            Service Notes
          </p>
          <div className="font-body mt-5 space-y-3 text-base leading-relaxed text-taupe">
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
            className="font-body mt-8 inline-flex min-h-[48px] items-center justify-center text-[12px] font-medium uppercase tracking-[0.16em] text-ink transition hover:text-deep-lavender focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
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
