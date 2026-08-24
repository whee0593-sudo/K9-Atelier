"use client";

import { usePathname } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";

export function AdminChrome({
  banner,
  children,
  showTeam = false,
}: {
  banner: React.ReactNode;
  children: React.ReactNode;
  showTeam?: boolean;
}) {
  const pathname = usePathname();
  if (
    pathname.startsWith("/admin/collect") ||
    pathname.startsWith("/admin/arrive") ||
    pathname === "/admin/appointments/preview/on-the-way" ||
    pathname === "/admin/appointments/preview/change"
  ) {
    return (
      <div className="min-h-screen bg-[#F8F4ED] px-5 py-10">
        {children}
      </div>
    );
  }

  const hideBanner =
    pathname === "/admin/appointments/preview" ||
    pathname === "/admin/finance/preview";

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {hideBanner ? null : banner}
      <div className="grid gap-10 md:grid-cols-[220px_1fr]">
        <aside>
          <h1 className="mb-4 text-xl font-semibold text-gold-dark">
            K9 Atelier Admin
          </h1>
          <AdminNav showTeam={showTeam} />
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
