import Link from "next/link";
import Image from "next/image";
import { business } from "@/lib/business";

export default function HomePage() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <Image
        src={business.brand.logo}
        alt={business.brand.name}
        width={200}
        height={200}
        className="rounded-full shadow-md ring-4 ring-lavender-light"
        priority
      />

      <div className="mt-12 flex w-full max-w-4xl items-stretch justify-between gap-6 px-2">
        <Link
          href="/book"
          className="flex min-h-[5rem] flex-1 items-center justify-center rounded-2xl bg-gold px-6 py-6 text-xl font-medium text-white shadow-sm transition hover:bg-gold-dark"
        >
          Book Service
        </Link>
        <Link
          href="/shop"
          className="flex min-h-[5rem] flex-1 items-center justify-center rounded-2xl border-2 border-gold bg-cream px-6 py-6 text-xl font-medium text-gold-dark shadow-sm transition hover:bg-lavender-light"
        >
          Online Shop
        </Link>
      </div>
    </section>
  );
}
