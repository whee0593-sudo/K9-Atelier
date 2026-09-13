import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/AdminChrome";
import { AdminStaffBanner } from "@/components/admin/AdminStaffBanner";
import { AdminStaffSignInLink } from "@/components/admin/AdminStaffSignInLink";
import { readRequestPathname } from "@/lib/request-path";
import { getStaffSession, isOwnerUser } from "@/lib/staff/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStaffSession();
  const pathname = await readRequestPathname("/admin");
  const next = pathname.startsWith("/admin") ? pathname : "/admin";

  if ("error" in session) {
    if (session.error === "unauthenticated") {
      redirect(`/login?next=${next}`);
    }

    return (
      <AdminChrome banner={<AdminStaffBanner />} showTeam={false}>
        <StaffAccessRequired />
      </AdminChrome>
    );
  }

  const showTeam = await isOwnerUser();
  return (
    <AdminChrome banner={<AdminStaffBanner />} showTeam={showTeam}>
      {children}
    </AdminChrome>
  );
}

function StaffAccessRequired() {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">Staff only</h2>
      <div className="mt-8 rounded-2xl border border-lavender/30 bg-cream p-6">
        <p className="text-sm text-text">
          Staff access is required to use admin tools.
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Sign in with your team email. If you already signed in, Penny may
          still need to confirm this admin account.
        </p>
        <div className="mt-4">
          <AdminStaffSignInLink />
        </div>
      </div>
    </div>
  );
}
