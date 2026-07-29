"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/messages", label: "Customer Messages" },
  { href: "/admin/pets", label: "Pet Service Notes" },
  { href: "/admin/profile", label: "My Admin Profile" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => {
        const active =
          link.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-4 py-2.5 text-sm transition ${
              active
                ? "bg-lavender-light font-medium text-gold-dark"
                : "text-text-muted hover:bg-lavender-light/60 hover:text-text"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
