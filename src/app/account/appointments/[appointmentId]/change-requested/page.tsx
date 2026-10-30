import Link from "next/link";
import { bookingPrimaryBtnClass } from "@/components/booking/booking-ui";

export default function AppointmentChangeRequestedPage() {
  return <section className="space-y-5 rounded-2xl border border-lavender/30 bg-cream p-6 md:p-8">
    <h2 className="text-2xl font-semibold text-gold-dark">Thank you for letting us know!</h2>
    <p className="text-sm leading-relaxed text-text">We’ll review the day’s schedule and text you once the change has been confirmed.</p>
    <Link href="/account/bookings" className={bookingPrimaryBtnClass}>Back to appointments</Link>
  </section>;
}
