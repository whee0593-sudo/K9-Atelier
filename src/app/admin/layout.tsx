import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-6 rounded-xl border border-gold/40 bg-lavender-light/50 px-4 py-3 text-sm text-gold-dark">
        Admin area — not linked on the public site. Sign in required when live.{" "}
        <Link href="/login/admin" className="underline">
          Admin login
        </Link>
      </div>

      <div className="grid gap-10 md:grid-cols-[220px_1fr]">
        <aside>
          <h1 className="mb-4 text-xl font-semibold text-gold-dark">
            K9 Atelier Admin
          </h1>
          <AdminNav />
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
