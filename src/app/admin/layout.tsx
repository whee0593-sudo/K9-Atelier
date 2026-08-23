import { AdminChrome } from "@/components/admin/AdminChrome";
import { AdminStaffBanner } from "@/components/admin/AdminStaffBanner";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminChrome banner={<AdminStaffBanner />}>{children}</AdminChrome>
  );
}
