import Link from "next/link";
import { BookPageGate } from "@/components/booking/BookPageGate";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { ServiceFeesSection } from "@/components/ServiceFeesSection";
import { business } from "@/lib/business";

export default function BookPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-center text-3xl font-semibold text-gold-dark">
        Book Service
      </h1>

      <BookPageGate>
        <BookingFlow />
      </BookPageGate>

      <ServiceFeesSection className="mt-16 border-t border-lavender/30 pt-12" />

      <div className="mt-12 border-t border-lavender/30 pt-8 text-center">
        <p className="text-sm text-text-muted">
          {business.booking.paymentMethodNote} · Mon–Fri 9 AM–4 PM
        </p>
        <Link
          href="/services"
          className="mt-4 inline-block text-sm text-gold-dark underline"
        >
          View full services &amp; pricing
        </Link>
      </div>
    </div>
  );
}
