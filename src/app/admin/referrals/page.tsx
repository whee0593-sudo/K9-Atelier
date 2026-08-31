import Link from "next/link";
import { redirect } from "next/navigation";
import { ReferralReport } from "@/components/admin/ReferralReport";
import { getStaffSession } from "@/lib/staff/auth";

export default async function AdminReferralsPage() {
  const session = await getStaffSession();

  if ("error" in session) {
    if (session.error === "unauthenticated") {
      redirect("/login?next=/admin/referrals");
    }

    return (
      <div>
        <h2 className="text-2xl font-semibold text-gold-dark">Referrals</h2>
        <div className="mt-8 rounded-2xl border border-lavender/30 bg-cream p-6">
          <p className="text-sm text-text">
            Staff access is required to view referral rewards.
          </p>
          <Link
            href="/login?next=/admin/referrals"
            className="mt-4 inline-block text-sm font-medium text-gold-dark underline"
          >
            Staff sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gold-dark">Referrals</h2>
      <p className="mt-2 text-sm text-text-muted">
        Referral codes, household relationships, issued credit, and audit
        adjustments. Refunds stay on the existing charge flow; related rewards
        are marked under review here for a manual decision.
      </p>
      <div className="mt-8">
        <ReferralReport />
      </div>
    </div>
  );
}
