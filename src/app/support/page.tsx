import Link from "next/link";
import { business } from "@/lib/business";

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold text-gold-dark">Support</h1>
      <p className="mt-6 text-text-muted">
        Questions about booking, services, or your appointment? We&apos;re here
        to help.
      </p>
      <a
        href={`mailto:${business.brand.email}`}
        className="mt-8 inline-block rounded-2xl bg-gold px-8 py-4 text-lg font-medium text-white transition hover:bg-gold-dark"
      >
        Email {business.brand.email}
      </a>
      <Link href="/" className="mt-6 block text-sm text-gold-dark underline">
        Back to Home
      </Link>
    </div>
  );
}
