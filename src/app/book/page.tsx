import Link from "next/link";
import { BookPetStep } from "@/components/booking/PetSelector";
import { business } from "@/lib/business";

export default function BookPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-center text-3xl font-semibold text-gold-dark">
        Book Appointment
      </h1>
      <p className="mt-4 text-center text-text-muted">
        Select a pet from your profile, then choose your service and time.
        Full online booking is coming soon.
      </p>

      <BookPetStep />

      <div className="mt-10 border-t border-lavender/30 pt-8 text-center">
        <p className="text-sm text-text-muted">
          Prefer to book by email?{" "}
          <a
            href={`mailto:${business.brand.email}?subject=Booking%20Request`}
            className="text-gold-dark underline"
          >
            {business.brand.email}
          </a>
        </p>
        <p className="mt-4 text-sm text-text-muted">
          {business.booking.paymentMethodNote} · Mon–Fri 9 AM–4 PM
        </p>
        <Link
          href="/services"
          className="mt-4 inline-block text-sm text-gold-dark underline"
        >
          Review services & pricing
        </Link>
      </div>
    </div>
  );
}
