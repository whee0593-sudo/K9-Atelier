import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { Eyebrow } from "@/components/luxury/Eyebrow";
import { FEES_POLICIES_PATH } from "@/lib/service-page";

export function ServiceNotes() {
  return (
    <section className="border-t border-gray-line/60 bg-ivory">
      <Container className="py-16 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Service Notes</Eyebrow>
          <div className="font-body mx-auto mt-5 max-w-2xl space-y-4 text-base leading-relaxed text-taupe md:text-[17px]">
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
            className="font-body mt-8 inline-flex min-h-[48px] items-center justify-center text-[11px] font-medium uppercase tracking-[0.16em] text-deep-lavender transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
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
