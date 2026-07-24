import Link from "next/link";
import { business } from "@/lib/business";

export default function BookPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold text-gold-dark">Book Appointment</h1>
      <p className="mt-4 text-text-muted">
        Online booking with payment is coming soon. For now, please email us to
        schedule your visit.
      </p>
      <a
        href={`mailto:${business.brand.email}?subject=Booking%20Request`}
        className="mt-8 inline-block rounded-full bg-gold px-8 py-3 text-sm font-medium text-white transition hover:bg-gold-dark"
      >
        Email {business.brand.email}
      </a>
      <p className="mt-6 text-sm text-text-muted">
        ${business.booking.depositAmount} deposit · Mon–Fri 9 AM–4 PM
      </p>
      <Link
        href="/services"
        className="mt-4 inline-block text-sm text-gold-dark underline"
      >
        Review services & pricing first
      </Link>
    </div>
  );
}
