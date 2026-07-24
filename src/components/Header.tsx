import Link from "next/link";
import Image from "next/image";
import { business } from "@/lib/business";

export function Header() {
  const nav = [
    { href: "/", label: "Home" },
    { href: "/services", label: "Services" },
    { href: "/service-area", label: "Service Area" },
    { href: "/book", label: "Book Now" },
  ];

  return (
    <header className="border-b border-lavender-light/60 bg-cream/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src={business.brand.logo}
            alt={business.brand.name}
            width={48}
            height={48}
            className="rounded-full"
          />
          <span className="text-lg font-semibold tracking-wide text-gold-dark">
            {business.brand.name}
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-text-muted transition hover:text-gold-dark"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/book"
          className="rounded-full bg-gold px-4 py-2 text-sm font-medium text-white transition hover:bg-gold-dark"
        >
          Book
        </Link>
      </div>
    </header>
  );
}
