"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { business } from "@/lib/business";
import { Container } from "@/components/luxury/Container";
import { CustomerAuthLink } from "@/components/auth/CustomerAuthLink";

const navItems = [
  { href: "/", label: "The Atelier" },
  { href: "/services", label: "Services" },
  { href: "/gallery", label: "Gallery" },
  { href: "/reviews", label: "Reviews" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
] as const;

const navLinkBase =
  "inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-sm border-0 px-3 font-body text-[13px] font-medium uppercase tracking-[0.16em] transition duration-500 xl:px-4";

const menuBtnClass =
  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm border-0 px-2 font-body text-[12px] font-medium uppercase tracking-[0.14em] transition duration-500 md:px-4";

function isNavItemActive(href: string, pathname: string) {
  const path = href.split("#")[0];
  if (!path || path === "/") {
    return false;
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

function NavLink({
  href,
  label,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  active?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? `${navLinkBase} bg-deep-lavender text-ivory`
          : `${navLinkBase} bg-transparent text-taupe hover:bg-dusty-lavender/40 hover:text-ink`
      }
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

  return (
    <header className="sticky top-0 z-50 border-b border-gray-line/70 bg-ivory/95 backdrop-blur-sm">
      <Container className="flex items-center justify-between gap-3 py-2 md:gap-4 md:py-3 xl:gap-6">
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center"
          onClick={closeMenu}
        >
          <Image
            src={business.brand.logo}
            alt={business.brand.name}
            width={1495}
            height={764}
            className="h-auto w-auto max-h-[4.5rem] max-w-[calc(100vw-15rem)] sm:max-h-20 sm:max-w-none md:max-h-[5.5rem] xl:max-h-[7rem]"
            priority
          />
        </Link>

        {isBooking ? (
          <p className="hidden font-body text-[12px] font-medium uppercase tracking-[0.14em] text-taupe min-[400px]:inline">
            Booking
          </p>
        ) : (
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={isNavItemActive(item.href, pathname)}
              />
            ))}
          </nav>
        )}

        {isBooking ? (
          <button
            type="button"
            className={
              open
                ? `${menuBtnClass} bg-deep-lavender text-ivory`
                : `${menuBtnClass} bg-transparent text-ink hover:bg-dusty-lavender/40`
            }
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Close" : "Menu"}
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <CustomerAuthLink className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-sm bg-deep-lavender px-4 text-[12px] font-medium uppercase tracking-[0.12em] text-ivory transition duration-500 hover:bg-ink md:min-h-[50px] md:px-6 md:tracking-[0.16em]" />
            <button
              type="button"
              className={
                open
                  ? `${menuBtnClass} bg-deep-lavender text-ivory lg:hidden`
                  : `${menuBtnClass} bg-transparent text-ink hover:bg-dusty-lavender/40 lg:hidden`
              }
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "Close" : "Menu"}
            </button>
          </div>
        )}
      </Container>

      {open && (
        <div
          id="mobile-nav"
          className={
            isBooking
              ? "border-t border-gray-line bg-ivory"
              : "border-t border-gray-line bg-ivory lg:hidden"
          }
        >
          <Container className="flex flex-col gap-5 py-6">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={isNavItemActive(item.href, pathname)}
                onNavigate={closeMenu}
              />
            ))}
            {isBooking ? (
              <NavLink
                href="/contact"
                label="Need Help?"
                active={isNavItemActive("/contact", pathname)}
                onNavigate={closeMenu}
              />
            ) : null}
          </Container>
        </div>
      )}
    </header>
  );
}
