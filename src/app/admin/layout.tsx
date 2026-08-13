import { AdminNav } from "@/components/admin/AdminNav";
import { AdminStaffBanner } from "@/components/admin/AdminStaffBanner";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <AdminStaffBanner />

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
