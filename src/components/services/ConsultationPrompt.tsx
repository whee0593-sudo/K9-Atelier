import Link from "next/link";
import { Container } from "@/components/luxury/Container";
import { Eyebrow } from "@/components/luxury/Eyebrow";
import {
  servicesBodyClass,
  servicesCtaClass,
  servicesSectionTitleClass,
} from "@/components/services/services-type";
import { CONSULTATION_PATH } from "@/lib/service-page";

export function ConsultationPrompt() {
  return (
    <section className="border-t border-gray-line/60 bg-ivory">
      <Container className="py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Not Sure Where to Start?</Eyebrow>
          <h2 className={servicesSectionTitleClass}>
            A More Personal Recommendation
          </h2>
          <p className={`${servicesBodyClass} mx-auto mt-6 max-w-xl`}>
            Tell me a little about your dog and I’ll help you choose the care
            that suits them best.
          </p>
          <Link
            href={CONSULTATION_PATH}
            className={`${servicesCtaClass} mt-8 px-2 leading-relaxed transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne`}
          >
            <span className="text-center">
              Request a Complimentary Consultation
              <span aria-hidden="true"> →</span>
            </span>
          </Link>
        </div>
      </Container>
    </section>
  );
}
