import { AdminChrome } from "@/components/admin/AdminChrome";
import { AdminStaffBanner } from "@/components/admin/AdminStaffBanner";
import { isOwnerUser } from "@/lib/staff/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const showTeam = await isOwnerUser();
  return (
    <AdminChrome banner={<AdminStaffBanner />} showTeam={showTeam}>
      {children}
    </AdminChrome>
  );
}
