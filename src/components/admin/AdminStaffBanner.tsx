import Link from "next/link";
import { AdminStaffSignInLink } from "@/components/admin/AdminStaffSignInLink";
import { ExitPreviewButton } from "@/components/auth/ExitPreviewButton";
import { requireAuthenticatedUser } from "@/lib/pets/auth";
import { getStaffSession } from "@/lib/staff/auth";
import { getStaffAccessForEmail } from "@/lib/staff/team";

export async function AdminStaffBanner() {
  const session = await getStaffSession();

  if (!("error" in session)) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/40 bg-lavender-light/50 px-4 py-3 text-sm text-gold-dark">
        <p>
          Signed in as{" "}
          <span className="font-medium">{session.user.email}</span>
        </p>
        <ExitPreviewButton />
      </div>
    );
  }

  const user = await requireAuthenticatedUser();

  if (user && session.error === "forbidden") {
    const access = await getStaffAccessForEmail(user.email);
    return (
      <div className="mb-6 rounded-xl border border-gold/40 bg-lavender-light/50 px-4 py-4 text-sm text-gold-dark">
        <p className="font-medium">
          {access.isPending
            ? "Waiting for manager confirmation"
            : "Staff access required"}
        </p>
        <p className="mt-1 text-text-muted">
          {access.isPending
            ? `Signed in as ${user.email}. Penny still needs to confirm this admin account before you can use these tools.`
            : `Signed in as ${user.email}, but this account is not set up for admin tools. Sign in with your team email instead.`}
        </p>
        <div className="mt-4">
          <AdminStaffSignInLink />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-gold/40 bg-lavender-light/50 px-4 py-4 text-sm text-gold-dark">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-medium">Staff sign-in required</p>
          <p className="mt-1 text-text-muted">
            Use your team email to review vaccinations and manage admin tools.
          </p>
        </div>
        <AdminStaffSignInLink />
      </div>
      <p className="mt-3 text-xs text-text-muted">
        Previewing the public site under construction?{" "}
        <Link href="/login/admin" className="underline hover:text-gold-dark">
          Site preview password
        </Link>
        {" · "}
        <ExitPreviewButton />
      </p>
    </div>
  );
}
