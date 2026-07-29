"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { business } from "@/lib/business";
import { ShareButton } from "@/components/ShareButton";

function TopActions() {
  return (
    <div className="flex items-center gap-4">
      <Link
        href="/support"
        className="text-xs font-medium text-text-muted transition hover:text-gold-dark"
      >
        Support
      </Link>
      <ShareButton />
      <Link
        href="/login"
        className="text-sm font-medium text-gold-dark transition hover:text-gold"
      >
        Login
      </Link>
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  if (isHome) {
    return (
      <header className="absolute top-0 left-0 right-0 z-10 flex items-start justify-between p-6">
        <p className="text-lg font-medium text-gold-dark">Welcome!</p>
        <TopActions />
      </header>
    );
  }

  const nav = [
    { href: "/", label: "Home" },
    { href: "/services", label: "Services" },
    { href: "/book", label: "Book" },
    { href: "/shop", label: "Shop" },
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
        <TopActions />
      </div>
    </header>
  );
}
