"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/vaccinations", label: "Vaccination Review" },
  { href: "/admin/appointments", label: "Calendar" },
  { href: "/admin/finance", label: "Finance" },
  { href: "/admin/referrals", label: "Referrals" },
  { href: "/admin/messages", label: "Contact Customer" },
  { href: "/admin/pets", label: "Customers & Pets" },
  { href: "/admin/profile", label: "My Admin Profile" },
];

export function AdminNav({ showTeam = false }: { showTeam?: boolean }) {
  const pathname = usePathname();
  const items = showTeam
    ? [...links, { href: "/admin/team", label: "Admin Team" }]
    : links;

  return (
    <nav className="flex flex-col gap-1">
      {items.map((link) => {
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
