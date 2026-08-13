"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  className?: string;
};

export function AdminStaffSignInLink({ className }: Props) {
  const pathname = usePathname();
  const next = pathname.startsWith("/admin") ? pathname : "/admin";

  return (
    <Link
      href={`/login?next=${encodeURIComponent(next)}`}
      className={
        className ??
        "inline-flex items-center rounded-lg bg-gold px-4 py-2 text-sm font-medium text-cream transition hover:bg-gold-dark"
      }
    >
      Staff sign in
    </Link>
  );
}
