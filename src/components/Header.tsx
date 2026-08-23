"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { business } from "@/lib/business";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { Container } from "@/components/luxury/Container";
import { CustomerAuthLink } from "@/components/auth/CustomerAuthLink";

const navItems = [
  { href: "/#experience", label: "The Atelier" },
  { href: "/services", label: "Services" },
  { href: "/gallery", label: "Gallery" },
  { href: "/reviews", label: "Reviews" },
  { href: "/#mobile-salon", label: "Experience" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
] as const;

function NavLink({
  href,
  label,
  onNavigate,
}: {
  href: string;
  label: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="font-body text-[13px] font-medium uppercase tracking-[0.16em] text-taupe transition duration-500 hover:text-ink"
    >
      {label}
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isBooking = pathname === "/book";

  const closeMenu = () => setOpen(false);

  if (isBooking) {
    return (
      <header className="sticky top-0 z-50 border-b border-gray-line/70 bg-ivory/95 backdrop-blur-sm">
        <Container className="flex items-center justify-between gap-6 py-4 md:py-5">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <Image
              src={business.brand.logo}
              alt={business.brand.name}
              width={52}
              height={52}
              className="rounded-full"
              priority
            />
            <span className="inline whitespace-nowrap font-body text-[14px] font-semibold uppercase tracking-[0.14em] text-[#3A3236] sm:tracking-[0.2em]">
              {business.brand.name}
            </span>
          </Link>
          <p className="font-body text-[12px] font-medium uppercase tracking-[0.14em] text-taupe">
            Booking
          </p>
          <Link
            href="/contact"
            className="font-body text-[12px] font-medium uppercase tracking-[0.14em] text-taupe transition hover:text-ink"
          >
            Need Help?
          </Link>
        </Container>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-line/70 bg-ivory/95 backdrop-blur-sm">
      <Container className="flex items-center justify-between gap-6 py-4 md:py-5">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3"
          onClick={closeMenu}
        >
          <Image
            src={business.brand.logo}
            alt={business.brand.name}
            width={52}
            height={52}
            className="rounded-full"
            priority
          />
          <span className="inline whitespace-nowrap font-body text-[14px] font-semibold uppercase tracking-[0.14em] text-[#3A3236] sm:tracking-[0.2em]">
            {business.brand.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        <div className="hidden items-center gap-6 lg:flex">
          <CustomerAuthLink
            className="font-body text-[12px] font-medium uppercase tracking-[0.14em] text-taupe transition hover:text-ink"
          />
          <BookServiceLink className="inline-flex min-h-[50px] items-center justify-center rounded-sm bg-deep-lavender px-6 text-[12px] font-medium uppercase tracking-[0.16em] text-ivory transition duration-500 hover:bg-ink">
            Book an Appointment
          </BookServiceLink>
        </div>

        <button
          type="button"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm border border-gray-line lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="font-body text-[12px] font-medium uppercase tracking-[0.14em] text-ink">
            {open ? "Close" : "Menu"}
          </span>
        </button>
      </Container>

      {open && (
        <div
          id="mobile-nav"
          className="border-t border-gray-line bg-ivory lg:hidden"
        >
          <Container className="flex flex-col gap-5 py-6">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                onNavigate={closeMenu}
              />
            ))}
            <CustomerAuthLink
              onNavigate={closeMenu}
              className="font-body text-[12px] font-medium uppercase tracking-[0.14em] text-taupe"
            />
            <BookServiceLink
              onClick={closeMenu}
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded-sm bg-deep-lavender text-[12px] font-medium uppercase tracking-[0.16em] text-ivory"
            >
              Book an Appointment
            </BookServiceLink>
          </Container>
        </div>
      )}
    </header>
  );
}
