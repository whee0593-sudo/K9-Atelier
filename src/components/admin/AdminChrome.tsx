"use client";

import { usePathname } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";

export function AdminChrome({
  banner,
  children,
  showTeam = false,
  unreadCount = 0,
}: {
  banner: React.ReactNode;
  children: React.ReactNode;
  showTeam?: boolean;
  unreadCount?: number;
}) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin/communication")) {
    return (
      <div className="min-h-[100dvh] bg-ivory md:bg-[#F8F4ED]">
        <div className="mx-auto grid min-h-[100dvh] w-full max-w-5xl md:grid-cols-[220px_minmax(0,1fr)] md:gap-8 md:px-6 md:py-8">
          <aside className="hidden md:block">
            <h1 className="mb-4 text-xl font-semibold text-gold-dark">
              K9 Atelier Admin
            </h1>
            <AdminNav showTeam={showTeam} unreadCount={unreadCount} />
          </aside>
          <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col bg-ivory md:min-h-0 md:overflow-hidden md:rounded-3xl md:border md:border-lavender/30">
            {children}
          </div>
        </div>
      </div>
    );
  }
  if (
    pathname.startsWith("/admin/collect") ||
    pathname.startsWith("/admin/arrive") ||
    pathname === "/admin/appointments/preview/on-the-way" ||
    pathname === "/admin/appointments/preview/change" ||
    pathname === "/admin/appointments/preview/change-emails"
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
          <AdminNav showTeam={showTeam} unreadCount={unreadCount} />
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
