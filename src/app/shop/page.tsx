import Link from "next/link";
import { business } from "@/lib/business";

export default function ShopPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold text-gold-dark">Online Shop</h1>
      <p className="mt-6 leading-relaxed text-text-muted">
        Our online shop is coming soon. Browse grooming products and add-ons
        from the comfort of home.
      </p>
      <p className="mt-4 text-sm text-text-muted">
        Need grooming now? Book a mobile visit — we come to you.
      </p>
      <Link
        href="/login?next=/book"
        className="mt-10 inline-block rounded-2xl bg-gold px-8 py-4 text-lg font-medium text-white transition hover:bg-gold-dark"
      >
        Book Mobile Grooming
      </Link>
      <Link
        href="/"
        className="mt-6 text-sm text-gold-dark underline"
      >
        Back to Home
      </Link>
    </div>
  );
}
