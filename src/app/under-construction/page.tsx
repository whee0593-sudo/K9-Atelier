import Image from "next/image";
import Link from "next/link";
import { business } from "@/lib/business";

export default function UnderConstructionPage() {
  const copy = business.site?.underConstruction;

  return (
    <section className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16 text-center">
      <Image
        src={business.brand.logo}
        alt={business.brand.name}
        width={220}
        height={220}
        className="rounded-full shadow-md ring-4 ring-lavender-light"
        priority
      />

      <h1 className="mt-10 text-3xl font-semibold text-gold-dark">
        {copy?.title ?? "Website Under Construction"}
      </h1>

      <p className="mt-6 max-w-lg text-base leading-relaxed text-text-muted">
        {copy?.message ??
          "We are preparing something special. Please check back soon."}
      </p>

      <p className="mt-8 text-sm text-text-muted">
        {copy?.contactLabel ?? "Questions? Email us anytime."}
      </p>
      <a
        href={`mailto:${business.brand.email}`}
        className="mt-2 text-sm font-medium text-gold-dark underline"
      >
        {business.brand.email}
      </a>

      <Link
        href="/login/admin"
        className="mt-12 text-xs text-text-muted underline opacity-70 transition hover:opacity-100"
      >
        Team login
      </Link>
    </section>
  );
}
