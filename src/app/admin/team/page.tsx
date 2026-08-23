import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminTeamPanel } from "@/components/admin/AdminTeamPanel";
import { getOwnerSession, getStaffSession } from "@/lib/staff/auth";

export default async function AdminTeamPage() {
  const staffSession = await getStaffSession();
  if ("error" in staffSession) {
    if (staffSession.error === "unauthenticated") {
      redirect("/login?next=/admin/team");
    }
    return (
      <div>
        <h2 className="text-2xl font-semibold text-gold-dark">Admin Team</h2>
        <div className="mt-8 rounded-2xl border border-lavender/30 bg-cream p-6">
          <p className="text-sm text-text">
            Staff access is required to view this page.
          </p>
          <Link
            href="/login?next=/admin/team"
            className="mt-4 inline-block text-sm font-medium text-gold-dark underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const ownerSession = await getOwnerSession();
  if ("error" in ownerSession) {
    return (
      <div>
        <h2 className="text-2xl font-semibold text-gold-dark">Admin Team</h2>
        <div className="mt-8 rounded-2xl border border-lavender/30 bg-cream p-6">
          <p className="text-sm text-text">
            Only the owner can add or remove admin accounts.
          </p>
          <p className="mt-2 text-sm text-text-muted">
            Ask Penny at penny@k9atelier.com if you need admin access for
            someone else.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">Admin Team</h2>
      <p className="mt-2 text-sm text-text-muted">
        You are the owner. New admins stay pending until you confirm them.
      </p>
      <div className="mt-8">
        <AdminTeamPanel />
      </div>
    </div>
  );
}
