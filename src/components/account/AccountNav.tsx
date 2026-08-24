"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { accountConfig } from "@/lib/account-fields";

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      <Link
        href="/account"
        className={`rounded-lg px-4 py-2.5 text-sm transition ${
          pathname === "/account"
            ? "bg-lavender-light font-medium text-gold-dark"
            : "text-text-muted hover:bg-lavender-light/60 hover:text-text"
        }`}
      >
        Overview
      </Link>
      {accountConfig.sections.map((section) => (
        <Link
          key={section.id}
          href={section.path}
          className={`rounded-lg px-4 py-2.5 text-sm transition ${
            pathname === section.path ||
            (section.id === "bookings" &&
              pathname.startsWith("/account/appointments/"))
              ? "bg-lavender-light font-medium text-gold-dark"
              : "text-text-muted hover:bg-lavender-light/60 hover:text-text"
          }`}
        >
          {section.title}
        </Link>
      ))}
    </nav>
  );
}
