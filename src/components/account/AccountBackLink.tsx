"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AccountBackLink() {
  const pathname = usePathname();
  if (
    pathname === "/account" ||
    pathname.startsWith("/account/appointments/")
  ) {
    return null;
  }

  return (
    <Link
      href="/account"
      className="mb-5 inline-flex min-h-[44px] items-center text-sm text-text-muted underline hover:text-text md:hidden"
    >
      Back to account
    </Link>
  );
}
